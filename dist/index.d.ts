import { Index, RecordMetadata } from '@pinecone-database/pinecone';
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
    embedder: (texts: string[]) => Promise<number[][]>;
    batchSize?: number;
}
/**
 * Embeds texts and stores them in a Pinecone index if they do not already exist.
 *
 * @param options - The embed options.
 * @returns Statistics about the operation: number of successful writes, errors, and elapsed time in milliseconds.
 */
export declare function embed<T extends RecordMetadata = RecordMetadata>(options: EmbedOptions<T>): Promise<EmbedStats>;
