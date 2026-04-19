# Describe Features API

This synchronous endpoint receives a list of texts and returns a list of semantic features dynamically extracted from those texts using Generative AI.

## Cloud API (Netlify Function)

The endpoint handles the text payload, interacts with the LLM to extract common semantic features, and directly returns them in the response.

`POST {{DOMAIN}}/.netlify/functions/describe-features`

### Payload structure

```json
{
  "texts": [
    { "id": "1", "text": "Learning machine learning algorithms requires strong mathematical foundations." },
    { "id": "2", "text": "The new cloud infrastructure scales automatically based on traffic." }
  ],
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}",
  "categoryId": "{{CATEGORY_ID}}"
}
```

- **texts**: Array of objects containing text records to analyze.
- **mongoDb** *(Optional)*: The name of the MongoDB database where features should be saved.
- **mongoCollection** *(Optional)*: The prefix for the MongoDB collections to save into.
- **categoryId** *(Optional)*: Identifier to associate generated features with a specific text batch.
- **clusterId** *(Optional)*: Identifier to associate generated features with a specific cluster.

### Environment Setup

The function depends on the `GEMINI_API_KEY` environment variable for generating the textual features.

### Querying Results

If you provide the `mongoDb` and `mongoCollection` parameters in your payload, the results of the feature generation operations will be persisted to MongoDB.

Data is stored in the following collection based on the `mongoCollection` prefix you provide:

1.  **`[prefix]_features`**: Stores the descriptive features generated from the text snippets.
    *   `categoryId` (String): The associated category identifier.
    *   `clusterId` (String): The associated cluster identifier.
    *   `version` (Number): The version of the feature generation run. Defaults to 1 and increments per run.
    *   `name` (String): The generated name of the feature.
    *   `description` (String): A detailed description of the feature.
    *   `isClustered` (Boolean): Always false for the raw features described in this endpoint.
    *   `createdAt` (Date): The time the feature was created.

When querying the collection directly, you should sort the items by `version` descending (`sort({ version: -1 })`) to get the latest generated features.

### Response

Returns a `200 OK` status with a list of extracted features.

```json
{
  "features": [
    {
      "name": "Mathematical Complexity",
      "description": "Reflects the degree of advanced math required to understand the content."
    },
    {
      "name": "Cloud Operations",
      "description": "Focuses on infrastructure scaling and deployment."
    }
  ]
}
```

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

````text
Please write code to integrate the multimodal data platform describe features API.

# Multimodal Data Platform - Describe Features API Documentation

### API Endpoint Signature

**Endpoint URL**: `POST {{DOMAIN}}/.netlify/functions/describe-features`
**Content-Type**: `application/json`

#### Request Payload Structure

```json
{
  "texts": [
    { "id": "string", "text": "string" }
  ],
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}",
  "categoryId": "{{CATEGORY_ID}}"
}
```

#### Inputs
*   `texts` (**Required**): Array of objects containing text records to analyze.
    *   `id` (*Optional* for this endpoint): Identifier.
    *   `text` (**Required**): Text content to extract features from.
*   `mongoDb` (*Optional*): The name of the MongoDB database where the output data should be saved.
*   `mongoCollection` (*Optional*): The prefix for the MongoDB collections to save into (e.g. `[prefix]_features`). Required if `mongoDb` is specified.
*   `categoryId` (*Optional*): Identifier to associate generated features with a specific text batch.
*   `clusterId` (*Optional*): Identifier to associate generated features with a specific cluster.

#### Response

Returns a synchronous HTTP `200 OK` status with an array of objects.

```json
{
  "features": [
    { "name": "string", "description": "string" }
  ]
}
```

### Behavioral Guarantees

1. **Synchronous Execution:** Returns the array of extracted features directly.
2. **Feature Extraction:** Reads the input batch of texts and determines relevant quantitative vectors that they can be judged against.
````
<button id="copy-agent-btn-describe-features" class="button is-small is-link mt-2">Copy Instructions</button>
