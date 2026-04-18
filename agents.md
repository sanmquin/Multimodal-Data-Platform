# Multimodal Data Platform - Agentic Documentation

This document provides a complete technical reference for AI agents planning and implementing new features. It covers architecture, all public APIs, exported library functions, data models, environment variables, and coding conventions.

---

## Platform Overview

The Multimodal Data Platform is a TypeScript library and cloud API (Netlify serverless functions) that provides:

1. **Text Embedding & Storage** – Embeds plain text with Pinecone Inference and upserts vectors into a Pinecone index. Includes auto-deduplication and batching.
2. **Clustering** – Retrieves existing vectors from Pinecone, reduces their dimensionality with PCA, and groups them with k-means. Uses a Gemma LLM to generate human-readable cluster names, descriptions, and summaries.
3. **Cluster Refinement** – Re-reads existing cluster definitions from MongoDB, feeds representative texts to Gemini, and produces a new Mutually Exclusive, Collectively Exhaustive (MECE) taxonomy at a higher version number.
4. **Feature Extraction & Evaluation** – Uses Gemma to extract semantic features from a text corpus, then numerically scores each text against those features (0–100). Trains a per-feature multivariate linear regression model that predicts feature scores from embeddings.
5. **Feature Inference** – Loads a saved PCA model and the per-feature regression models from MongoDB to score new texts without needing a generative AI call.
6. **Performance Explanation** – Correlates predicted feature scores against a numeric output metric (e.g., a test score) using Pearson correlation to explain what features drive performance.
7. **React Playground** – A browser UI (`app/app.tsx`) that renders the `docs/` markdown files, lets users configure parameters in `localStorage`, and copies agent-ready prompts.

---

## Repository Structure

```
/
├── lib/                        # Core TypeScript library (exported as npm package)
│   ├── types.ts                # All shared interfaces & types
│   ├── index.ts                # Re-exports everything in lib/
│   ├── embed.ts                # embed() function
│   ├── cluster.ts              # retrieveAndCluster() function
│   ├── nameClusters.ts         # nameClusters() function (Gemma)
│   ├── embedAndCluster.ts      # embedAndCluster() high-level pipeline
│   ├── embedAndReduce.ts       # embedAndReduce() function
│   ├── refineClusters.ts       # refineClusters() function (Gemini)
│   ├── describeFeatures.ts     # describeFeatures() function (Gemma)
│   ├── evaluateFeatures.ts     # evaluateFeatures() function (Gemma)
│   ├── gemma.ts                # gemmaGenerate() utility
│   ├── gemini.ts               # geminiGenerateJson() utility
│   ├── models.ts               # Mongoose schema factories
│   ├── mongo.ts                # connectMongoose() utility
│   ├── prompts.ts              # LLM prompt templates + getPrompt()
│   ├── utils.ts                # chunkArray, customKMeans, applyPCAIfRequested, euclideanDistance
│   └── pipelines/
│       ├── index.ts            # Re-exports all pipelines
│       ├── featurePipeline.ts  # featurePipeline() orchestration
│       ├── featureInference.ts # featureInference() function
│       └── explainPerformance.ts # explainPerformance() function
├── netlify/functions/          # Serverless API endpoints
│   ├── embed.ts                # POST /embed
│   ├── cluster.ts              # POST /cluster (validates, triggers background)
│   ├── cluster-background.ts   # Background: runs embedAndCluster
│   ├── refine-clusters.ts      # POST /refine-clusters (validates, triggers background)
│   ├── refine-clusters-background.ts  # Background: runs refineClusters
│   ├── features.ts             # POST /features (validates, triggers background)
│   ├── features-background.ts  # Background: runs featurePipeline
│   ├── feature-inference.ts    # POST /feature-inference (synchronous)
│   └── explain-performance.ts  # POST /explain-performance (synchronous)
├── app/
│   └── app.tsx                 # React playground frontend
├── docs/                       # Markdown API documentation (rendered in playground)
│   ├── embed.md
│   ├── cluster.md
│   ├── refine-clusters.md
│   ├── features.md
│   ├── feature-inference.md
│   └── explain-performance.md
├── scripts/build.js            # esbuild script (compiles lib + React app + docs → public/)
├── netlify.toml                # Netlify build & function configuration
├── tsconfig.json
├── eslint.config.mjs
└── package.json
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PINECONE_API_KEY` | Yes | Authenticates Pinecone client for embedding and vector operations. |
| `PINECONE_INDEX` | Optional | Default index name. Can be overridden per-request via `indexName`. |
| `GEMINI_API_KEY` | Yes (for AI features) | Authenticates both `gemmaGenerate` (Gemma models) and `geminiGenerateJson` (Gemini models). |
| `MONGO_URI` | Optional | MongoDB connection string. Required for any persistence to MongoDB (embeddings, clusters, features, evaluations, performance). |

---

## Core Library – Exported Functions

All functions below are exported from `lib/index.ts` and available via the npm package.

### `embed(options: EmbedOptions): Promise<EmbedStats>`

Embeds an array of text records into a Pinecone index. Deduplicates by fetching existing IDs first.

- **`EmbedOptions`**:
  - `index` (required): A Pinecone `Index` object (namespaced or not).
  - `texts` (required): `TextRecord[]` – `{ id, text, metadata? }`.
  - `embedder` (optional): Custom embedding function `(texts: string[]) => Promise<number[][]>`. If omitted, uses Pinecone Inference with `pc` and `model`.
  - `pc` (optional): `Pinecone` client instance.
  - `model` (optional): Pinecone Inference model name (default: `'multilingual-e5-large'`).
  - `batchSize` (optional, default `50`): Number of records per batch.
  - `indexName` (optional): Used to auto-create the index if it doesn't exist.
  - `cloud`, `region` (optional): Used when auto-creating the index.
  - `returnEmbeddings` (optional): If `true`, the returned `EmbedStats` includes an `embeddings` field.
- **`EmbedStats`**: `{ writes, errors, elapsedMs, embeddings? }`.

---

### `retrieveAndCluster(options: RetrieveAndClusterOptions): Promise<RetrieveAndClusterResult>`

Fetches vectors from Pinecone by ID, optionally reduces dimensions with PCA, and clusters with k-means.

- **`RetrieveAndClusterOptions`**:
  - `ids` (required): `string[]` of Pinecone record IDs to fetch.
  - `index` (required): Pinecone `Index`.
  - `namespace` (required): Pinecone namespace.
  - `numClusters` (required): Number of k-means clusters.
  - `reduceDimensions` (optional, default `true`): Apply PCA before clustering.
  - `pcaDimensions` (optional, default `20`): Target PCA output dimensions.
- **`RetrieveAndClusterResult`**: `{ clusters: ClusterResult[], pcaModel? }`. Each `ClusterResult` has `{ centroid, records, reducedPoints? }`.

---

### `nameClusters(clusters, options): Promise<(T & NamedCluster)[]>`

Sorts clusters by size (descending) and calls Gemma to generate a `name`, `description`, and `summary` for each.

- `options.cumulative` (optional, default `false`): Pass previous cluster definitions into the next cluster's prompt to avoid duplicate names.
- `options.context` (optional): Custom text prepended to each naming prompt.

---

### `embedAndCluster(options: EmbedAndClusterOptions): Promise<NamedCluster[]>`

High-level pipeline: embeds texts (unless `skipEmbed` is true), clusters, names clusters with Gemma, and optionally persists to MongoDB.

- Extends `EmbedOptions` with: `numClusters`, `namespace`, `skipEmbed`, `reduceDimensions`, `pcaDimensions`, `mongoDb`, `mongoCollection`, `cumulative`, `context`, `storeReducedDimensions`.
- If `mongoDb` and `mongoCollection` are provided, saves PCA model to `[prefix]_pca`, clusters to `[prefix]_clusters`, and item assignments to `[prefix]_items`.

---

### `embedAndReduce(options: EmbedAndReduceOptions): Promise<EmbedAndReduceResult>`

Generates embeddings for texts (via Pinecone index or direct inference) and optionally reduces their dimensionality with PCA.

- **`EmbedAndReduceOptions`**: `texts`, `embedder?`, `pc?`, `model?`, `reduceDimensions?` (default `true`), `pcaDimensions?` (default `20`), `index?`, `indexName?`, `namespace?`, `cloud?`, `region?`.
- **`EmbedAndReduceResult`**: `{ points, reducedPoints, pcaModelJson, stats? }`.

---

### `refineClusters(options: RefineClustersOptions): Promise<any[]>`

Reads the latest cluster version from MongoDB, selects representative texts (using stored `reducedDimensions` and centroids if available, otherwise queries Pinecone), and calls Gemini Flash to produce a refined MECE taxonomy at `version + 1`.

- **`RefineClustersOptions`**: `mongoDb`, `mongoCollection`, `index`, `namespace`.

---

### `describeFeatures(texts: string[]): Promise<Feature[]>`

Sends texts to Gemma and returns a JSON array of `{ name, description }` feature objects.

---

### `evaluateFeatures(texts: string[], features: Feature[]): Promise<TextFeatureEvaluation[]>`

Processes texts in batches of 10. For each batch, sends the texts and features to Gemma and returns a numerical score (0–100) per feature per text. Returns `TextFeatureEvaluation[]`: `{ text, evaluations: [{ featureName, score }] }`.

---

### `featurePipeline(options: FeaturePipelineOptions): Promise<FeaturePipelineResult>`

Full orchestration pipeline:
1. `describeFeatures` – extract features from corpus.
2. `evaluateFeatures` – score each text against each feature.
3. `embedAndReduce` – generate embeddings (with optional PCA).
4. Train a per-feature multivariate linear regression model (`ml-regression-multivariate-linear`) mapping (reduced) embeddings → feature scores.
5. Run full-corpus inference with each trained model to populate `inferenceValue` on every `TextFeatureEvaluation`.
6. Persist to MongoDB (`[prefix]_features`, `[prefix]_evaluations`, `[prefix]_pca`) if configured.

- **`FeaturePipelineOptions`**: `texts`, `embedder?`, `pc?`, `model?`, `reduceDimensions?` (default `true`), `pcaDimensions?` (default `20`), `mongoDb?`, `mongoCollection?`, `categoryId` (required), `indexName?`, `namespace?`, `cloud?`, `region?`.
- **`FeaturePipelineResult`**: `{ features, evaluations, points, reducedPoints, pcaModelJson }`.

---

### `featureInference(options: FeatureInferenceOptions): Promise<TextFeatureEvaluation[]>`

Loads a saved PCA model and per-feature regression models from MongoDB, generates embeddings for new texts, applies PCA, runs inference, and upserts the results into `[prefix]_evaluations`.

- **`FeatureInferenceOptions`**: `mongoDb`, `mongoCollection`, `categoryId`, `texts`, `embedder?`, `pc?`, `model?`, `reduceDimensions?` (default `true`), `indexName?`, `namespace?`, `cloud?`, `region?`.

---

### `explainPerformance(options: ExplainPerformanceOptions): Promise<ExplainPerformanceResult>`

Calls `featureInference` internally, then computes the Pearson sample correlation between the predicted feature values and the provided `output` numbers. Saves the result to `[prefix]_performance`.

- **`ExplainPerformanceOptions`**: extends `FeatureInferenceOptions` with `featureName` (required) and `texts: PerformanceTextRecord[]` (each record has an extra `output: number` field).
- **`ExplainPerformanceResult`**: `{ correlation: number, evaluations: TextFeatureEvaluation[] }`.

---

### AI Generation Utilities

#### `gemmaGenerate(prompt, options?): Promise<GemmaResponse>`

Calls Gemma models via the Gemini API (`@google/genai`). Returns `{ text: string }`. Optionally logs the prompt and response to MongoDB (`mmdo` database, `default_prompts` collection) if `MONGO_URI` is set.

- **`GemmaOptions`**: `apiKey?`, `model?` (default `'gemma-4-26b-a4b-it'`), `systemInstruction?`, `promptCategory?` (default `'default'`).

#### `geminiGenerateJson(prompt, responseSchema, options?): Promise<any>`

Calls Gemini models with `responseMimeType: "application/json"` and a `responseSchema` (Google GenAI `Schema` type) to enforce structured JSON output. Returns parsed JSON.

- **`GeminiOptions`**: `apiKey?`, `model?` (default `'gemini-3-flash-preview'`), `systemInstruction?`, `promptCategory?`.

---

### Utility Functions

| Function | Signature | Description |
|---|---|---|
| `chunkArray` | `<T>(array: T[], size: number): T[][]` | Splits an array into fixed-size chunks. |
| `customKMeans` | `(points: number[][], k: number): { labels, centroids }` | Lloyd's k-means algorithm (max 100 iterations). |
| `applyPCAIfRequested` | `(points, reduceDimensions, pcaDimensions): { finalPoints, pcaModelJson }` | Applies PCA via `ml-pca`. Returns both the reduced points and the serialisable model JSON. |
| `euclideanDistance` | `(a: number[], b: number[]): number` | Euclidean distance between two vectors. |

---

## LLM Prompts

All prompt templates live in `lib/prompts.ts` and are loaded at runtime via `getPrompt(name)`.

| Name | Used By | Output Format |
|---|---|---|
| `nameClusters` | `nameClusters()` | JSON object: `{ name, description, summary }` |
| `refineClusters` | `refineClusters()` | JSON array of `{ name, description, summary }` |
| `describeFeatures` | `describeFeatures()` | JSON array of `{ name, description }` |
| `evaluateFeatures` | `evaluateFeatures()` | JSON array of `{ text, evaluations: [{ featureName, score }] }` |

To add a new prompt, add an entry to the `prompts` array in `lib/prompts.ts` and call `getPrompt('yourName')` in your function.

---

## Netlify API Endpoints

All endpoints accept and return `application/json`, include CORS headers on every response, and handle `OPTIONS` preflight requests.

### `POST /.netlify/functions/embed`

Synchronous. Embeds texts into Pinecone. If `reduceDimensions` or MongoDB params are provided, uses `embedAndReduce` and optionally stores raw + reduced embeddings to MongoDB.

**Request body:**
```json
{
  "texts": [{ "id": "string", "text": "string", "metadata": {} }],
  "batchSize": 50,
  "indexName": "string",
  "namespace": "string",
  "reduceDimensions": false,
  "pcaDimensions": 20,
  "mongoDb": "string",
  "mongoCollection": "string"
}
```
**Response (200):** `{ writes, errors, elapsedMs }`

---

### `POST /.netlify/functions/cluster`

Validates payload and triggers `cluster-background` asynchronously. Returns `202 Accepted` immediately.

**Request body:**
```json
{
  "texts": [{ "id": "string", "text": "string" }],
  "numClusters": 5,
  "batchSize": 50,
  "indexName": "string",
  "namespace": "string",
  "skipEmbed": false,
  "mongoDb": "string",
  "mongoCollection": "string",
  "cumulative": false,
  "context": "string",
  "storeReducedDimensions": true
}
```
**Response (202):** `{ message: "Accepted. Clustering job has been triggered in the background." }`

---

### `POST /.netlify/functions/refine-clusters`

Validates payload and triggers `refine-clusters-background` asynchronously. Returns `202 Accepted` immediately.

**Request body:**
```json
{
  "mongoDb": "string",
  "mongoCollection": "string",
  "indexName": "string",
  "namespace": "string"
}
```
**Response (202):** `{ message: "Accepted. ..." }`

---

### `POST /.netlify/functions/features`

Validates payload (`texts` array and `categoryId` are required) and triggers `features-background` asynchronously. Returns `202 Accepted` immediately.

**Request body:**
```json
{
  "texts": [{ "id": "string", "text": "string" }],
  "model": "multilingual-e5-large",
  "reduceDimensions": true,
  "pcaDimensions": 20,
  "mongoDb": "string",
  "mongoCollection": "string",
  "categoryId": "string",
  "indexName": "string",
  "namespace": "string"
}
```
**Response (202):** `{ message: "Accepted. Features job has been triggered in the background." }`

---

### `POST /.netlify/functions/feature-inference`

Synchronous. Loads saved models from MongoDB and predicts feature scores for new texts.

**Request body:**
```json
{
  "texts": [{ "id": "string", "text": "string" }],
  "model": "multilingual-e5-large",
  "reduceDimensions": true,
  "mongoDb": "string",
  "mongoCollection": "string",
  "categoryId": "string",
  "indexName": "string",
  "namespace": "string"
}
```
**Response (200):** `{ evaluations: TextFeatureEvaluation[] }`

---

### `POST /.netlify/functions/explain-performance`

Synchronous. Predicts feature scores and computes Pearson correlation against provided output values.

**Request body:**
```json
{
  "texts": [{ "id": "string", "text": "string", "output": 0 }],
  "featureName": "string",
  "model": "multilingual-e5-large",
  "reduceDimensions": true,
  "mongoDb": "string",
  "mongoCollection": "string",
  "categoryId": "string",
  "indexName": "string",
  "namespace": "string"
}
```
**Response (200):** `{ correlation: number, evaluations: TextFeatureEvaluation[] }`

---

## MongoDB Data Models

All MongoDB access uses Mongoose. The connection utility (`lib/mongo.ts`) reads `MONGO_URI` from the environment and connects using `{ dbName: mongoDb }`. All collection names are derived from a `mongoCollection` prefix string.

### Cluster Collections (created by `embedAndCluster` / `refineClusters`)

| Collection | Schema Fields |
|---|---|
| `[prefix]_pca` | `modelBuffer` (Buffer), `createdAt` |
| `[prefix]_clusters` | `name`, `description`, `summary`, `version` (default 1), `centroid` ([Number]), `createdAt` |
| `[prefix]_items` | `textId`, `clusterId` (ObjectId → clusters), `reducedDimensions` ([Number]), `createdAt` |

Query tip: always `sort({ version: -1 })` on clusters to get the latest taxonomy.

### Embedding Collections (created by embed endpoint with `mongoDb`/`mongoCollection`)

| Collection | Schema Fields |
|---|---|
| `[prefix]_pca` | `modelBuffer` (Buffer), `createdAt` |
| `[prefix]_embeddings` | `textId`, `text`, `values` ([Number]), `reducedDimensions` ([Number]), `createdAt` |

### Feature Collections (created by `featurePipeline` / `featureInference`)

| Collection | Schema Fields |
|---|---|
| `[prefix]_pca` | `categoryId` (required), `modelBuffer` (Buffer), `createdAt` |
| `[prefix]_features` | `categoryId` (required), `name`, `description`, `modelBuffer` (Buffer – serialized MLR model), `error` (Number – MSE), `averageValue` (Number), `createdAt` |
| `[prefix]_evaluations` | `categoryId` (required), `textId`, `text`, `evaluations` ([{ featureName, score, inferenceValue }]), `createdAt` |
| `[prefix]_performance` | `categoryId` (required), `featureName`, `correlation` (Number), `createdAt` |

### Prompt Logging Collection (created by `gemmaGenerate` / `geminiGenerateJson`)

| Collection | Schema Fields |
|---|---|
| `default_prompts` | `category`, `model`, `prompt`, `result` (Mixed), `elapsedTime` (Number), `createdAt` |

Note: Prompt logging uses the hardcoded database `mmdo` and collection prefix `default`.

---

## Frontend Playground

- **Source**: `app/app.tsx` (React + TypeScript).
- **Build output**: `public/` directory (compiled by `scripts/build.js` using esbuild).
- **Docs rendering**: The build script converts each `docs/*.md` file into `public/build/docs.json` (a key–value map of filename → rendered HTML). The app fetches this at runtime.
- **Config system**: The app uses a `configSchema` in `app.tsx` to define typed form fields (text, number, boolean) for API playground parameters. Values are persisted to `localStorage` and substituted as `{{VARIABLE}}` placeholders in the API prompts shown in each doc.
- **Tabs**: Docs, Playground (interactive API calls), Prompts (view/edit LLM prompt templates).

---

## Build & Test Commands

```bash
# Compile lib + React app + docs → public/
npm run build

# Run the test suite
npm run test

# Lint the library
npx eslint lib
```

---

## Coding Guidelines

When modifying this repository, strictly adhere to the following coding guidelines:

1. **Modularity:** Maintain a modular file structure. Do not place all functionality in a single `index.ts` file. Group related functions into cohesive files (e.g., `embed.ts`, `utils.ts`, `cluster.ts`).
2. **Small Functions:** Keep functions small, focused, and testable. The configured ESLint rule `max-lines-per-function` enforces a strict 50-line maximum limit per function. If a function exceeds this limit, extract logical chunks into separate helper functions.
3. **Linting:** Code must pass the configured ESLint checks before being merged. Ensure you run `npx eslint lib` (or similar) to verify your code against our rules. Address all linting errors.
4. **Type Reusability:** Define interfaces and types in `lib/types.ts` instead of using inline types to promote clean code and reusability.
5. **CORS and OPTIONS Handling:** All Netlify serverless functions (e.g., in `netlify/functions/`) must explicitly handle `OPTIONS` requests and include standard CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`) in *all* responses (including error responses) to properly support cross-domain frontend applications.
6. **New Netlify Functions:** When adding a new background-capable endpoint, follow the existing two-function pattern: a synchronous handler (`[name].ts`) that validates the payload and fires off a background trigger, and a background handler (`[name]-background.ts`) that performs the actual work.
7. **New Docs:** When adding a new API endpoint, create a corresponding `docs/[name].md` file following the existing structure (Cloud API section, Payload structure, Environment Setup, Querying Results if applicable, Agent Prompt section with copy button).
8. **New Prompts:** Add new LLM prompt templates to `lib/prompts.ts` as entries in the `prompts` array and retrieve them with `getPrompt('name')` – never inline prompts directly in business logic.
9. **MongoDB Schema Registration:** Add new Mongoose schemas and model factories to `lib/models.ts`. Never define schemas inline in feature files.
