import { RecordMetadata, PineconeRecord } from '@pinecone-database/pinecone';
import { EmbedStats, EmbedOptions, TextRecord } from './types';
import { chunkArray } from './utils';

async function resolveEmbeddings(
  textsToEmbed: string[],
  embedder?: (texts: string[]) => Promise<number[][]>,
  pc?: any,
  model?: string
): Promise<number[][]> {
  if (embedder) {
    return await embedder(textsToEmbed);
  } else {
    const result = await pc.inference.embed({
      model: model!,
      inputs: textsToEmbed,
      parameters: {
        inputType: 'passage',
        truncate: 'END'
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.data.map((d: any) => d.values as number[]);
  }
}

async function handleMissingIndex(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pc: any,
  indexName?: string,
  model?: string,
  cloud?: string,
  region?: string
): Promise<void> {
  if (pc && indexName) {
    const fallbackModel = model || 'multilingual-e5-large';
    console.log(`Index ${indexName} not found. Provisioning automatically for model ${fallbackModel}...`);
    try {
      await pc.createIndexForModel({
        name: indexName,
        cloud: cloud,
        region: region,
        embed: {
          model: fallbackModel,
          fieldMap: { text: 'text' }
        },
        waitUntilReady: true
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (createErr: any) {
      if (createErr.name !== 'PineconeConflictError') {
        throw createErr;
      }
    }
  } else {
    throw new Error('PineconeNotFoundError encountered but indexName or Pinecone instance (pc) is missing.');
  }
}

async function processBatch<T extends RecordMetadata = RecordMetadata>(
  batch: TextRecord[],
  options: EmbedOptions<T>
): Promise<number> {
  const { index, embedder, pc, model, indexName, cloud, region } = options;
  const batchIds = batch.map((r) => r.id);

  let fetchResponse;
  try {
    fetchResponse = await index.fetch({ ids: batchIds });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err.name === 'PineconeNotFoundError') {
      await handleMissingIndex(pc, indexName, model, cloud, region);
      fetchResponse = await index.fetch({ ids: batchIds });
    } else {
      throw err;
    }
  }

  const existingIds = new Set(Object.keys(fetchResponse.records || {}));
  const missingRecords = batch.filter((r) => !existingIds.has(r.id));

  if (missingRecords.length > 0) {
    const textsToEmbed = missingRecords.map((r) => r.text);
    const embeddings = await resolveEmbeddings(textsToEmbed, embedder, pc, model);

    if (embeddings.length !== missingRecords.length) {
      throw new Error(`Embedder returned ${embeddings.length} embeddings for ${missingRecords.length} texts.`);
    }

    const vectors: PineconeRecord<T>[] = missingRecords.map((record, i) => ({
      id: record.id,
      values: embeddings[i],
      metadata: {
        ...record.metadata,
        text: record.text,
      } as unknown as T,
    }));

    await index.upsert({ records: vectors });
    return missingRecords.length;
  }
  return 0;
}

export async function embed<T extends RecordMetadata = RecordMetadata>(
  options: EmbedOptions<T>
): Promise<EmbedStats> {
  const { texts, embedder, pc, model, batchSize = 50 } = options;
  const startTime = Date.now();
  let writes = 0;
  let errors = 0;

  if (!texts || texts.length === 0) {
    return { writes, errors, elapsedMs: Date.now() - startTime };
  }

  if (!embedder && (!pc || !model)) {
    throw new Error('You must provide either an embedder function OR a Pinecone instance (pc) and a model string.');
  }

  const batches = chunkArray(texts, batchSize);

  for (const batch of batches) {
    try {
      const batchWrites = await processBatch(batch, options);
      writes += batchWrites;
    } catch (err) {
      console.error('Error processing batch:', err);
      errors += batch.length;
    }
  }

  const elapsedMs = Date.now() - startTime;
  return { writes, errors, elapsedMs };
}