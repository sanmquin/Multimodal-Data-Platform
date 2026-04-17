import { Pinecone } from '@pinecone-database/pinecone';
import MLR from 'ml-regression-multivariate-linear';
import { describeFeatures } from '../describeFeatures';
import { evaluateFeatures } from '../evaluateFeatures';
import { embedAndReduce } from '../embedAndReduce';
import { Feature, TextFeatureEvaluation, TextRecord } from '../types';
import { connectMongoose } from '../mongo';
import { getFeatureModels } from '../models';

export interface FeaturePipelineOptions {
  texts: TextRecord[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
  mongoDb?: string;
  mongoCollection?: string;
  categoryId?: string;
}

export interface FeaturePipelineResult {
  features: Feature[];
  evaluations: TextFeatureEvaluation[];
  points: number[][];
  reducedPoints: number[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pcaModelJson: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  regressionModelJson?: any;
  error?: number;
  averageValue?: number;
}

/**
 * A pipeline that extracts features from texts, evaluates them,
 * and generates and reduces embeddings for the texts.
 *
 * @param options - Options for the feature pipeline.
 * @returns A promise resolving to the pipeline results.
 */
export async function featurePipeline(
  options: FeaturePipelineOptions
): Promise<FeaturePipelineResult> {
  const { texts, embedder, pc, model, reduceDimensions = true, pcaDimensions = 20, mongoDb, mongoCollection, categoryId } = options;

  if (!texts || texts.length === 0) {
    return { features: [], evaluations: [], points: [], reducedPoints: [], pcaModelJson: undefined };
  }

  const rawTexts = texts.map((t) => t.text);

  // 1. Describe the texts to find the features
  const features = await describeFeatures(rawTexts);

  if (!features || features.length === 0) {
    return { features: [], evaluations: [], points: [], reducedPoints: [], pcaModelJson: undefined };
  }

  // 2. Evaluate the texts to get numerical quantification of features
  const evaluations = await evaluateFeatures(rawTexts, features);

  // 3. Generate embeddings and reduce dimensions using the common utility
  const { points, reducedPoints, pcaModelJson } = await embedAndReduce({
    texts,
    embedder,
    pc,
    model,
    reduceDimensions,
    pcaDimensions
  });

  // 4. Train a linear regression to predict features from embeddings
  const X = reduceDimensions && reducedPoints && reducedPoints.length > 0 ? reducedPoints : points;
  const regressionResult = trainAndEvaluateRegression(X, evaluations, features);
  const regressionModelJson = regressionResult?.model;
  const error = regressionResult?.error;
  const averageValue = regressionResult?.averageValue;

  // 5. Store to MongoDB if configured
  if (mongoDb && mongoCollection) {
    await storeFeaturesToMongo(mongoDb, mongoCollection, features, evaluations, pcaModelJson, regressionModelJson, error, averageValue, categoryId, texts);
  }

  return { features, evaluations, points, reducedPoints, pcaModelJson, regressionModelJson, error, averageValue };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeFeaturesToMongo(mongoDb: string, mongoCollection: string, features: Feature[], evaluations: TextFeatureEvaluation[], pcaModelJson: any, regressionModelJson: any, error?: number, averageValue?: number, categoryId?: string, texts?: TextRecord[]) {
  try {
    if (!(await connectMongoose(mongoDb))) return;

    const { FeatureModel, EvaluationModel, PCAModel } = getFeatureModels(mongoCollection);

    if (features && features.length > 0) {
      await FeatureModel.create({
        categoryId,
        features,
        modelBuffer: regressionModelJson ? Buffer.from(JSON.stringify(regressionModelJson), 'utf-8') : undefined,
        error,
        averageValue
      });
    }

    if (evaluations && evaluations.length > 0) {
      const enrichedEvaluations = evaluations.map((ev) => {
        const textRecord = texts?.find((t) => t.text === ev.text);
        return {
          ...ev,
          categoryId,
          textId: textRecord ? textRecord.id : undefined
        };
      });
      await EvaluationModel.insertMany(enrichedEvaluations);
    }

    if (pcaModelJson) {
      await PCAModel.create({ categoryId, modelBuffer: Buffer.from(JSON.stringify(pcaModelJson), 'utf-8') });
    }

  } catch (err) {
    console.error('Failed to store features pipeline results to Mongo:', err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trainAndEvaluateRegression(X: number[][], evaluations: TextFeatureEvaluation[], features: Feature[]): { model: any, error: number, averageValue: number } | undefined {
  if (!X || X.length === 0 || evaluations.length !== X.length || features.length === 0) {
    return undefined;
  }

  const Y = evaluations.map((evalObj) => {
    return features.map((f) => {
      const featEval = evalObj.evaluations.find((ev) => ev.featureName === f.name);
      return featEval && featEval.score !== undefined ? featEval.score : 0;
    });
  });

  const mlr = new MLR(X, Y);
  const yPred = mlr.predict(X);

  let mse = 0;
  let totalElements = 0;
  let sumY = 0;
  for (let i = 0; i < Y.length; i++) {
    for (let j = 0; j < Y[i].length; j++) {
      const diff = Y[i][j] - yPred[i][j];
      mse += diff * diff;
      sumY += Y[i][j];
      totalElements++;
    }
  }
  mse = totalElements > 0 ? mse / totalElements : 0;
  const averageValue = totalElements > 0 ? sumY / totalElements : 0;
  console.log(`Training error (MSE): ${mse}, Average value: ${averageValue}`);

  return { model: mlr.toJSON(), error: mse, averageValue };
}
