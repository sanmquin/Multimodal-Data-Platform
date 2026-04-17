import { Pinecone } from '@pinecone-database/pinecone';
import MLR from 'ml-regression-multivariate-linear';
import { PCA } from 'ml-pca';
import { TextRecord, TextFeatureEvaluation } from '../types';
import { getFeatureModels } from '../models';
import { connectMongoose } from '../mongo';
import { embedAndReduce } from '../embedAndReduce';

export interface FeatureInferenceOptions {
  mongoDb: string;
  mongoCollection: string;
  categoryId: string;
  texts: TextRecord[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  reduceDimensions?: boolean;
}

export async function featureInference(options: FeatureInferenceOptions): Promise<TextFeatureEvaluation[]> {
  const { mongoDb, mongoCollection, categoryId, texts, embedder, pc, model, reduceDimensions = true } = options;

  if (!texts || texts.length === 0 || !(await connectMongoose(mongoDb))) return [];

  const { FeatureModel, EvaluationModel, PCAModel } = getFeatureModels(mongoCollection);
  const featureDocs = await FeatureModel.find({ categoryId }).lean();

  if (!featureDocs || featureDocs.length === 0) return [];

  const validFeatures = featureDocs.filter((doc) => doc.modelBuffer && doc.name);
  if (validFeatures.length === 0) return [];

  const { points } = await embedAndReduce({ texts, embedder, pc, model, reduceDimensions: false });
  if (!points || points.length === 0) return [];

  let inferenceInputs = points;
  if (reduceDimensions) {
    const pcaDoc = await PCAModel.findOne({ categoryId }).lean();
    if (pcaDoc && pcaDoc.modelBuffer) {
      const pca = PCA.load(JSON.parse(pcaDoc.modelBuffer.toString('utf-8')));
      inferenceInputs = pca.predict(points).to2DArray();
    }
  }

  const allPredictions: Record<string, number[]> = {};

  for (const feature of validFeatures) {
    if (!feature.modelBuffer || !feature.name) continue;
    const mlr = MLR.load(JSON.parse(feature.modelBuffer.toString('utf-8')));
    const predictions = mlr.predict(inferenceInputs);
    // MLR returns a 2D array, we extract the first column
    allPredictions[feature.name] = predictions.map((p) => p[0]);
  }

  return saveInferences(texts, allPredictions, validFeatures, categoryId, EvaluationModel);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveInferences(texts: TextRecord[], allPredictions: Record<string, number[]>, features: any[], categoryId: string, EvaluationModel: any): Promise<TextFeatureEvaluation[]> {
  const updatedEvaluations: TextFeatureEvaluation[] = [];

  for (let i = 0; i < texts.length; i++) {
    const textRecord = texts[i];

    let evaluationDoc = await EvaluationModel.findOne({ categoryId, textId: textRecord.id });
    if (!evaluationDoc) {
      evaluationDoc = new EvaluationModel({ categoryId, textId: textRecord.id, text: textRecord.text, evaluations: [] });
    }

    for (const feature of features) {
      if (!feature.name || !allPredictions[feature.name]) continue;
      const featureName = feature.name;
      const inferenceValue = allPredictions[feature.name][i];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingEvalIndex = evaluationDoc.evaluations.findIndex((ev: any) => ev.featureName === featureName);
      if (existingEvalIndex >= 0) {
        evaluationDoc.evaluations[existingEvalIndex].inferenceValue = inferenceValue;
      } else {
        evaluationDoc.evaluations.push({ featureName, inferenceValue });
      }
    }

    await evaluationDoc.save();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedEvaluations.push({ textId: evaluationDoc.textId, text: evaluationDoc.text, evaluations: evaluationDoc.evaluations.map((ev: any) => ({ featureName: ev.featureName, score: ev.score, inferenceValue: ev.inferenceValue })) } as any);
  }

  return updatedEvaluations;
}
