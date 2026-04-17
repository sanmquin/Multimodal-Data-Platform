# Refine Clusters API

This endpoint refines existing clusters by reviewing their representative texts using a generative AI model and producing a new Mutually Exclusive, Collectively Exhaustive (MECE) set of clusters, including a "Miscellaneous/Unknown" cluster to catch outliers.

## Cloud API (Netlify Function)

The endpoint handles the initial validation. If successful, it triggers a background function and immediately returns a `202 Accepted` status to let you know the process has started asynchronously.

`POST {{DOMAIN}}/.netlify/functions/refine-clusters`

### Payload structure

```json
{
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}",
  "indexName": "{{PINECONE_INDEX}}",
  "namespace": "{{NAMESPACE}}"
}
```

- **mongoDb**: Required. The MongoDB database name.
- **mongoCollection**: Required. The prefix used for the Mongo collections storing clusters and items.
- **indexName**: Optional. The target Pinecone index name. Defaults to `default-index`.
- **namespace**: Optional. The target Pinecone namespace.

### Environment Setup

The function depends on the `PINECONE_API_KEY` environment variable to authorize against Pinecone. It also requires the `GEMINI_API_KEY` to be set in your deployment environment in order to invoke the generative model.

### Querying Refined Clusters

The refine clusters API generates new clusters and increments their `version`. The new cluster documents will be persisted into the `[prefix]_clusters` MongoDB collection.

The clusters collection schema:
*   `name` (String): The generated name of the cluster.
*   `description` (String): A detailed description of the cluster's theme.
*   `summary` (String): A concise summary of the cluster.
*   `version` (Number): The version of the cluster. Defaults to 1 and increments per refinement.
*   `centroid` (Array of Numbers): Optional. The PCA-reduced point coordinates of the cluster center.
*   `createdAt` (Date): The time the cluster was created.

When querying the collections directly, you should sort the clusters by `version` descending (`sort({ version: -1 })`) to get the latest cluster taxonomies, as this reflects the newest output from the refine clusters operation. Item documents in `[prefix]_items` retain their original relationships and may contain `reducedDimensions` coordinates that can be plotted with the `centroid` for visualizations.

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

````text
Please write code to integrate the multimodal data platform refine clusters background API.

# Multimodal Data Platform - Refine Clusters Background Agentic Documentation

### API Endpoint Signature

**Endpoint URL**: `POST {{DOMAIN}}/.netlify/functions/refine-clusters`
**Content-Type**: `application/json`

#### Request Payload Structure

```json
{
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}",
  "indexName": "{{PINECONE_INDEX}}",
  "namespace": "{{NAMESPACE}}"
}
```

#### Inputs
*   `mongoDb` (**Required**): The name of the MongoDB database where clusters and item assignments are saved.
*   `mongoCollection` (**Required**): The prefix for the MongoDB collections to read from and write to (e.g. `[prefix]_clusters`, `[prefix]_items`).
*   `indexName` (*Optional*): Target Pinecone index name. Defaults to a playground index if omitted.
*   `namespace` (*Optional*): Target Pinecone namespace.

#### Response

Background functions return an HTTP `202 Accepted` status immediately and process the work asynchronously in the background. Check Netlify logs for execution details.

### Behavioral Guarantees

1. **Dimensionality Optimization:** The function uses stored `reducedPoints` and `centroid` values to calculate distances locally and dramatically minimize queries sent to Pinecone.
2. **Generative AI:** It feeds representative texts to a Gemini 3.0 Flash model using a structured JSON schema to generate refined cluster definitions.
3. **MECE Taxonomies:** Generates clusters that are mutually exclusive and collectively exhaustive, explicitly retaining a fallback "Miscellaneous" group.
````
<button id="copy-agent-btn-refine-clusters" class="button is-small is-link mt-2">Copy Instructions</button>
