import { RecordMetadata } from '@pinecone-database/pinecone';
import { EmbedOptions, NamedCluster, ClusterWithTexts } from './types';
import { embed } from './embed';
import { retrieveAndCluster } from './cluster';
import { nameClusters } from './nameClusters';
import { connectMongoose } from './mongo';
import { getMongooseModels } from './models';

export interface EmbedAndClusterOptions<T extends RecordMetadata = RecordMetadata> extends EmbedOptions<T> {
  numClusters: number;
  namespace?: string;
  skipEmbed?: boolean;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
  mongoDb?: string;
  mongoCollection?: string;
  cumulative?: boolean;
  context?: string;
  storeReducedDimensions?: boolean;
}

export async function embedAndCluster<T extends RecordMetadata = RecordMetadata>(
  options: EmbedAndClusterOptions<T>
): Promise<NamedCluster[]> {
  const { texts, index, numClusters, namespace = '', skipEmbed = false, reduceDimensions, pcaDimensions, mongoDb, mongoCollection, cumulative, context, storeReducedDimensions, ...embedOpts } = options;

  if (!skipEmbed) {
    await embed({ texts, index, ...embedOpts });
  }

  const ids = texts.map((t) => t.id);
  const { clusters, pcaModel } = await retrieveAndCluster({ ids, index, namespace, numClusters, reduceDimensions, pcaDimensions });

  const textMap = new Map<string, string>();
  for (const t of texts) {
    textMap.set(t.id, t.text);
  }

  const clustersWithTexts: ClusterWithTexts[] = clusters.map((c) => {
    const clusterTexts: string[] = [];
    const clusterTextIds: string[] = [];
    for (const record of c.records) {
      const text = textMap.get(record.id);
      if (text) {
        clusterTexts.push(text);
        clusterTextIds.push(record.id);
      }
    }
    return { texts: clusterTexts, textIds: clusterTextIds, centroid: c.centroid, reducedPoints: c.reducedPoints };
  });

  const namedClusters = await nameClusters(clustersWithTexts, { cumulative, context });

  if (mongoDb && mongoCollection && pcaModel) {
    await storeToMongo(mongoDb, mongoCollection, pcaModel, namedClusters, storeReducedDimensions);
  }

  return namedClusters;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeToMongo(mongoDb: string, mongoCollection: string, pcaModel: any, namedClusters: NamedCluster[], storeReducedDimensions?: boolean) {
  try {
    if (!(await connectMongoose(mongoDb))) return;

    const { PCAModel, ClusterModel, ItemModel } = getMongooseModels(mongoCollection);
    await PCAModel.create({ model: pcaModel && typeof pcaModel.toJSON === 'function' ? pcaModel.toJSON() : pcaModel });

    for (const nc of namedClusters) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clusterData: any = { name: nc.name, description: nc.description, summary: nc.summary };
      if (storeReducedDimensions && nc.centroid) clusterData.centroid = nc.centroid;

      const clusterDoc = await ClusterModel.create(clusterData);

      const itemDocs = nc.textIds.map((id, index) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc: any = { textId: id, clusterId: clusterDoc._id };
        if (storeReducedDimensions && nc.reducedPoints && nc.reducedPoints[index]) {
          doc.reducedDimensions = nc.reducedPoints[index];
        }
        return doc;
      });

      if (itemDocs.length > 0) await ItemModel.insertMany(itemDocs);
    }
  } catch (err) {
    console.error('Failed to store PCA model and clusters to Mongo:', err);
  }
}
