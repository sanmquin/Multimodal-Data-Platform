import { describeFeatures } from '../describeFeatures';
import { evaluateFeatures } from '../evaluateFeatures';
import { applyPCAIfRequested } from '../utils';

export interface FeaturePipelineOptions {
  texts: string[];
  reduceDimensions?: boolean;
  pcaDimensions?: number;
}

export interface FeaturePipelineResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pcaModelJson: any;
  points: number[][];
  reducedPoints: number[][];
}

/**
 * A pipeline that extracts features from texts, evaluates them,
 * and reduces the dimensionality of the resulting embeddings.
 *
 * @param options - Options for the feature pipeline.
 * @returns A promise resolving to the final points and PCA model.
 */
export async function featurePipeline(
  options: FeaturePipelineOptions
): Promise<FeaturePipelineResult> {
  const { texts, reduceDimensions = true, pcaDimensions = 20 } = options;

  if (!texts || texts.length === 0) {
    return { points: [], reducedPoints: [], pcaModelJson: undefined };
  }

  // 1. Describe the texts to find the features
  const features = await describeFeatures(texts);

  if (!features || features.length === 0) {
    return { points: [], reducedPoints: [], pcaModelJson: undefined };
  }

  // 2. Evaluate the texts to get numerical quantification of features
  const evaluations = await evaluateFeatures(texts, features);

  // 3. Construct embeddings from the evaluations by aligning the scores
  const points: number[][] = [];
  const featureNames = features.map((f) => f.name);

  for (const text of texts) {
    const textEval = evaluations.find((e) => e.text === text);
    const point: number[] = [];

    for (const featureName of featureNames) {
      if (textEval && textEval.evaluations) {
        const featEval = textEval.evaluations.find((e) => e.featureName === featureName);
        point.push(featEval ? featEval.score : 0);
      } else {
        point.push(0);
      }
    }
    points.push(point);
  }

  // 4. Reduce dimensions using the common utility
  const { finalPoints, pcaModelJson } = applyPCAIfRequested(
    points,
    reduceDimensions,
    pcaDimensions
  );

  return { points, reducedPoints: finalPoints, pcaModelJson };
}
