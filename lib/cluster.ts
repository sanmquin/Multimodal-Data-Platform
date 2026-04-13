import { RecordMetadata, Index, PineconeRecord } from '@pinecone-database/pinecone';
import { ClusterResult } from './types';
import { customKMeans } from './utils';

async function fetchAndFilterRecords<T extends RecordMetadata = RecordMetadata>(
  ids: string[],
  index: Index<T>,
  namespace: string
): Promise<{ validRecords: PineconeRecord<T>[], points: number[][] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  return { validRecords, points };
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

  const { validRecords, points } = await fetchAndFilterRecords(ids, index, namespace);

  if (points.length === 0) {
    return [];
  }

  if (points.length < numClusters) {
    throw new Error(`Number of clusters (${numClusters}) cannot be greater than the number of valid points (${points.length}).`);
  }

  const { labels, centroids } = customKMeans(points, numClusters);

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