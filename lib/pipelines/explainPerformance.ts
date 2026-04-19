import { Pinecone } from '@pinecone-database/pinecone';
import { sampleCorrelation } from 'simple-statistics';
import { TextRecord, TextFeatureEvaluation } from '../types';
import { featureInference } from './featureInference';
import { connectMongoose } from '../mongo';
import { getFeatureModels } from '../models';

export interface PerformanceTextRecord extends TextRecord {
  output: number;
}

export interface ExplainPerformanceOptions {
  mongoDb: string;
  mongoCollection: string;
  categoryId: string;
  featureName: string;
  texts: PerformanceTextRecord[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  reduceDimensions?: boolean;
  indexName?: string;
  namespace?: string;
  cloud?: string;
  region?: string;
}

export interface ExplainPerformanceResult {
  correlation: number;
  evaluations: TextFeatureEvaluation[];
}

export async function explainPerformance(options: ExplainPerformanceOptions): Promise<ExplainPerformanceResult> {
  const { mongoDb, mongoCollection, categoryId, featureName, texts, embedder, pc, model, reduceDimensions, indexName, namespace, cloud, region } = options;

  if (!texts || texts.length === 0) {
    return { correlation: 0, evaluations: [] };
  }

  // First infer the values of the texts using the existing featureInference functionality
  const evaluations = await featureInference({
    mongoDb,
    mongoCollection,
    categoryId,
    texts, // implicitly maps to TextRecord
    embedder,
    pc,
    model,
    reduceDimensions,
    indexName,
    namespace,
    cloud,
    region
  });

  if (!evaluations || evaluations.length === 0) {
    return { correlation: 0, evaluations };
  }

  const featureValues: number[] = [];
  const outputValues: number[] = [];

  for (const textRecord of texts) {
    const evalRecord = evaluations.find(e => e.textId === textRecord.id);
    if (evalRecord) {
      const featEval = evalRecord.evaluations.find(f => f.featureName === featureName);
      if (featEval && featEval.inferenceValue !== undefined) {
        featureValues.push(featEval.inferenceValue);
        outputValues.push(textRecord.output);
      }
    }
  }

  if (featureValues.length < 2) {
    // sampleCorrelation needs at least 2 points
    return { correlation: 0, evaluations };
  }

  const correlation = sampleCorrelation(featureValues, outputValues);

  if (await connectMongoose(mongoDb)) {
    const { PerformanceModel, FeatureModel } = getFeatureModels(mongoCollection);

    const latestFeature = await FeatureModel.findOne({ categoryId }).sort({ version: -1 });
    const currentVersion = latestFeature ? latestFeature.version || 1 : 1;

    await PerformanceModel.create({ categoryId, version: currentVersion, featureName, correlation });
  }

  return { correlation, evaluations };
}
