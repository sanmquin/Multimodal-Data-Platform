import { Pinecone } from '@pinecone-database/pinecone';
import { applyPCAIfRequested } from './utils';

export interface EmbedAndReduceOptions {
  texts: string[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
}

export interface EmbedAndReduceResult {
  points: number[][];
  reducedPoints: number[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pcaModelJson: any;
}

/**
 * Generates embeddings for a list of texts and optionally reduces their dimensionality.
 *
 * @param options - The options for embedding and reducing.
 * @returns A promise resolving to the embeddings and optionally reduced points.
 */
export async function embedAndReduce(
  options: EmbedAndReduceOptions
): Promise<EmbedAndReduceResult> {
  const { texts, embedder, pc, model, reduceDimensions = true, pcaDimensions = 20 } = options;

  if (!texts || texts.length === 0) {
    return { points: [], reducedPoints: [], pcaModelJson: undefined };
  }

  if (!embedder && (!pc || !model)) {
    throw new Error('You must provide either an embedder function OR a Pinecone instance (pc) and a model string.');
  }

  let points: number[][] = [];

  if (embedder) {
    points = await embedder(texts);
  } else if (pc && model) {
    const result = await pc.inference.embed({
      model: model,
      inputs: texts,
      parameters: {
        inputType: 'passage',
        truncate: 'END'
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    points = result.data.map((d: any) => d.values as number[]);
  }

  const { finalPoints, pcaModelJson } = applyPCAIfRequested(
    points,
    reduceDimensions,
    pcaDimensions
  );

  return { points, reducedPoints: finalPoints, pcaModelJson };
}
