import { RecordMetadata, Index, PineconeRecord } from '@pinecone-database/pinecone';
import { RetrieveAndClusterResult, ClusterResult, RetrieveAndClusterOptions } from './types';
import { customKMeans } from './utils';
import { PCA } from 'ml-pca';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPCAIfRequested(points: number[][], reduceDimensions: boolean, pcaDimensions: number): { finalPoints: number[][], pcaModelJson: any } {
  let finalPoints = points;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pcaModelJson: any = undefined;

  if (reduceDimensions && points.length > 0 && points[0].length > 0) {
    const pca = new PCA(points);
    const nComponents = Math.min(pcaDimensions, pca.getExplainedVariance().length);
    if (nComponents > 0) {
      finalPoints = pca.predict(points, { nComponents }).to2DArray();
      pcaModelJson = pca.toJSON();
    }
  }
  return { finalPoints, pcaModelJson };
}

async function fetchAndFilterRecords<T extends RecordMetadata = RecordMetadata>(
  ids: string[],
  index: Index<T>,
  namespace: string
): Promise<{ validRecords: PineconeRecord<T>[], points: number[][] }> {
  const validRecords: PineconeRecord<T>[] = [];
  const points: number[][] = [];

  if (!ids || ids.length === 0) {
    return { validRecords, points };
  }

  const fetchResponse = await index.namespace(namespace).fetch({ ids });
  const fetchedRecords = fetchResponse.records || {};

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
  options: RetrieveAndClusterOptions<T>
): Promise<RetrieveAndClusterResult<T>> {
  const { ids, index, namespace, numClusters, reduceDimensions = true, pcaDimensions = 20 } = options;

  if (!ids || ids.length === 0) {
    return { clusters: [] };
  }

  const { validRecords, points } = await fetchAndFilterRecords(ids, index, namespace);

  if (points.length === 0) {
    return { clusters: [] };
  }

  if (points.length < numClusters) {
    throw new Error(`Number of clusters (${numClusters}) cannot be greater than the number of valid points (${points.length}).`);
  }

  const reduced = applyPCAIfRequested(points, reduceDimensions, pcaDimensions);
  const finalPoints = reduced.finalPoints;
  const pcaModelJson = reduced.pcaModelJson;

  const { labels, centroids } = customKMeans(finalPoints, numClusters);

  const clusters: ClusterResult<T>[] = centroids.map((centroid: number[]) => ({
    centroid,
    records: [],
    reducedPoints: []
  }));

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    clusters[label].records.push(validRecords[i]);
    clusters[label].reducedPoints!.push(finalPoints[i]);
  }

  return { clusters, pcaModel: pcaModelJson };
}