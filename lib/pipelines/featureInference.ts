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
  const featureDoc = await FeatureModel.findOne({ categoryId }).lean();

  if (!featureDoc || !featureDoc.features || featureDoc.features.length === 0 || !featureDoc.modelBuffer) return [];

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

  const mlr = MLR.load(JSON.parse(featureDoc.modelBuffer.toString('utf-8')));
  const predictions = mlr.predict(inferenceInputs);

  return saveInferences(texts, predictions, featureDoc.features, categoryId, EvaluationModel);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveInferences(texts: TextRecord[], predictions: number[][], features: any[], categoryId: string, EvaluationModel: any): Promise<TextFeatureEvaluation[]> {
  const updatedEvaluations: TextFeatureEvaluation[] = [];

  for (let i = 0; i < texts.length; i++) {
    const textRecord = texts[i];
    const predictionRow = predictions[i];

    let evaluationDoc = await EvaluationModel.findOne({ categoryId, textId: textRecord.id });
    if (!evaluationDoc) {
      evaluationDoc = new EvaluationModel({ categoryId, textId: textRecord.id, text: textRecord.text, evaluations: [] });
    }

    for (let j = 0; j < features.length; j++) {
      const featureName = features[j].name;
      const inferenceValue = predictionRow[j];

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
