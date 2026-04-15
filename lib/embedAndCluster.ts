import { RecordMetadata } from '@pinecone-database/pinecone';
import { EmbedOptions, NamedCluster, ClusterWithTexts } from './types';
import { embed } from './embed';
import { retrieveAndCluster } from './cluster';
import { nameClusters } from './nameClusters';
import { connectMongoose } from './mongo';
import mongoose from 'mongoose';

export interface EmbedAndClusterOptions<T extends RecordMetadata = RecordMetadata> extends EmbedOptions<T> {
  numClusters: number;
  namespace?: string;
  skipEmbed?: boolean;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
  mongoDb?: string;
  mongoCollection?: string;
}

export async function embedAndCluster<T extends RecordMetadata = RecordMetadata>(
  options: EmbedAndClusterOptions<T>
): Promise<NamedCluster[]> {
  const { texts, index, numClusters, namespace = '', skipEmbed = false, reduceDimensions, pcaDimensions, mongoDb, mongoCollection, ...embedOpts } = options;

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
    return { texts: clusterTexts, textIds: clusterTextIds };
  });

  const namedClusters = await nameClusters(clustersWithTexts);

  if (mongoDb && mongoCollection && pcaModel) {
    await storeToMongo(mongoDb, mongoCollection, pcaModel, namedClusters);
  }

  return namedClusters;
}

function getModels(mongoCollection: string) {
  const pcaSchema = new mongoose.Schema({
    modelBuffer: Buffer,
    createdAt: { type: Date, default: Date.now }
  });
  const clusterSchema = new mongoose.Schema({
    name: String,
    description: String,
    summary: String,
    version: { type: Number, default: 1 },
    centroid: [Number],
    createdAt: { type: Date, default: Date.now }
  });
  const itemSchema = new mongoose.Schema({
    textId: String,
    clusterId: mongoose.Schema.Types.ObjectId,
    reducedDimensions: [Number],
    createdAt: { type: Date, default: Date.now }
  });
  const PCAModel = mongoose.models[`${mongoCollection}_pca`] || mongoose.model(`${mongoCollection}_pca`, pcaSchema, `${mongoCollection}_pca`);
  const ClusterModel = mongoose.models[`${mongoCollection}_clusters`] || mongoose.model(`${mongoCollection}_clusters`, clusterSchema, `${mongoCollection}_clusters`);
  const ItemModel = mongoose.models[`${mongoCollection}_items`] || mongoose.model(`${mongoCollection}_items`, itemSchema, `${mongoCollection}_items`);

  return { PCAModel, ClusterModel, ItemModel };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeToMongo(mongoDb: string, mongoCollection: string, pcaModel: any, namedClusters: NamedCluster[]) {
  try {
    const isConnected = await connectMongoose(mongoDb);
    if (!isConnected) return;

    const { PCAModel, ClusterModel, ItemModel } = getModels(mongoCollection);

    const pcaString = JSON.stringify(pcaModel);
    await PCAModel.create({ modelBuffer: Buffer.from(pcaString, 'utf-8') });

    for (const nc of namedClusters) {
      const clusterDoc = await ClusterModel.create({
        name: nc.name,
        description: nc.description,
        summary: nc.summary
      });

      const itemDocs = nc.textIds.map(id => ({
        textId: id,
        clusterId: clusterDoc._id
      }));

      if (itemDocs.length > 0) {
        await ItemModel.insertMany(itemDocs);
      }
    }
  } catch (err) {
    console.error('Failed to store PCA model and clusters to Mongo:', err);
  }
}
