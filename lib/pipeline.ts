import { RecordMetadata } from '@pinecone-database/pinecone';
import { EmbedOptions, NamedCluster, ClusterWithTexts } from './types';
import { embed } from './embed';
import { retrieveAndCluster } from './cluster';
import { nameClusters } from './nameClusters';

export interface PipelineOptions<T extends RecordMetadata = RecordMetadata> extends EmbedOptions<T> {
  numClusters: number;
  namespace?: string;
  skipEmbed?: boolean;
}

export async function processPipeline<T extends RecordMetadata = RecordMetadata>(
  options: PipelineOptions<T>
): Promise<NamedCluster[]> {
  const { texts, index, numClusters, namespace = '', skipEmbed = false, ...embedOpts } = options;

  if (!skipEmbed) {
    await embed({ texts, index, ...embedOpts });
  }

  const ids = texts.map((t) => t.id);
  const clusters = await retrieveAndCluster({ ids, index, namespace, numClusters });

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

  return namedClusters;
}
