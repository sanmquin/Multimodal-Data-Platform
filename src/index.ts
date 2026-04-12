import { Index, RecordMetadata, PineconeRecord, Pinecone } from '@pinecone-database/pinecone';

export interface TextRecord {
  id: string;
  text: string;
  metadata?: RecordMetadata;
}

export interface EmbedStats {
  writes: number;
  errors: number;
  elapsedMs: number;
}

export interface EmbedOptions<T extends RecordMetadata = RecordMetadata> {
  index: Index<T>;
  texts: TextRecord[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  batchSize?: number;
}

/**
 * Batches an array into smaller arrays of a specified size.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Embeds texts and stores them in a Pinecone index if they do not already exist.
 *
 * @param options - The embed options.
 * @returns Statistics about the operation: number of successful writes, errors, and elapsed time in milliseconds.
 */
export async function embed<T extends RecordMetadata = RecordMetadata>(
  options: EmbedOptions<T>
): Promise<EmbedStats> {
  const { index, texts, embedder, pc, model, batchSize = 50 } = options;
  const startTime = Date.now();
  let writes = 0;
  let errors = 0;

  if (!texts || texts.length === 0) {
    return { writes, errors, elapsedMs: Date.now() - startTime };
  }

  if (!embedder && (!pc || !model)) {
    throw new Error('You must provide either an embedder function OR a Pinecone instance (pc) and a model string.');
  }

  const resolveEmbeddings = async (textsToEmbed: string[]): Promise<number[][]> => {
    if (embedder) {
      return await embedder(textsToEmbed);
    } else {
      const result = await pc!.inference.embed({
        model: model!,
        inputs: textsToEmbed,
        parameters: {
          inputType: 'passage',
          truncate: 'END'
        }
      });
      return result.data.map(d => (d as any).values as number[]);
    }
  };

  const batches = chunkArray(texts, batchSize);

  for (const batch of batches) {
    try {
      const batchIds = batch.map((r) => r.id);

      // Check which IDs already exist
      const fetchResponse = await index.fetch({ ids: batchIds });
      const existingIds = new Set(Object.keys(fetchResponse.records || {}));

      // Filter for missing texts
      const missingRecords = batch.filter((r) => !existingIds.has(r.id));

      if (missingRecords.length > 0) {
        // Embed the missing texts
        const textsToEmbed = missingRecords.map((r) => r.text);
        const embeddings = await resolveEmbeddings(textsToEmbed);

        if (embeddings.length !== missingRecords.length) {
          throw new Error(`Embedder returned ${embeddings.length} embeddings for ${missingRecords.length} texts.`);
        }

        // Prepare vectors for Pinecone
        const vectors: PineconeRecord<T>[] = missingRecords.map((record, i) => ({
          id: record.id,
          values: embeddings[i],
          metadata: {
            ...record.metadata,
            text: record.text,
          } as unknown as T,
        }));

        // Upsert to Pinecone
        await index.upsert({ records: vectors });
        writes += missingRecords.length;
      }
    } catch (err) {
      console.error('Error processing batch:', err);
      errors += batch.length; // Assuming the whole batch failed if an error occurred during embed/upsert
    }
  }

  const elapsedMs = Date.now() - startTime;
  return { writes, errors, elapsedMs };
}
