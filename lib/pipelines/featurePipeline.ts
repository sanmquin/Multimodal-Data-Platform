import { Pinecone } from '@pinecone-database/pinecone';
import { describeFeatures } from '../describeFeatures';
import { evaluateFeatures } from '../evaluateFeatures';
import { embedAndReduce } from '../embedAndReduce';
import { Feature, TextFeatureEvaluation, TextRecord } from '../types';

export interface FeaturePipelineOptions {
  texts: string[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
}

export interface FeaturePipelineResult {
  records: TextRecord[];
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
  const { texts, embedder, pc, model, reduceDimensions = true, pcaDimensions = 20 } = options;

  if (!texts || texts.length === 0) {
    return { records: [], features: [], evaluations: [], points: [], reducedPoints: [], pcaModelJson: undefined };
  }

  // Generate IDs for texts
  const records: TextRecord[] = texts.map((text, i) => ({
    id: String(i + 1),
    text
  }));

  // 1. Describe the texts to find the features
  const features = await describeFeatures(texts);

  if (!features || features.length === 0) {
    return { records, features: [], evaluations: [], points: [], reducedPoints: [], pcaModelJson: undefined };
  }

  // 2. Evaluate the texts to get numerical quantification of features
  const evaluations = await evaluateFeatures(texts, features);

  // 3. Generate embeddings and reduce dimensions using the common utility
  const { points, reducedPoints, pcaModelJson } = await embedAndReduce({
    texts,
    embedder,
    pc,
    model,
    reduceDimensions,
    pcaDimensions
  });

  return { records, features, evaluations, points, reducedPoints, pcaModelJson };
}
