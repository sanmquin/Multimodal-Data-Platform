import mongoose from 'mongoose';
import { RecordMetadata, Index } from '@pinecone-database/pinecone';
import { RefineClustersOptions } from './types';
import { connectMongoose } from './mongo';
import { gemmaGenerate } from './gemma';
import { mean } from 'simple-statistics';

/**
 * Batches an array into smaller arrays of a specified size.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function assignPointsToCentroids(points: number[][], centroids: number[][], k: number, labels: number[]): boolean {
  let changed = false;
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
  return changed;
}

function recalculateCentroids(points: number[][], labels: number[], k: number, dimensions: number, oldCentroids: number[][]): number[][] {
  const newCentroids = Array(k).fill(0).map(() => new Array(dimensions).fill(0));
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
      newCentroids[j] = [...oldCentroids[j]];
    } else {
      for (let d = 0; d < dimensions; d++) {
        const dimensionValues = clusterPoints.map(p => p[d]);
        newCentroids[j][d] = mean(dimensionValues);
      }
    }
  }
  return newCentroids;
}

export function customKMeans(points: number[][], k: number): { labels: number[], centroids: number[][] } {
  const dimensions = points[0].length;
  let centroids = points.slice(0, k).map(p => [...p]);
  const labels = new Array(points.length).fill(-1);
  let changed = true;
  let maxIterations = 100;

  while (changed && maxIterations > 0) {
    maxIterations--;

    changed = assignPointsToCentroids(points, centroids, k, labels);
    centroids = recalculateCentroids(points, labels, k, dimensions, centroids);
  }

  return { labels, centroids };
}

function getMongooseModels(mongoCollection: string) {
  const clusterSchema = new mongoose.Schema({
    name: String,
    description: String,
    summary: String,
    version: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now }
  });

  const itemSchema = new mongoose.Schema({
    textId: String,
    clusterId: mongoose.Schema.Types.ObjectId,
    createdAt: { type: Date, default: Date.now }
  });

  const ClusterModel = mongoose.models[`${mongoCollection}_clusters`] || mongoose.model(`${mongoCollection}_clusters`, clusterSchema, `${mongoCollection}_clusters`);
  const ItemModel = mongoose.models[`${mongoCollection}_items`] || mongoose.model(`${mongoCollection}_items`, itemSchema, `${mongoCollection}_items`);

  return { ClusterModel, ItemModel };
}

async function getRepresentativeTexts<T extends RecordMetadata>(
  textIds: string[],
  index: Index<T>,
  namespace: string
): Promise<string[]> {
  if (!textIds || textIds.length === 0) return [];
  const limit = Math.min(textIds.length, 1000);
  const idsToFetch = textIds.slice(0, limit);
  const fetchResponse = await index.namespace(namespace).fetch({ ids: idsToFetch });
  const records = fetchResponse.records || {};

  const validRecords: {text: string, id: string}[] = [];
  const points: number[][] = [];
  for (const id of idsToFetch) {
    const record = records[id];
    if (record && record.values && record.values.length > 0 && record.metadata && typeof record.metadata.text === 'string') {
      validRecords.push({ text: record.metadata.text as string, id });
      points.push(record.values);
    }
  }

  if (points.length === 0) return [];

  const dimensions = points[0].length;
  const center = new Array(dimensions).fill(0);
  for (let d = 0; d < dimensions; d++) {
    center[d] = mean(points.map(p => p[d]));
  }

  const distances = validRecords.map((r, i) => ({
    text: r.text,
    dist: euclideanDistance(points[i], center)
  }));

  distances.sort((a, b) => a.dist - b.dist);
  const numItems = Math.max(5, Math.min(10, distances.length));
  return distances.slice(0, numItems).map(d => d.text);
}


async function fetchClusterData<T extends RecordMetadata>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ClusterModel: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ItemModel: any,
  index: Index<T>,
  namespace: string
) {
  const latestCluster = await ClusterModel.findOne().sort({ version: -1 });
  const currentVersion = latestCluster ? latestCluster.version || 1 : 1;

  const currentClusters = await ClusterModel.find({ version: currentVersion }).lean();
  const clustersData = [];

  for (const cluster of currentClusters) {
    const items = await ItemModel.find({ clusterId: cluster._id }).limit(1000).lean();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textIds = items.map((item: any) => item.textId);
    const representativeTexts = await getRepresentativeTexts(textIds, index, namespace);

    clustersData.push({
      name: cluster.name,
      description: cluster.description,
      summary: cluster.summary,
      representativeTexts
    });
  }

  return { clustersData, currentVersion };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateRefinedClusters(clustersData: any[]) {
  const prompt = `
You are an expert taxonomist. Review the following clusters and their representative texts.
Please refine them into a Mutually Exclusive, Collectively Exhaustive (MECE) set of clusters.
You may merge similar clusters or split broad clusters.
Additionally, you MUST include one cluster named "Miscellaneous/Unknown" to catch outliers.
For each cluster, provide a "name", "description", and a short "summary".

Input clusters:
${JSON.stringify(clustersData, null, 2)}

Respond ONLY with a JSON array of objects with keys: "name", "description", and "summary". Do not include markdown formatting.
`;

  const response = await gemmaGenerate(prompt, {
    model: 'gemini-3.0-flash',
    systemInstruction: "You are an expert at categorizing data. Output strictly valid JSON."
  });

  let responseText = response.text.trim();
  if (responseText.startsWith('```json')) responseText = responseText.substring(7);
  if (responseText.startsWith('```')) responseText = responseText.substring(3);
  if (responseText.endsWith('```')) responseText = responseText.slice(0, -3);

  return JSON.parse(responseText.trim());
}

export async function refineClusters<T extends RecordMetadata = RecordMetadata>(
  options: RefineClustersOptions<T>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const { mongoDb, mongoCollection, index, namespace } = options;
  const isConnected = await connectMongoose(mongoDb);
  if (!isConnected) throw new Error("Failed to connect to MongoDB");

  const { ClusterModel, ItemModel } = getMongooseModels(mongoCollection);

  const { clustersData, currentVersion } = await fetchClusterData(ClusterModel, ItemModel, index, namespace);

  if (clustersData.length === 0) return [];

  const refinedClustersData = await generateRefinedClusters(clustersData);

  const newVersion = currentVersion + 1;
  const savedClusters = [];

  for (const rc of refinedClustersData) {
    const clusterDoc = await ClusterModel.create({
      name: rc.name,
      description: rc.description,
      summary: rc.summary,
      version: newVersion
    });
    savedClusters.push(clusterDoc);
  }

  return savedClusters;
}
