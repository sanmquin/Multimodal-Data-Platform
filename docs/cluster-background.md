# Cluster Background API

This background endpoint receives a list of texts, embeds missing ones, clusters them based on Pinecone vectors, and generates names and descriptions for each cluster using a generative AI model.

## Cloud API (Netlify Background Function)

Background functions return a `202 Accepted` status immediately and process the work asynchronously.

`POST {{DOMAIN}}/.netlify/functions/cluster-background`

### Payload structure

```json
{
  "texts": [
    { "id": "1", "text": "Testing the cloud background cluster." },
    { "id": "2", "text": "Another text to be clustered seamlessly." }
  ],
  "numClusters": 2,
  "batchSize": 50,
  "indexName": "your-target-index",
  "namespace": "your-namespace",
  "skipEmbed": false
}
```

- **skipEmbed**: Set to `true` to skip embedding generation and just retrieve and cluster existing items from Pinecone. Defaults to `false`.
- **numClusters**: The number of clusters to form. Must be less than or equal to the total number of provided text ids found in Pinecone.

### Environment Setup

The function depends on the `PINECONE_API_KEY` environment variable to authorize against Pinecone. It also requires the `GEMINI_API_KEY` for generating cluster descriptions.

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

````text
Please write code to integrate the multimodal data platform cluster background API.

# Multimodal Data Platform - Cluster Background Agentic Documentation

### Interface Signatures

```typescript
export interface TextRecord {
  id: string; // The unique identifier for the text snippet
  text: string; // The text content to embed and cluster
}

export interface PipelineOptions<T extends RecordMetadata = RecordMetadata> extends EmbedOptions<T> {
  numClusters: number; // Number of clusters to form
  namespace?: string;  // Target Pinecone namespace
  skipEmbed?: boolean; // Skip embedding, only cluster
}

export interface NamedCluster {
  texts: string[]; // List of texts within the cluster
  name: string; // Generated name
  description: string; // Generated description with examples
  summary: string; // Generated summary
}
```

### Behavioral Guarantees

1. **Sequential Processing:** The process calls `embed` (if not skipped), `retrieveAndCluster`, maps records back to texts, and then uses a LLM to sequentially `nameClusters`.
2. **Asynchronous Execution:** Netlify background functions return a `202 Accepted` immediately. Check the execution logs of the function for the final `NamedCluster[]` result.
3. **LLM Integration:** The Gemma model natively generates valid JSON mapping to the `NamedCluster` attributes.
````
<button id="copy-agent-btn-cluster" class="button is-small is-link mt-2">Copy Instructions</button>
