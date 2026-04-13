# Library Usage

This library allows you to embed text and store it in Pinecone efficiently. It deduplicates automatically and batches the upserts.

## Cloud API (Netlify Function)

A deployed instance of this library is available as a Netlify function. You can make an HTTP POST request to:

`POST {{DOMAIN}}/.netlify/functions/embed`

### Payload structure

```json
{
  "texts": [
    { "id": "1", "text": "Testing the cloud version." }
  ],
  "batchSize": 50,
  "indexName": "your-target-index",
  "namespace": "your-namespace"
}
```

### Environment Setup

The function depends on the `PINECONE_API_KEY` environment variable inside Netlify to authorize against Pinecone.

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

````text
Please write code to integrate the multimodal data platform API.

# Multimodal Data Platform - Agentic Documentation

If you are an LLM agent or automated tooling trying to reason about how this package works, refer to the following structure and behavior guarantees.

### Interface Signatures

```typescript
import { Index, RecordMetadata } from '@pinecone-database/pinecone';

export interface TextRecord {
  id: string; // The unique identifier for the text snippet
  text: string; // The text content to embed
  metadata?: RecordMetadata; // Optional Pinecone-compatible metadata
}

export interface EmbedStats {
  writes: number;    // Number of records successfully inserted into Pinecone
  errors: number;    // Number of records that failed during processing
  elapsedMs: number; // Total processing time in milliseconds
}

export interface EmbedOptions<T extends RecordMetadata = RecordMetadata> {
  index: Index<T>;  // Instance of the configured Pinecone Index target
  texts: TextRecord[]; // List of texts to check and embed
  embedder: (texts: string[]) => Promise<number[][]>; // External provider callback generating vectors
  batchSize?: number; // Size per chunk (defaults to 50)
}
```

### Behavioral Guarantees

1. **Deduplication:** For each chunk, the library calls `index.fetch(ids)`. Items that already exist in the index are skipped to prevent redundant embedding computation and token usage.
2. **Metadata Injection:** The `text` field from the `TextRecord` is automatically injected into the inserted vector's `metadata`. Thus, the inserted metadata object becomes `{ ...metadata, text }`.
3. **Chunking Mechanism:** The function batches incoming objects arrays according to `batchSize` (default: 50).
4. **Error Handling:** If an error occurs in a given batch (e.g., embedding provider timeout, Pinecone API 502), the error is caught, `stats.errors` increments by the size of that batch, and the process continues onto the next batch without halting.
5. **Generics:** By passing `Index<YourType>`, you preserve Pinecone generic type assertions in case you require strict type checking for existing metadata structure mappings.
````
<button id="copy-agent-btn" class="button is-small is-link mt-2">Copy Instructions</button>
