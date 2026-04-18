# Feature Inference API

This endpoint receives a list of texts, generates embeddings for them (with optional PCA dimensionality reduction), and predicts numerical evaluations against previously extracted and trained features using a specific text batch category.

## Cloud API (Netlify Function)

The endpoint is synchronous. It validates the payload and returns the text evaluation results.

`POST {{DOMAIN}}/.netlify/functions/feature-inference`

### Payload structure

```json
{
  "texts": [
    { "id": "3", "text": "Learning new programming languages requires time and patience." },
    { "id": "4", "text": "Scaling database infrastructure needs careful planning." }
  ],
  "model": "{{MODEL}}",
  "reduceDimensions": {{REDUCE_DIMENSIONS}},
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}",
  "categoryId": "{{CATEGORY_ID}}",
  "indexName": "{{TARGET_INDEX}}",
  "namespace": "{{NAMESPACE}}"
}
```

- **texts**: Array of objects containing text records to analyze and evaluate.
- **model**: The embedding model to use (e.g., `"multilingual-e5-large"`). Defaults to `"multilingual-e5-large"`.
- **reduceDimensions**: Set to `true` to reduce the dimensionality of the generated embeddings using the previously saved PCA model. Defaults to `true`.
- **mongoDb**: The name of the MongoDB database where features, PCA models, and linear regression models are saved.
- **mongoCollection**: The prefix for the MongoDB collections to read the saved models from.
- **categoryId**: Identifier used to load the specific features and PCA model associated with a specific batch of texts.
- **indexName**: Optional Pinecone target index to lookup or store embeddings.
- **namespace**: Optional Pinecone target namespace to lookup or store embeddings.

### Environment Setup

The function depends on the `PINECONE_API_KEY` environment variable to authorize against Pinecone for generating embeddings.

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

````text
Please write code to integrate the multimodal data platform feature inference API.

# Multimodal Data Platform - Feature Inference Agentic Documentation

### API Endpoint Signature

**Endpoint URL**: `POST {{DOMAIN}}/.netlify/functions/feature-inference`
**Content-Type**: `application/json`

#### Request Payload Structure

```json
{
  "texts": [
    { "id": "string", "text": "string" }
  ],
  "model": "{{MODEL}}",
  "reduceDimensions": {{REDUCE_DIMENSIONS}},
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}",
  "categoryId": "{{CATEGORY_ID}}",
  "indexName": "{{TARGET_INDEX}}",
  "namespace": "{{NAMESPACE}}"
}
```

#### Inputs
*   `texts` (**Required**): Array of objects containing text records.
    *   `id` (**Required**): The unique identifier for the text snippet.
    *   `text` (**Required**): The text content to evaluate.
*   `mongoDb` (**Required**): The name of the MongoDB database containing the saved models.
*   `mongoCollection` (**Required**): The prefix for the MongoDB collections.
*   `categoryId` (**Required**): Identifier to load generated features and models.
*   `model` (*Optional*): The embedding model to use. Defaults to `multilingual-e5-large`.
*   `reduceDimensions` (*Optional*): Set to `true` to apply PCA dimensionality reduction to embeddings before prediction. Defaults to `true`.
*   `indexName` (*Optional*): Target Pinecone index name to lookup existing embeddings or persist newly generated ones.
*   `namespace` (*Optional*): Target Pinecone namespace to lookup existing embeddings or persist newly generated ones.

#### Response

The API returns a `200 OK` JSON response containing the text evaluations:

```json
{
  "evaluations": [
    {
      "textId": "string",
      "text": "string",
      "evaluations": [
        {
          "featureName": "string",
          "score": 0,
          "inferenceValue": 0.123
        }
      ]
    }
  ]
}
```

### Behavioral Guarantees

1. **Synchronous Inference:** The API embeds the provided text array, applies PCA dimensionality reduction (if configured), and predicts feature evaluations by loading the saved models from MongoDB using Mongoose.
2. **MongoDB Retrieval:** Retrieves `[prefix]_pca` and `[prefix]_features` from the provided `categoryId` to construct inference pipelines.
````
<button id="copy-agent-btn-feature-inference" class="button is-small is-link mt-2">Copy Instructions</button>
