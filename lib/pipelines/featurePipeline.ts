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
  trainAndEvaluateRegression(X, evaluations, features);

  // 5. Store to MongoDB if configured
  if (mongoDb && mongoCollection) {
    await storeFeaturesToMongo(mongoDb, mongoCollection, features, evaluations, pcaModelJson, categoryId, texts);
  }

  return { features, evaluations, points, reducedPoints, pcaModelJson };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeFeaturesToMongo(mongoDb: string, mongoCollection: string, features: Feature[], evaluations: TextFeatureEvaluation[], pcaModelJson: any, categoryId?: string, texts?: TextRecord[]) {
  try {
    if (!(await connectMongoose(mongoDb))) return;

    const { FeatureModel, EvaluationModel, PCAModel } = getFeatureModels(mongoCollection);

    if (features && features.length > 0) {
      const mappedFeatures = features.map(f => ({
        name: f.name,
        description: f.description,
        modelBuffer: f.modelJson ? Buffer.from(JSON.stringify(f.modelJson), 'utf-8') : undefined,
        error: f.error,
        averageValue: f.averageValue
      }));

      await FeatureModel.create({
        categoryId,
        features: mappedFeatures
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
