import { Feature } from './types';
import { connectMongoose } from './mongo';
import { getFeatureModels, getMongooseModels } from './models';
import { geminiGenerateJson } from './gemini';
import { getPrompt } from './prompts';

export interface AggregateFeaturesOptions {
  categoryIds: string[];
  clusterId: string;
  mongoDb: string;
  mongoCollection: string;
}

/**
 * Aggregates features from multiple categories into a single MECE list
 * centered around a specific cluster description.
 *
 * @param options - Options containing category IDs, cluster ID, and MongoDB connection details.
 * @returns A promise resolving to an array of newly aggregated features.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInputFeatures(FeatureModel: any, categoryIds: string[]): Promise<Feature[]> {
  const featuresData: Feature[] = [];
  for (const categoryId of categoryIds) {
    const latestFeature = await FeatureModel.findOne({ categoryId }).sort({ version: -1 }).lean();
    if (latestFeature) {
      const currentVersion = latestFeature.version || 1;
      const features = await FeatureModel.find({ categoryId, version: currentVersion }).lean();

      for (const feature of features) {
        featuresData.push({
          name: feature.name,
          description: feature.description
        });
      }
    }
  }
  return featuresData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateAggregatedFeatures(clusterData: any, featuresData: Feature[], mongoDb: string): Promise<Feature[]> {
  let prompt = getPrompt('aggregateFeatures') || '';
  prompt = prompt.replace('{{clusterData}}', `Name: ${clusterData.name}\nDescription: ${clusterData.description}`);
  prompt = prompt.replace('{{featuresData}}', JSON.stringify(featuresData, null, 2));

  const schema = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: "ARRAY" as any,
    items: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: "OBJECT" as any,
      properties: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: { type: "STRING" as any },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: { type: "STRING" as any }
      },
      required: ["name", "description"]
    }
  };

  try {
    const response = await geminiGenerateJson(prompt, schema, {
      systemInstruction: "You are an expert taxonomist and feature extraction AI. Always output valid JSON.",
      promptCategory: 'aggregateFeatures',
      mongoDb
    });

    return response as Feature[];
  } catch (error) {
    console.error("Failed to aggregate features:", error);
    return [];
  }
}

export async function aggregateFeatures(options: AggregateFeaturesOptions): Promise<Feature[]> {
  const { categoryIds, clusterId, mongoDb, mongoCollection } = options;

  if (!categoryIds || categoryIds.length === 0) throw new Error('categoryIds array cannot be empty');
  if (!clusterId) throw new Error('clusterId cannot be empty');

  const isConnected = await connectMongoose(mongoDb);
  if (!isConnected) throw new Error('Failed to connect to MongoDB');

  const { ClusterModel } = getMongooseModels(mongoCollection);
  const { FeatureModel } = getFeatureModels(mongoCollection);

  const targetCluster = await ClusterModel.findById(clusterId).lean();
  if (!targetCluster) throw new Error(`Cluster not found for id: ${clusterId}`);

  const featuresData = await fetchInputFeatures(FeatureModel, categoryIds);
  if (featuresData.length === 0) return [];

  const clusterData = {
    name: targetCluster.name,
    description: targetCluster.description,
    summary: targetCluster.summary
  };

  return generateAggregatedFeatures(clusterData, featuresData, mongoDb);
}
