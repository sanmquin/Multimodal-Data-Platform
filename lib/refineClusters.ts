import { RecordMetadata, Index } from '@pinecone-database/pinecone';
import { RefineClustersOptions } from './types';
import { connectMongoose } from './mongo';
import { getMongooseModels } from './models';
import { geminiGenerateJson } from './gemini';
import { mean } from 'simple-statistics';
import { euclideanDistance } from './utils';

async function getRepresentativeTexts<T extends RecordMetadata>(
  items: { textId: string, reducedPoints?: number[] }[],
  index: Index<T>,
  namespace: string,
  centroid?: number[]
): Promise<string[]> {
  if (!items || items.length === 0) return [];

  const hasAllReducedPoints = items.every(i => i.reducedPoints && i.reducedPoints.length > 0);

  let topIds: string[];
  if (centroid && centroid.length > 0 && hasAllReducedPoints) {
    const dists = items.map(i => ({ id: i.textId, d: euclideanDistance(i.reducedPoints!, centroid) }));
    dists.sort((a, b) => a.d - b.d);
    topIds = dists.slice(0, Math.max(5, Math.min(10, dists.length))).map(x => x.id);
  } else {
    const idsToFetch = items.map(i => i.textId).slice(0, Math.min(items.length, 1000));
    const { records = {} } = await index.namespace(namespace).fetch({ ids: idsToFetch });

    const pts: number[][] = [];
    const valid: {id: string, text: string}[] = [];
    for (const id of idsToFetch) {
      if (records[id]?.values?.length && typeof records[id].metadata?.text === 'string') {
        pts.push(records[id].values);
        valid.push({ id, text: records[id].metadata!.text as string });
      }
    }
    if (pts.length === 0) return [];

    const center = new Array(pts[0].length).fill(0).map((_, d) => mean(pts.map(p => p[d])));
    const dists = valid.map((r, i) => ({ id: r.id, d: euclideanDistance(pts[i], center) }));
    dists.sort((a, b) => a.d - b.d);
    topIds = dists.slice(0, Math.max(5, Math.min(10, dists.length))).map(x => x.id);
  }

  if (topIds.length === 0) return [];
  const fetchResponse = await index.namespace(namespace).fetch({ ids: topIds });
  const records = fetchResponse.records || {};
  return topIds.filter(id => records[id]?.metadata?.text)
               .map(id => records[id].metadata!.text as string);
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
    const mappedItems = items.map((item: any) => ({
      textId: item.textId,
      reducedPoints: item.reducedDimensions
    }));
    const representativeTexts = await getRepresentativeTexts(mappedItems, index, namespace, cluster.centroid);

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
`;

  const schema = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: "ARRAY" as any,
    items: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: "OBJECT" as any,
      properties: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: { type: "STRING" as any },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: { type: "STRING" as any },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        summary: { type: "STRING" as any }
      },
      required: ["name", "description", "summary"]
    }
  };

  const response = await geminiGenerateJson(prompt, schema, {
    model: 'gemini-3.0-flash',
    systemInstruction: "You are an expert at categorizing data."
  });

  return response;
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
