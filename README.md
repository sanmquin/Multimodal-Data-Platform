# Multimodal-Data-Platform

The Multimodal Data Platform is an intelligent data-ingestion service that takes plain text and seamlessly transforms it into searchable, embedded vectors stored in a Pinecone vector database. Designed with scale and resilience in mind, it handles the heavy lifting of deduplication, batching, and error recovery so you can focus on building intelligent applications.

## Why Use This Platform?

*   **Automated Deduplication**: It verifies against the database before generating expensive embeddings to save you money and compute.
*   **Built-in Batching**: Automatically groups your text chunks to abide by rate limits and optimize throughput.
*   **Error Resiliency**: Gracefully skips over failures in one batch to ensure the rest of your data gets processed.
*   **Versatile API**: We provide a cloud API ready to handle your texts, or you can leverage our core library directly.

## Using the Cloud API

The easiest way to consume the platform is via our hosted Serverless API. Send your text data in a single POST request and we'll handle the rest.

### Endpoint

`POST https://<YOUR_NETLIFY_DOMAIN>.netlify.app/.netlify/functions/embed`

### Request Format

```json
{
  "texts": [
    { "id": "1", "text": "This is a document about machine learning." },
    { "id": "2", "text": "Another text to be embedded seamlessly." }
  ],
  "batchSize": 50,
  "indexName": "your-target-index",
  "namespace": "your-namespace"
}
```

*Note: The API is authenticated. The deployment environment must be configured with a valid `PINECONE_API_KEY` environment variable.*

---

## Direct Library Usage

If you prefer to integrate the logic directly into your own infrastructure, the platform is also available as an NPM package.

```bash
npm install multimodal-data-platform
npm install @pinecone-database/pinecone
```

### Sample Code & Agent Prompt

Copy the block below and provide it to your LLM or automated agent. It includes the sample integration code and the necessary context (interfaces and behavioral guarantees) for the agent to reason about the library effectively.

```typescript
/**
 * MULTIMODAL DATA PLATFORM - AGENTIC DOCUMENTATION
 *
 * Interface Signatures:
 *
 * import { Index, RecordMetadata } from '@pinecone-database/pinecone';
 *
 * export interface TextRecord {
 *   id: string; // The unique identifier for the text snippet
 *   text: string; // The text content to embed
 *   metadata?: RecordMetadata; // Optional Pinecone-compatible metadata
 * }
 *
 * export interface EmbedStats {
 *   writes: number;    // Number of records successfully inserted into Pinecone
 *   errors: number;    // Number of records that failed during processing
 *   elapsedMs: number; // Total processing time in milliseconds
 * }
 *
 * export interface EmbedOptions<T extends RecordMetadata = RecordMetadata> {
 *   index: Index<T>;  // Instance of the configured Pinecone Index target
 *   texts: TextRecord[]; // List of texts to check and embed
 *   embedder: (texts: string[]) => Promise<number[][]>; // External provider callback generating vectors
 *   batchSize?: number; // Size per chunk (defaults to 50)
 * }
 *
 * Behavioral Guarantees:
 * 1. Deduplication: For each chunk, the library calls `index.fetch(ids)`. Items that already exist in the index are skipped to prevent redundant embedding computation and token usage.
 * 2. Metadata Injection: The `text` field from the `TextRecord` is automatically injected into the inserted vector's `metadata`. Thus, the inserted metadata object becomes `{ ...metadata, text }`.
 * 3. Chunking Mechanism: The function batches incoming objects arrays according to `batchSize` (default: 50).
 * 4. Error Handling: If an error occurs in a given batch (e.g., embedding provider timeout, Pinecone API 502), the error is caught, `stats.errors` increments by the size of that batch, and the process continues onto the next batch without halting.
 * 5. Generics: By passing `Index<YourType>`, you preserve Pinecone generic type assertions in case you require strict type checking for existing metadata structure mappings.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { embed } from 'multimodal-data-platform';

async function run() {
  const pc = new Pinecone({ apiKey: 'YOUR_PINECONE_API_KEY' });
  const indexName = 'my-index';
  const namespace = 'my-namespace';

  const index = pc.index(indexName).namespace(namespace);

  const stats = await embed({
    index: index as any,
    texts: [
      { id: '1', text: 'Hello world', metadata: { source: 'user' } },
    ],
    batchSize: 50,
    embedder: async (texts) => {
      // Use Pinecone Inference for embedding
      const embeddings = await pc.inference.embed({
        model: 'multilingual-e5-large',
        inputs: texts,
        parameters: { inputType: 'passage', truncate: 'END' }
      });
      return embeddings.data.map(d => d.values);
    }
  });

  console.log(`Embed completed in ${stats.elapsedMs}ms. Writes: ${stats.writes}`);
}
```

## Developer Guide & Deployment

For detailed instructions on setting up your local environment, creating your Pinecone index, or deploying the Cloud API to your own Netlify account, please see our [Development Guide](docs/development.md).
