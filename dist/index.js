"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embed = embed;
/**
 * Batches an array into smaller arrays of a specified size.
 */
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
/**
 * Embeds texts and stores them in a Pinecone index if they do not already exist.
 *
 * @param options - The embed options.
 * @returns Statistics about the operation: number of successful writes, errors, and elapsed time in milliseconds.
 */
async function embed(options) {
    const { index, texts, embedder, batchSize = 50 } = options;
    const startTime = Date.now();
    let writes = 0;
    let errors = 0;
    if (!texts || texts.length === 0) {
        return { writes, errors, elapsedMs: Date.now() - startTime };
    }
    const batches = chunkArray(texts, batchSize);
    for (const batch of batches) {
        try {
            const batchIds = batch.map((r) => r.id);
            // Check which IDs already exist
            const fetchResponse = await index.fetch({ ids: batchIds });
            const existingIds = new Set(Object.keys(fetchResponse.records || {}));
            // Filter for missing texts
            const missingRecords = batch.filter((r) => !existingIds.has(r.id));
            if (missingRecords.length > 0) {
                // Embed the missing texts
                const textsToEmbed = missingRecords.map((r) => r.text);
                const embeddings = await embedder(textsToEmbed);
                if (embeddings.length !== missingRecords.length) {
                    throw new Error(`Embedder returned ${embeddings.length} embeddings for ${missingRecords.length} texts.`);
                }
                // Prepare vectors for Pinecone
                const vectors = missingRecords.map((record, i) => ({
                    id: record.id,
                    values: embeddings[i],
                    metadata: {
                        ...record.metadata,
                        text: record.text,
                    },
                }));
                // Upsert to Pinecone
                await index.upsert({ records: vectors });
                writes += missingRecords.length;
            }
        }
        catch (err) {
            console.error('Error processing batch:', err);
            errors += batch.length; // Assuming the whole batch failed if an error occurred during embed/upsert
        }
    }
    const elapsedMs = Date.now() - startTime;
    return { writes, errors, elapsedMs };
}
