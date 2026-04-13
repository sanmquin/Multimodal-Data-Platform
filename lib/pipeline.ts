import { RecordMetadata } from '@pinecone-database/pinecone';
import { EmbedOptions, NamedCluster, ClusterWithTexts } from './types';
import { embed } from './embed';
import { retrieveAndCluster } from './cluster';
import { nameClusters } from './nameClusters';
import { getMongoClient } from './mongo';
import * as bson from 'bson';

export interface PipelineOptions<T extends RecordMetadata = RecordMetadata> extends EmbedOptions<T> {
  numClusters: number;
  namespace?: string;
  skipEmbed?: boolean;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
  mongoDb?: string;
  mongoCollection?: string;
}

export async function processPipeline<T extends RecordMetadata = RecordMetadata>(
  options: PipelineOptions<T>
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
    for (const record of c.records) {
      const text = textMap.get(record.id);
      if (text) {
        clusterTexts.push(text);
      }
    }
    return { texts: clusterTexts };
  });

  const namedClusters = await nameClusters(clustersWithTexts);

  if (mongoDb && mongoCollection && pcaModel) {
    try {
      const client = await getMongoClient();
      if (client) {
        const db = client.db(mongoDb);
        const coll = db.collection(mongoCollection);
        const pcaModelBson = bson.serialize(pcaModel);
        await coll.insertOne({
          pcaModelBson,
          clusters: namedClusters,
          createdAt: new Date()
        });
      }
    } catch (err) {
      console.error('Failed to store PCA model and clusters to Mongo:', err);
    }
  }

  return namedClusters;
}
