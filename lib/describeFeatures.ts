import { Feature } from './types';
import { gemmaGenerate } from './gemma';
import { getPrompt } from './prompts';
import { connectMongoose } from './mongo';
import { getFeatureModels } from './models';

/**
 * Extracts features from a list of texts using Gemma.
 *
 * @param texts - The list of texts to extract features from.
 * @param mongoDb - Optional MongoDB database name to store the generated features.
 * @param mongoCollection - Optional MongoDB collection prefix to store the generated features.
 * @param categoryId - Optional category ID to associate with the generated features.
 * @param clusterId - Optional cluster ID to associate with the generated features.
 * @returns A promise resolving to a list of features.
 */
export async function describeFeatures(
  texts: string[],
  mongoDb?: string,
  mongoCollection?: string,
  categoryId?: string,
  clusterId?: string
): Promise<Feature[]> {
  let prompt = getPrompt('describeFeatures') || '';
  prompt = prompt.replace('{{texts}}', JSON.stringify(texts, null, 2));

  try {
    const response = await gemmaGenerate(prompt, {
      systemInstruction: "You are an expert feature extraction AI. Always output raw, valid JSON. Only return a JSON array.",
      promptCategory: 'describeFeatures'
    });

    let text = response.text.trim();
    if (text.startsWith('```json')) text = text.substring(7);
    if (text.startsWith('```')) text = text.substring(3);
    if (text.endsWith('```')) text = text.slice(0, -3);

    const features = JSON.parse(text.trim()) as Feature[];

    await storeFeatures(features, mongoDb, mongoCollection, categoryId, clusterId);

    return features;
  } catch (error) {
    console.error("Failed to describe features:", error);
    return [];
  }
}

async function storeFeatures(
  features: Feature[],
  mongoDb?: string,
  mongoCollection?: string,
  categoryId?: string,
  clusterId?: string
) {
  if (mongoDb && mongoCollection && features.length > 0) {
    console.log(`[describeFeatures] Storing features to MongoDB collection: ${mongoCollection}`);
    try {
      if (await connectMongoose(mongoDb)) {
        const { FeatureModel } = getFeatureModels(mongoCollection);

        let currentVersion = 1;
        const query = categoryId ? { categoryId } : clusterId ? { clusterId } : {};
        const latestFeature = await FeatureModel.findOne(query).sort({ version: -1 });
        if (latestFeature && latestFeature.version) {
          currentVersion = latestFeature.version + 1;
        }

        const mappedFeatures = features.map(f => ({
          categoryId,
          clusterId,
          isClustered: false,
          version: currentVersion,
          name: f.name,
          description: f.description
        }));

        await FeatureModel.insertMany(mappedFeatures);
        console.log(`[describeFeatures] Storage to MongoDB complete.`);
      }
    } catch (dbError) {
      console.error('Failed to store features to Mongo:', dbError);
    }
  }
}
