# Multimodal-Data-Platform

A simple TypeScript utility library designed to embed and batch-upsert textual data into a Pinecone vector database. The library batches inserts, deduplicates items (by checking existing IDs first via `fetch`), and gracefully catches errors.

## Cloud API Deployment (Netlify)

The library powers a cloud API deployed to Netlify via a Serverless Function.

### Deployment Setup

1. **Environment Variables**: In your Netlify dashboard, you must set the `PINECONE_API_KEY` environment variable. You can also optionally set `PINECONE_INDEX`.
2. **Build Configuration**: Ensure that your Netlify build command compiles the TypeScript function (e.g. `npm run build`), or Netlify will automatically build files in `netlify/functions`.

### API Usage

The endpoint is available at `POST /.netlify/functions/embed`.

**Request Body**
```json
{
  "texts": [
    { "id": "1", "text": "Hello world" }
  ],
  "batchSize": 50
}
```

## Installation

```bash
npm install multimodal-data-platform
```

You'll also need the `@pinecone-database/pinecone` client installed in your project:
```bash
npm install @pinecone-database/pinecone
```

## Quick Start

The main function is `embed`, which handles chunking texts, checking against Pinecone, and passing the text over to a custom `embedder` function.

### Example with Pinecone Inference

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { embed, EmbedOptions } from 'multimodal-data-platform';

async function run() {
  const pc = new Pinecone({ apiKey: 'YOUR_PINECONE_API_KEY' });
  const index = pc.index('my-index');

  const textsToEmbed = [
    { id: '1', text: 'Hello world', metadata: { source: 'user' } },
    { id: '2', text: 'Embedding texts is fun!', metadata: { source: 'system' } },
  ];

  const stats = await embed({
    index,
    texts: textsToEmbed,
    batchSize: 50,
    embedder: async (texts) => {
      // Use Pinecone Inference for embedding
      const embeddings = await pc.inference.embed({
        model: 'multilingual-e5-large',
        inputs: texts,
        parameters: {
          inputType: 'passage',
          truncate: 'END'
        }
      });
      // Extract numeric values from Pinecone's inference response
      return embeddings.data.map(d => d.values);
    }
  });

  console.log(`Embed completed in ${stats.elapsedMs}ms. Writes: ${stats.writes}, Errors: ${stats.errors}`);
}
```

### Example with OpenAI

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { embed } from 'multimodal-data-platform';

async function run() {
  const pc = new Pinecone({ apiKey: 'YOUR_PINECONE_API_KEY' });
  const index = pc.index('my-index');
  const openai = new OpenAI({ apiKey: 'YOUR_OPENAI_API_KEY' });

  const textsToEmbed = [
    { id: '1', text: 'Hello world' },
  ];

  const stats = await embed({
    index,
    texts: textsToEmbed,
    batchSize: 100,
    embedder: async (texts) => {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });
      return response.data.map(d => d.embedding);
    }
  });

  console.log(stats);
}
```

## Agentic Documentation

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
3. **Chunking Mechanism:** The function batches incoming objects arrays according to `batchSize` (default: `50`).
4. **Error Handling:** If an error occurs in a given batch (e.g., embedding provider timeout, Pinecone API 502), the error is caught, `stats.errors` increments by the size of that batch, and the process continues onto the next batch without halting.
5. **Generics:** By passing `Index<YourType>`, you preserve Pinecone generic type assertions in case you require strict type checking for existing metadata structure mappings.
