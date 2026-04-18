# Explain Performance API

This endpoint takes a dataset composed of text, performance/output, and a feature you want to test against, and computes the Pearson correlation using the evaluated model and a specific text batch category.

## Cloud API (Netlify Function)

The endpoint is synchronous. It validates the payload, embeds the texts, predicts numerical evaluations, and then computes and returns the correlation along with the text evaluation results.

`POST {{DOMAIN}}/.netlify/functions/explain-performance`

### Payload structure

```json
{
  "texts": [
    { "id": "1", "text": "Learning new programming languages requires time and patience.", "output": 85 },
    { "id": "2", "text": "Scaling database infrastructure needs careful planning.", "output": 90 }
  ],
  "featureName": "Technical Complexity",
  "model": "{{MODEL}}",
  "reduceDimensions": {{REDUCE_DIMENSIONS}},
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}",
  "categoryId": "{{CATEGORY_ID}}",
  "indexName": "{{TARGET_INDEX}}",
  "namespace": "{{NAMESPACE}}"
}
```

- **texts**: Array of objects containing text records to analyze and evaluate. Each record must include an `output` value to calculate correlation.
- **featureName**: The specific feature to compute the correlation against.
- **model**: The embedding model to use (e.g., `"multilingual-e5-large"`). Defaults to `"multilingual-e5-large"`.
- **reduceDimensions**: Set to `true` to reduce the dimensionality of the generated embeddings using the previously saved PCA model. Defaults to `true`.
- **mongoDb**: The name of the MongoDB database where features, PCA models, and linear regression models are saved.
- **mongoCollection**: The prefix for the MongoDB collections to read the saved models from, and where the performance results will be saved.
- **categoryId**: Identifier used to load the specific features and PCA model associated with a specific batch of texts.
- **indexName**: Optional Pinecone target index to lookup existing embeddings.
- **namespace**: Optional Pinecone target namespace to lookup existing embeddings.

### Querying Results

The computed correlation is saved in the MongoDB database you provide, alongside your feature definitions. Data is stored in the following collection:

1.  **`[prefix]_performance`**: Stores the Pearson correlation of the specific feature against the output provided.
    *   `categoryId` (String): The associated category identifier.
    *   `featureName` (String): The generated name of the feature.
    *   `correlation` (Number): The sample Pearson correlation score between the feature's predictions and the output values.
    *   `createdAt` (Date): The time the calculation was saved.

### Environment Setup

The function depends on the `PINECONE_API_KEY` environment variable to authorize against Pinecone for generating embeddings.

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

````text
Please write code to integrate the multimodal data platform explain performance API.

# Multimodal Data Platform - Explain Performance Agentic Documentation

### API Endpoint Signature

**Endpoint URL**: `POST {{DOMAIN}}/.netlify/functions/explain-performance`
**Content-Type**: `application/json`

#### Request Payload Structure

```json
{
  "texts": [
    { "id": "string", "text": "string", "output": 0 }
  ],
  "featureName": "string",
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
    *   `output` (**Required**): The performance or target metric to correlate against.
*   `featureName` (**Required**): The name of the feature to compute correlation against.
*   `mongoDb` (**Required**): The name of the MongoDB database containing the saved models and to save performance metrics.
*   `mongoCollection` (**Required**): The prefix for the MongoDB collections.
*   `categoryId` (**Required**): Identifier to load generated features and models.
*   `model` (*Optional*): The embedding model to use. Defaults to `multilingual-e5-large`.
*   `reduceDimensions` (*Optional*): Set to `true` to apply PCA dimensionality reduction to embeddings before prediction. Defaults to `true`.
*   `indexName` (*Optional*): Pinecone target index.
*   `namespace` (*Optional*): Pinecone target namespace.

#### Response

The API returns a `200 OK` JSON response containing the correlation result and evaluations:

```json
{
  "correlation": 0.85,
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

1. **Synchronous Inference and Correlation:** The API predicts feature evaluations by loading the saved models from MongoDB, then computes the Pearson sample correlation between these predictions and the provided `output` values.
2. **MongoDB Retrieval & Save:** Retrieves `[prefix]_pca` and `[prefix]_features` from the provided `categoryId` to construct inference pipelines, and persists the computed correlation to `[prefix]_performance`.
````
<button id="copy-agent-btn-explain-performance" class="button is-small is-link mt-2">Copy Instructions</button>
