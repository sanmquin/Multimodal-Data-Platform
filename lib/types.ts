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

export interface ClusterWithTexts {
  texts: string[];
}

export interface NamedCluster extends ClusterWithTexts {
  name: string;
  description: string;
  summary: string;
}
