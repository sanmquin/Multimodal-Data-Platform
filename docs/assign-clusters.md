# Assign Clusters API

This endpoint assigns an array of new text records to your pre-existing clusters. It feeds the unassigned records, along with the names and descriptions of your current clusters, to a generative AI model (Gemma) and asks it to classify the records into the most appropriate buckets.

## Cloud API (Netlify Function)

The endpoint handles the initial validation. If successful, it triggers a background function and immediately returns a `202 Accepted` status to let you know the process has started asynchronously.

`POST {{DOMAIN}}/.netlify/functions/assign-clusters`

### Payload structure

```json
{
  "texts": [
    { "id": "3", "text": "Can I get some info about the new assignment feature?" },
    { "id": "4", "text": "This is a random text that needs categorizing." }
  ],
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}"
}
```

- **texts**: Required. Array of objects containing text records to assign.
    - `id`: The unique identifier for the text snippet.
    - `text`: The text content to cluster.
- **mongoDb**: Required. The MongoDB database name.
- **mongoCollection**: Required. The prefix used for the Mongo collections storing clusters and items.

### Environment Setup

The function requires the `GEMINI_API_KEY` to be set in your deployment environment in order to invoke the generative model (Gemma via Gemini API framework). It also requires the `MONGO_URI`.

### Querying Assigned Items

The assign clusters API links your given texts to the latest cluster versions found in the database.

The newly created mappings will be added as item documents in the `[prefix]_items` MongoDB collection.
*   `textId` (String): The `id` of the text record you provided.
*   `clusterId` (ObjectId): The MongoDB `_id` of the associated cluster document.
*   `createdAt` (Date): The time the item assignment was created.

When querying the collection directly, keep in mind this process works in batches and makes a best effort to classify items. Items that failed to classify cleanly may be missing from the results.

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

````text
Please write code to integrate the multimodal data platform assign clusters background API.

# Multimodal Data Platform - Assign Clusters Background Agentic Documentation

### API Endpoint Signature

**Endpoint URL**: `POST {{DOMAIN}}/.netlify/functions/assign-clusters`
**Content-Type**: `application/json`

#### Request Payload Structure

```json
{
  "texts": [
    { "id": "string", "text": "string" }
  ],
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}"
}
```

#### Inputs
*   `texts` (**Required**): Array of objects containing text records to classify.
    *   `id` (**Required**): The unique identifier for the text snippet.
    *   `text` (**Required**): The text content to cluster.
*   `mongoDb` (**Required**): The name of the MongoDB database where clusters and item assignments are saved.
*   `mongoCollection` (**Required**): The prefix for the MongoDB collections to read from and write to (e.g. `[prefix]_clusters`, `[prefix]_items`).

#### Response

Background functions return an HTTP `202 Accepted` status immediately and process the work asynchronously in the background. Check Netlify logs for execution details.

### Behavioral Guarantees

1. **Latest Cluster Fetching:** The function retrieves the descriptions and names for the cluster mappings belonging to the highest version number available.
2. **Generative AI Assignment:** It feeds the items and descriptions to a Gemma model in batches (default size 10) to map items.
3. **Second Pass Reliability:** If some items fail to be classified in the first pass, they are retried in a second pass before the task finishes.
````
<button id="copy-agent-btn-assign-clusters" class="button is-small is-link mt-2">Copy Instructions</button>
