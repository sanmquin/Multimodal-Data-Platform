# Multimodal-Data-Platform

The Multimodal Data Platform is an intelligent data processing service that takes plain text and transforms it into searchable, embedded vectors, semantic clusters, and quantified feature models stored in Pinecone and MongoDB. Designed with scale and resilience in mind, it handles deduplication, batching, PCA dimensionality reduction, generative AI cluster naming, feature extraction, regression modelling, and performance correlation — so you can focus on building intelligent applications.

## Why Use This Platform?

*   **Automated Deduplication**: Verifies against the database before generating expensive embeddings, saving compute and cost.
*   **Built-in Batching**: Automatically groups text chunks to respect rate limits and optimise throughput.
*   **Error Resiliency**: Gracefully skips failures in one batch so the rest of your data is always processed.
*   **Semantic Clustering**: Clusters embedded texts with k-means and PCA, then names each cluster using a Gemma LLM.
*   **MECE Cluster Refinement**: Re-generates cluster taxonomies that are Mutually Exclusive and Collectively Exhaustive using Gemini.
*   **Feature Modelling**: Extracts semantic features from a corpus, scores each text against those features, and trains a linear regression model per feature to predict scores from embeddings.
*   **Performance Explanation**: Correlates predicted feature scores against any numeric output metric using Pearson correlation.
*   **Versatile API**: A cloud API on Netlify handles all of the above, or you can integrate the core library directly.

---

## Cloud API Endpoints

The platform exposes the following Netlify serverless endpoints. All endpoints handle CORS and `OPTIONS` preflight requests automatically.

| Endpoint | Mode | Description |
|---|---|---|
| `POST /.netlify/functions/embed` | Synchronous | Embed texts into Pinecone with optional PCA + MongoDB persistence. |
| `POST /.netlify/functions/cluster` | Async (202) | Embed, cluster, name clusters with Gemma, save to MongoDB. |
| `POST /.netlify/functions/refine-clusters` | Async (202) | Re-generate a MECE cluster taxonomy using Gemini. |
| `POST /.netlify/functions/features` | Async (202) | Extract features, evaluate texts, train regression models, save to MongoDB. |
| `POST /.netlify/functions/feature-inference` | Synchronous | Score new texts against saved feature models. |
| `POST /.netlify/functions/explain-performance` | Synchronous | Pearson-correlate feature predictions against a numeric output metric. |

*All endpoints require `PINECONE_API_KEY`. AI endpoints (cluster, refine-clusters, features) also require `GEMINI_API_KEY`. MongoDB persistence requires `MONGO_URI`.*

### Embed – Quick Example

```json
POST /.netlify/functions/embed
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

For full request/response schemas for every endpoint, see the [docs/](docs/) folder or open the hosted playground.

---

## Direct Library Usage

Install the platform as an NPM package to integrate the logic directly into your own infrastructure.

```bash
npm install multimodal-data-platform
npm install @pinecone-database/pinecone
```

### Embed texts into Pinecone

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { embed } from 'multimodal-data-platform';

const pc = new Pinecone({ apiKey: 'YOUR_PINECONE_API_KEY' });
const index = pc.index('my-index').namespace('my-namespace');

const stats = await embed({
  index: index as any,
  texts: [{ id: '1', text: 'Hello world', metadata: { source: 'user' } }],
  batchSize: 50,
  pc,
  model: 'multilingual-e5-large',
});

console.log(`Embed completed in ${stats.elapsedMs}ms. Writes: ${stats.writes}`);
```

### Cluster texts

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { embedAndCluster } from 'multimodal-data-platform';

const pc = new Pinecone({ apiKey: 'YOUR_PINECONE_API_KEY' });
const index = pc.index('my-index');

const namedClusters = await embedAndCluster({
  texts: [
    { id: '1', text: 'Machine learning requires maths.' },
    { id: '2', text: 'Cloud infrastructure scales automatically.' },
    { id: '3', text: 'Deep learning powers modern AI.' },
  ],
  index: index as any,
  pc,
  model: 'multilingual-e5-large',
  numClusters: 2,
  namespace: 'my-namespace',
  mongoDb: 'my_db',
  mongoCollection: 'my_clusters',
  storeReducedDimensions: true,
});

namedClusters.forEach(c => console.log(c.name, '-', c.summary));
```

### Extract and model features from a corpus

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { featurePipeline } from 'multimodal-data-platform';

const pc = new Pinecone({ apiKey: 'YOUR_PINECONE_API_KEY' });

const result = await featurePipeline({
  texts: [
    { id: '1', text: 'Learning algorithms require data.' },
    { id: '2', text: 'Scaling infra requires planning.' },
  ],
  pc,
  model: 'multilingual-e5-large',
  categoryId: 'batch-2024-q1',
  mongoDb: 'my_db',
  mongoCollection: 'my_features',
});

console.log('Features found:', result.features.map(f => f.name));
```

### Predict feature scores for new texts

```typescript
import { featureInference } from 'multimodal-data-platform';

const evaluations = await featureInference({
  texts: [{ id: '3', text: 'Neural networks mimic the brain.' }],
  mongoDb: 'my_db',
  mongoCollection: 'my_features',
  categoryId: 'batch-2024-q1',
  pc,
  model: 'multilingual-e5-large',
});
```

### Correlate features against an outcome

```typescript
import { explainPerformance } from 'multimodal-data-platform';

const result = await explainPerformance({
  texts: [
    { id: '1', text: 'Learning algorithms require data.', output: 85 },
    { id: '2', text: 'Scaling infra requires planning.', output: 90 },
  ],
  featureName: 'Technical Complexity',
  mongoDb: 'my_db',
  mongoCollection: 'my_features',
  categoryId: 'batch-2024-q1',
  pc,
  model: 'multilingual-e5-large',
});

console.log('Pearson correlation:', result.correlation);
```

### Using Gemma and Gemini models directly

```typescript
import { gemmaGenerate, geminiGenerateJson } from 'multimodal-data-platform';

// Free-text generation with Gemma
const response = await gemmaGenerate('Explain vector databases simply.', {
  model: 'gemma-4-26b-a4b-it',
  systemInstruction: 'You are an expert technical teacher.',
});
console.log(response.text);

// Structured JSON generation with Gemini
const json = await geminiGenerateJson(
  'List three machine learning use-cases.',
  { type: 'ARRAY' as any, items: { type: 'STRING' as any } }
);
console.log(json);
```

---

## Developer Guide & Deployment

For detailed instructions on setting up your local environment, creating your Pinecone index, configuring MongoDB, or deploying the Cloud API to your own Netlify account, please see our [Development Guide](docs/development.md).
