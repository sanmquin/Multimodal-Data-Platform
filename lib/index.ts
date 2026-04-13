import { Index, RecordMetadata, PineconeRecord, Pinecone } from '@pinecone-database/pinecone';
const { mean } = require('simple-statistics');

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
  indexName?: string;
  cloud?: string;
  region?: string;
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
  const { index, texts, embedder, pc, model, batchSize = 50, indexName, cloud = 'aws', region = 'us-east-1' } = options;
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
      let fetchResponse;
      try {
        fetchResponse = await index.fetch({ ids: batchIds });
      } catch (err: any) {
        if (err.name === 'PineconeNotFoundError') {
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
            } catch (createErr: any) {
              if (createErr.name !== 'PineconeConflictError') {
                throw createErr;
              }
            }
            fetchResponse = await index.fetch({ ids: batchIds });
          } else {
            throw new Error('PineconeNotFoundError encountered but indexName or Pinecone instance (pc) is missing.');
          }
        } else {
          throw err;
        }
      }
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

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function customKMeans(points: number[][], k: number): { labels: number[], centroids: number[][] } {
  const dimensions = points[0].length;
  let centroids = points.slice(0, k).map(p => [...p]);
  let labels = new Array(points.length).fill(-1);
  let changed = true;
  let maxIterations = 100;

  while (changed && maxIterations > 0) {
    changed = false;
    maxIterations--;

    // Assign points to closest centroid
    for (let i = 0; i < points.length; i++) {
      let minDist = Infinity;
      let label = -1;
      for (let j = 0; j < k; j++) {
        const dist = euclideanDistance(points[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          label = j;
        }
      }
      if (labels[i] !== label) {
        labels[i] = label;
        changed = true;
      }
    }

    // Recalculate centroids
    const newCentroids = Array(k).fill(0).map(() => new Array(dimensions).fill(0));

    // Group points by label
    const clustersPoints: number[][][] = Array.from({ length: k }, () => []);
    for (let i = 0; i < points.length; i++) {
      const label = labels[i];
      if (label !== -1) {
        clustersPoints[label].push(points[i]);
      }
    }

    for (let j = 0; j < k; j++) {
      const clusterPoints = clustersPoints[j];
      if (clusterPoints.length === 0) {
        newCentroids[j] = [...centroids[j]];
      } else {
        // Calculate the mean of each dimension for this cluster using simple-statistics 'mean'
        for (let d = 0; d < dimensions; d++) {
          const dimensionValues = clusterPoints.map(p => p[d]);
          newCentroids[j][d] = mean(dimensionValues);
        }
      }
    }

    centroids = newCentroids;
  }

  return { labels, centroids };
}

export interface ClusterResult<T extends RecordMetadata = RecordMetadata> {
  centroid: number[];
  records: PineconeRecord<T>[];
}

export async function retrieveAndCluster<T extends RecordMetadata = RecordMetadata>(
  options: {
    ids: string[];
    index: Index<T>;
    namespace: string;
    numClusters: number;
  }
): Promise<ClusterResult<T>[]> {
  const { ids, index, namespace, numClusters } = options;

  if (!ids || ids.length === 0) {
    return [];
  }

  const fetchResponse = await index.namespace(namespace).fetch(ids as any);
  const fetchedRecords = fetchResponse.records || {};

  const validRecords: PineconeRecord<T>[] = [];
  const points: number[][] = [];

  for (const id of ids) {
    const record = fetchedRecords[id];
    if (record && record.values && record.values.length > 0) {
      validRecords.push(record as PineconeRecord<T>);
      points.push(record.values);
    }
  }

  if (points.length === 0) {
    return [];
  }

  if (points.length < numClusters) {
    throw new Error(`Number of clusters (${numClusters}) cannot be greater than the number of valid points (${points.length}).`);
  }

  const clusterResult = customKMeans(points, numClusters);
  const { labels, centroids } = clusterResult;

  const clusters: ClusterResult<T>[] = centroids.map((centroid: number[]) => ({
    centroid,
    records: []
  }));

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    clusters[label].records.push(validRecords[i]);
  }

  return clusters;
}
