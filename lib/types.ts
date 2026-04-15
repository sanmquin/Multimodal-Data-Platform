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
  indexName?: string;
  cloud?: string;
  region?: string;
}

export interface ClusterResult<T extends RecordMetadata = RecordMetadata> {
  centroid: number[];
  records: PineconeRecord<T>[];
}

export interface RetrieveAndClusterResult<T extends RecordMetadata = RecordMetadata> {
  clusters: ClusterResult<T>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pcaModel?: any;
}

export interface RetrieveAndClusterOptions<T extends RecordMetadata = RecordMetadata> {
  ids: string[];
  index: Index<T>;
  namespace: string;
  numClusters: number;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
}

export interface ClusterWithTexts {
  texts: string[];
  textIds: string[];
}

export interface NamedCluster extends ClusterWithTexts {
  name: string;
  description: string;
  summary: string;
}

export interface RefineClustersOptions<T extends RecordMetadata = RecordMetadata> {
  mongoDb: string;
  mongoCollection: string;
  index: Index<T>;
  namespace: string;
}
