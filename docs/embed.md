# Embed API

This endpoint allows you to embed text and store it in Pinecone efficiently. It deduplicates automatically and batches the upserts.

## Cloud API (Netlify Function)

You can make an HTTP POST request to:

`POST {{DOMAIN}}/.netlify/functions/embed`

### Payload structure

```json
{
  "texts": [
    { "id": "1", "text": "Testing the cloud version." }
  ],
  "batchSize": {{BATCH_SIZE}},
  "indexName": "{{PINECONE_INDEX}}",
  "namespace": "{{NAMESPACE}}"
}
```

### Environment Setup

The function depends on the `PINECONE_API_KEY` environment variable inside Netlify to authorize against Pinecone.

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

````text
Please write code to integrate the multimodal data platform embed API.

# Multimodal Data Platform - Embed Agentic Documentation

If you are an LLM agent or automated tooling trying to reason about how to call this API endpoint, refer to the following structure and behavior guarantees.

### API Endpoint Signature

**Endpoint URL**: `POST {{DOMAIN}}/.netlify/functions/embed`
**Content-Type**: `application/json`

#### Request Payload Structure

```json
{
  "texts": [
    { "id": "string", "text": "string", "metadata": {} }
  ],
  "batchSize": {{BATCH_SIZE}},
  "indexName": "{{PINECONE_INDEX}}",
  "namespace": "{{NAMESPACE}}"
}
```

#### Inputs
*   `texts` (**Required**): Array of objects containing text records to embed.
    *   `id` (**Required**): The unique identifier for the text snippet.
    *   `text` (**Required**): The text content to embed.
    *   `metadata` (*Optional*): Additional key-value pairs to store with the vector.
*   `indexName` (*Optional*): Target Pinecone index name. Defaults to a playground index if omitted.
*   `namespace` (*Optional*): Target Pinecone namespace.
*   `batchSize` (*Optional*): Size per chunk for processing. Defaults to 50.

#### Response Payload Structure

```json
{
  "writes": "number",
  "errors": "number",
  "elapsedMs": "number"
}
```

### Behavioral Guarantees

1. **Deduplication:** The API automatically checks the index for existing `id`s. Items that already exist are skipped to prevent redundant embedding computation.
2. **Metadata Injection:** The `text` field from the `TextRecord` is automatically injected into the inserted vector's `metadata`.
3. **Batching:** The function processes incoming arrays in chunks according to `batchSize`.
4. **Error Handling:** If an error occurs in a given batch, the error is caught, the response `errors` count increments by the size of that batch, and the process continues to the next batch without failing the entire request.
````
<button id="copy-agent-btn" class="button is-small is-link mt-2">Copy Instructions</button>
