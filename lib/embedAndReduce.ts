import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone';
import { applyPCAIfRequested } from './utils';
import { TextRecord } from './types';

export interface EmbedAndReduceOptions<T extends RecordMetadata = RecordMetadata> {
  texts: TextRecord[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
  index?: Index<T>;
  namespace?: string;
}

export interface EmbedAndReduceResult {
  points: number[][];
  reducedPoints: number[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pcaModelJson: any;
}

/**
 * Generates embeddings for a list of text records and optionally reduces their dimensionality.
 *
 * @param options - The options for embedding and reducing.
 * @returns A promise resolving to the embeddings and optionally reduced points.
 */

export async function embedAndReduce<T extends RecordMetadata = RecordMetadata>(
  options: EmbedAndReduceOptions<T>
): Promise<EmbedAndReduceResult> {
  const { texts, embedder, pc, model, reduceDimensions = true, pcaDimensions = 20, index, namespace } = options;

  if (!texts || texts.length === 0) {
    return { points: [], reducedPoints: [], pcaModelJson: undefined };
  }

  if (!embedder && (!pc || !model)) {
    throw new Error('You must provide either an embedder function OR a Pinecone instance (pc) and a model string.');
  }

  const points = await resolvePoints(texts, index, namespace, embedder, pc, model);

  const { finalPoints, pcaModelJson } = applyPCAIfRequested(
    points,
    reduceDimensions,
    pcaDimensions
  );

  return { points, reducedPoints: finalPoints, pcaModelJson };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolvePoints<T extends RecordMetadata>(texts: TextRecord[], index?: Index<T>, namespace?: string, embedder?: any, pc?: any, model?: string) {
  let points: number[][] = [];
  if (index && namespace) {
    const { embed } = await import('./embed');
    await embed({ texts, embedder, pc, model, index: index.namespace(namespace) as unknown as Index<T> });

    const fetchResponse = await index.namespace(namespace).fetch({ ids: texts.map(t => t.id) });
    const records = fetchResponse.records || {};
    points = texts.map(t => (records[t.id]?.values as number[]) || []);
  } else {
    const textsToEmbed = texts.map((t) => t.text);
    if (embedder) {
      points = await embedder(textsToEmbed);
    } else if (pc && model) {
      const result = await pc.inference.embed({
        model: model,
        inputs: textsToEmbed,
        parameters: { inputType: 'passage', truncate: 'END' }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      points = result.data.map((d: any) => d.values as number[]);
    }
  }
  return points;
}
