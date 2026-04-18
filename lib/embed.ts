import { RecordMetadata, PineconeRecord } from '@pinecone-database/pinecone';
import { EmbedStats, EmbedOptions, TextRecord } from './types';
import { chunkArray } from './utils';

async function resolveEmbeddings(
  textsToEmbed: string[],
  embedder?: (texts: string[]) => Promise<number[][]>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const fallbackCloud = cloud || 'aws';
    const fallbackRegion = region || 'us-east-1';
    console.log(`Index ${indexName} not found. Provisioning automatically for model ${fallbackModel}...`);
    try {
      await pc.createIndexForModel({
        name: indexName,
        cloud: fallbackCloud,
        region: fallbackRegion,
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
): Promise<{ batchWrites: number, batchEmbeddings?: number[][] }> {
  const { index, embedder, pc, model, indexName, cloud, region, returnEmbeddings } = options;
  const batchIds = batch.map((r) => r.id);

  let fetchResponse;
  if (batchIds.length > 0) {
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
  }

  const existingRecords = fetchResponse?.records || {};
  const existingIds = new Set(Object.keys(existingRecords));
  const missingRecords = batch.filter((r) => !existingIds.has(r.id));

  let batchWrites = 0;
  let missingEmbeddings: number[][] = [];

  if (missingRecords.length > 0) {
    const textsToEmbed = missingRecords.map((r) => r.text);
    missingEmbeddings = await resolveEmbeddings(textsToEmbed, embedder, pc, model);

    if (missingEmbeddings.length !== missingRecords.length) {
      throw new Error(`Embedder returned ${missingEmbeddings.length} embeddings for ${missingRecords.length} texts.`);
    }

    const vectors: PineconeRecord<T>[] = missingRecords.map((record, i) => ({
      id: record.id,
      values: missingEmbeddings[i],
      metadata: {
        ...record.metadata,
        text: record.text,
      } as unknown as T,
    }));

    await index.upsert({ records: vectors });
    batchWrites = missingRecords.length;
  }

  let batchEmbeddings: number[][] | undefined;
  if (returnEmbeddings) {
    batchEmbeddings = [];
    let missingIndex = 0;
    for (const record of batch) {
      if (existingIds.has(record.id)) {
        batchEmbeddings.push(existingRecords[record.id].values as number[]);
      } else {
        batchEmbeddings.push(missingEmbeddings[missingIndex]);
        missingIndex++;
      }
    }
  }

  return { batchWrites, batchEmbeddings };
}

export async function embed<T extends RecordMetadata = RecordMetadata>(
  options: EmbedOptions<T>
): Promise<EmbedStats> {
  const { texts, embedder, pc, model, batchSize = 50, returnEmbeddings } = options;
  const startTime = Date.now();
  let writes = 0;
  let errors = 0;
  let embeddings: number[][] | undefined = returnEmbeddings ? [] : undefined;

  if (!texts || texts.length === 0) {
    const stats: EmbedStats = { writes, errors, elapsedMs: Date.now() - startTime };
    if (returnEmbeddings) stats.embeddings = [];
    return stats;
  }

  if (!embedder && (!pc || !model)) {
    throw new Error('You must provide either an embedder function OR a Pinecone instance (pc) and a model string.');
  }

  const batches = chunkArray(texts, batchSize);

  for (const batch of batches) {
    try {
      const { batchWrites, batchEmbeddings } = await processBatch(batch, options);
      writes += batchWrites;
      if (returnEmbeddings && batchEmbeddings) {
        embeddings!.push(...batchEmbeddings);
      }
    } catch (err) {
      console.error('Error processing batch:', err);
      errors += batch.length;
      if (returnEmbeddings) {
        for (let i = 0; i < batch.length; i++) {
          embeddings!.push([]);
        }
      }
    }
  }

  const elapsedMs = Date.now() - startTime;
  const stats: EmbedStats = { writes, errors, elapsedMs };
  if (returnEmbeddings) stats.embeddings = embeddings;
  return stats;
}