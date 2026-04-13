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

`POST /.netlify/functions/embed`

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

### Quick Example (Pinecone Inference)

```typescript
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

### Using Gemma Models

You can use the built-in `gemmaGenerate` utility function to interact with Gemma 3 and 4 models natively using the Gemini API. Ensure you have the `GEMINI_API_KEY` environment variable set.

```typescript
import { gemmaGenerate } from 'multimodal-data-platform';

async function generate() {
  const response = await gemmaGenerate("Explain vector databases simply.", {
    model: "gemma-4-26b-a4b-it",
    systemInstruction: "You are an expert technical teacher."
  });
  console.log(response.text);
}
```

## Developer Guide & Deployment

For detailed instructions on setting up your local environment, creating your Pinecone index, or deploying the Cloud API to your own Netlify account, please see our [Development Guide](docs/development.md).
