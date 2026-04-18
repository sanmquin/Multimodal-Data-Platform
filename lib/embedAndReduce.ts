import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone';
import { applyPCAIfRequested } from './utils';
import { TextRecord, EmbedStats } from './types';

export interface EmbedAndReduceOptions<T extends RecordMetadata = RecordMetadata> {
  texts: TextRecord[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
  index?: Index<T>;
  indexName?: string;
  namespace?: string;
  cloud?: string;
  region?: string;
}

export interface EmbedAndReduceResult {
  points: number[][];
  reducedPoints: number[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pcaModelJson: any;
  stats?: EmbedStats;
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
  const { texts, embedder, pc, model, reduceDimensions = true, pcaDimensions = 20, index, indexName, namespace, cloud, region } = options;

  if (!texts || texts.length === 0) {
    return { points: [], reducedPoints: [], pcaModelJson: undefined };
  }

  if (!embedder && (!pc || !model)) {
    throw new Error('You must provide either an embedder function OR a Pinecone instance (pc) and a model string.');
  }

  const { points, stats } = await resolvePoints(texts, index, indexName, namespace, cloud, region, embedder, pc, model);

  const { finalPoints, pcaModelJson } = applyPCAIfRequested(
    points,
    reduceDimensions,
    pcaDimensions
  );

  return { points, reducedPoints: finalPoints, pcaModelJson, stats };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolvePoints<T extends RecordMetadata>(texts: TextRecord[], index?: Index<T>, indexName?: string, namespace?: string, cloud?: string, region?: string, embedder?: any, pc?: any, model?: string) {
  let points: number[][] = [];
  let stats: EmbedStats | undefined;

  if (index) {
    const { embed } = await import('./embed');
    let targetIndex = index;
    if (namespace) {
      targetIndex = index.namespace(namespace) as unknown as Index<T>;
    }
    const result = await embed({
      texts,
      embedder,
      pc,
      model,
      index: targetIndex,
      indexName,
      cloud,
      region,
      returnEmbeddings: true
    });

    points = result.embeddings || [];
    stats = result;
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
  return { points, stats };
}
