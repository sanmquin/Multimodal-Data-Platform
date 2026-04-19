import { Pinecone } from '@pinecone-database/pinecone';
import MLR from 'ml-regression-multivariate-linear';
import { evaluateFeatures } from '../evaluateFeatures';
import { embedAndReduce } from '../embedAndReduce';
import { Feature, TextFeatureEvaluation, TextRecord } from '../types';
import { connectMongoose } from '../mongo';
import { getFeatureModels } from '../models';

export interface TrainFeaturesPipelineOptions {
  texts: TextRecord[];
  features: Feature[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
  mongoDb?: string;
  mongoCollection?: string;
  categoryId?: string;
  clusterId?: string;
  isClustered?: boolean;
  indexName?: string;
  namespace?: string;
  cloud?: string;
  region?: string;
}

export interface TrainFeaturesPipelineResult {
  features: Feature[];
  evaluations: TextFeatureEvaluation[];
  points: number[][];
  reducedPoints: number[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pcaModelJson: any;
}

/**
 * A pipeline that evaluates predefined features against texts,
 * and generates and reduces embeddings for the texts to train regression models.
 *
 * @param options - Options for the train features pipeline.
 * @returns A promise resolving to the pipeline results.
 */
export async function trainFeaturesPipeline(
  options: TrainFeaturesPipelineOptions
): Promise<TrainFeaturesPipelineResult> {
  const { texts, features, embedder, pc, model, reduceDimensions = true, pcaDimensions = 20, mongoDb, mongoCollection, categoryId, clusterId, isClustered = false, indexName, namespace, cloud, region } = options;

  if (!texts || texts.length === 0) return { features: [], evaluations: [], points: [], reducedPoints: [], pcaModelJson: undefined };
  if (!features || features.length === 0) return { features: [], evaluations: [], points: [], reducedPoints: [], pcaModelJson: undefined };

  const rawTexts = texts.map((t) => t.text);

  console.log(`[TrainFeaturesPipeline] Evaluating features for all texts...`);
  const evaluations = await evaluateFeatures(rawTexts, features);
  console.log(`[TrainFeaturesPipeline] Feature evaluation complete.`);

  console.log(`[TrainFeaturesPipeline] Generating embeddings and optionally reducing dimensions...`);
  const { points, reducedPoints, pcaModelJson } = await embedAndReduce({
    texts, embedder, pc, model, reduceDimensions, pcaDimensions,
    index: pc && indexName ? pc.index(indexName) : undefined,
    indexName,
    namespace,
    cloud,
    region
  });

  console.log(`[TrainFeaturesPipeline] Training linear regression models for features...`);
  const X = reduceDimensions && reducedPoints && reducedPoints.length > 0 ? reducedPoints : points;
  trainAndEvaluateRegression(X, evaluations, features);

  if (mongoDb && mongoCollection) {
    console.log(`[TrainFeaturesPipeline] Storing pipeline results to MongoDB collection: ${mongoCollection}`);
    await storeFeaturesToMongo(mongoDb, mongoCollection, features, evaluations, pcaModelJson, categoryId, clusterId, isClustered, texts);
    console.log(`[TrainFeaturesPipeline] Storage to MongoDB complete.`);
  }

  console.log(`[TrainFeaturesPipeline] Pipeline completed successfully.`);
  return { features, evaluations, points, reducedPoints, pcaModelJson };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeFeaturesToMongo(mongoDb: string, mongoCollection: string, features: Feature[], evaluations: TextFeatureEvaluation[], pcaModelJson: any, categoryId?: string, clusterId?: string, isClustered?: boolean, texts?: TextRecord[]) {
  try {
    if (!(await connectMongoose(mongoDb))) return;

    const { FeatureModel, EvaluationModel, PCAModel } = getFeatureModels(mongoCollection);

    let currentVersion = 1;
    const query = categoryId ? { categoryId } : clusterId ? { clusterId } : {};
    const latestFeature = await FeatureModel.findOne(query).sort({ version: -1 });
    if (latestFeature && latestFeature.version) {
      currentVersion = latestFeature.version + 1;
    }

    if (features && features.length > 0) {
      const mappedFeatures = features.map(f => ({
        categoryId,
        clusterId,
        isClustered,
        version: currentVersion,
        name: f.name,
        description: f.description,
        modelBuffer: f.modelJson ? Buffer.from(JSON.stringify(f.modelJson), 'utf-8') : undefined,
        error: f.error,
        averageValue: f.averageValue
      }));

      await FeatureModel.insertMany(mappedFeatures);
    }

    if (evaluations && evaluations.length > 0) {
      const enrichedEvaluations = evaluations.map((ev) => {
        const textRecord = texts?.find((t) => t.text === ev.text);
        return {
          ...ev,
          categoryId,
          clusterId,
          version: currentVersion,
          textId: textRecord ? textRecord.id : undefined
        };
      });
      await EvaluationModel.insertMany(enrichedEvaluations);
    }

    if (pcaModelJson) {
      await PCAModel.create({ categoryId, clusterId, version: currentVersion, modelBuffer: Buffer.from(JSON.stringify(pcaModelJson), 'utf-8') });
    }

  } catch (err) {
    console.error('Failed to store features pipeline results to Mongo:', err);
  }
}

function trainAndEvaluateRegression(X: number[][], evaluations: TextFeatureEvaluation[], features: Feature[]): void {
  if (!X || X.length === 0 || evaluations.length !== X.length || features.length === 0) return;

  for (const feature of features) {
    const validX: number[][] = [];
    const validY: number[][] = [];

    for (let i = 0; i < evaluations.length; i++) {
      const featEval = evaluations[i].evaluations.find((ev) => ev.featureName === feature.name);
      if (featEval && featEval.score !== undefined) {
        validX.push(X[i]);
        validY.push([featEval.score]);
      }
    }

    if (validX.length === 0) {
      console.log(`Skipping regression for feature ${feature.name} due to no valid scores.`);
      continue;
    }

    const mlr = new MLR(validX, validY);
    const yPred = mlr.predict(validX);

    let mse = 0, sumY = 0;
    for (let i = 0; i < validY.length; i++) {
      mse += Math.pow(validY[i][0] - yPred[i][0], 2);
      sumY += validY[i][0];
    }

    feature.error = mse / validY.length;
    feature.averageValue = sumY / validY.length;
    feature.modelJson = mlr.toJSON();

    console.log(`Feature '${feature.name}': Training error (MSE): ${feature.error}, Average value: ${feature.averageValue}`);

    const fullYPred = mlr.predict(X);
    for (let i = 0; i < evaluations.length; i++) {
      const featEval = evaluations[i].evaluations.find((ev) => ev.featureName === feature.name);
      if (featEval) featEval.inferenceValue = fullYPred[i][0];
      else evaluations[i].evaluations.push({ featureName: feature.name, inferenceValue: fullYPred[i][0] });
    }
  }
}
