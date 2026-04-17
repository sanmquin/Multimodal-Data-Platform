# Features API

This endpoint receives a list of texts, validates the payload synchronously, and then delegates the extraction of features, their evaluation, text embedding, dimensionality reduction, and regression modeling to a background job.

## Cloud API (Netlify Function)

The endpoint handles the initial validation. If successful, it triggers a background function and immediately returns a `202 Accepted` status to let you know the process has started asynchronously.

`POST {{DOMAIN}}/.netlify/functions/features`

### Payload structure

```json
{
  "texts": [
    { "id": "1", "text": "Learning machine learning algorithms requires strong mathematical foundations." },
    { "id": "2", "text": "The new cloud infrastructure scales automatically based on traffic." }
  ],
  "model": "{{MODEL}}",
  "reduceDimensions": {{REDUCE_DIMENSIONS}},
  "pcaDimensions": {{PCA_DIMENSIONS}},
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}",
  "categoryId": "{{CATEGORY_ID}}"
}
```

- **texts**: Array of objects containing text records to analyze and embed.
- **model**: The embedding model to use (e.g., `"multilingual-e5-large"`). Defaults to `"multilingual-e5-large"`.
- **reduceDimensions**: Set to `true` to reduce the dimensionality of the generated embeddings using PCA. Defaults to `true`.
- **pcaDimensions**: The target number of dimensions for PCA reduction. Defaults to 20.
- **mongoDb**: The name of the MongoDB database where features, evaluations, PCA models, and linear regression models should be saved.
- **mongoCollection**: The prefix for the MongoDB collections to save into.
- **categoryId**: Optional identifier used to associate the generated features, evaluations, and models with a specific batch or category of texts.

### Environment Setup

The function depends on the `PINECONE_API_KEY` environment variable to authorize against Pinecone for generating embeddings. It also requires the `GEMINI_API_KEY` for generating and evaluating textual features.

### Querying Results

If you provide the `mongoDb` and `mongoCollection` parameters in your payload, the results of the feature extraction and modeling operations will be persisted to MongoDB.

Data is stored in three separate collections based on the `mongoCollection` prefix you provide:

1.  **`[prefix]_pca`**: Stores the PCA model used for dimensionality reduction.
    *   `categoryId` (String): The associated category identifier.
    *   `modelBuffer` (Buffer): The serialized PCA model.
    *   `createdAt` (Date): The time the model was saved.

2.  **`[prefix]_features`**: Stores the descriptive features generated from the text snippets along with their associated regression model.
    *   `categoryId` (String): The associated category identifier.
    *   `features` (Array of Objects): The generated features.
        *   `name` (String): The generated name of the feature.
        *   `description` (String): A detailed description of the feature.
    *   `modelBuffer` (Buffer): The serialized trained multivariate linear regression model mapping embeddings to feature evaluations.
    *   `createdAt` (Date): The time the feature was created.

3.  **`[prefix]_evaluations`**: Stores the numerical evaluation of each text against the identified features.
    *   `categoryId` (String): The associated category identifier.
    *   `textId` (String): The ID of the original text snippet.
    *   `text` (String): The original text content.
    *   `evaluations` (Array of Objects): The evaluations for this text.
        *   `featureName` (String): The name of the feature evaluated.
        *   `score` (Number): The numerical score assigned to the text for this feature.
    *   `createdAt` (Date): The time the evaluation was created.

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

````text
Please write code to integrate the multimodal data platform features background API.

# Multimodal Data Platform - Features Background Agentic Documentation

### API Endpoint Signature

**Endpoint URL**: `POST {{DOMAIN}}/.netlify/functions/features`
**Content-Type**: `application/json`

#### Request Payload Structure

```json
{
  "texts": [
    { "id": "string", "text": "string" }
  ],
  "model": "{{MODEL}}",
  "reduceDimensions": {{REDUCE_DIMENSIONS}},
  "pcaDimensions": {{PCA_DIMENSIONS}},
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}",
  "categoryId": "{{CATEGORY_ID}}"
}
```

#### Inputs
*   `texts` (**Required**): Array of objects containing text records.
    *   `id` (**Required**): The unique identifier for the text snippet.
    *   `text` (**Required**): The text content to analyze.
*   `model` (*Optional*): The embedding model to use. Defaults to `multilingual-e5-large`.
*   `reduceDimensions` (*Optional*): Set to `true` to perform PCA dimensionality reduction on embeddings. Defaults to `true`.
*   `pcaDimensions` (*Optional*): Number of dimensions to reduce to. Defaults to 20.
*   `mongoDb` (*Optional*): The name of the MongoDB database where the output data should be saved.
*   `mongoCollection` (*Optional*): The prefix for the MongoDB collections to save into (e.g. `[prefix]_pca`, `[prefix]_features`, `[prefix]_evaluations`). Required if `mongoDb` is specified.
*   `categoryId` (*Optional*): Identifier to associate generated features, evaluations, and models with a specific text batch.

#### Response

Background functions return an HTTP `202 Accepted` status immediately and process the work asynchronously in the background.

### Behavioral Guarantees

1. **Sequential Processing:** The background job extracts features from texts, numerically evaluates the texts against the features, generates embeddings for the texts (with optional PCA reduction), and trains a multivariate linear regression model to predict the feature scores from the embeddings.
2. **Asynchronous Execution:** The API returns a `202 Accepted` immediately. You must check the MongoDB collections or execution logs to see the final outputs.
3. **MongoDB Persistence:** If configured, the resulting data is persisted into three separate collections in MongoDB using Mongoose, enabling querying and further analysis.
````
<button id="copy-agent-btn-features" class="button is-small is-link mt-2">Copy Instructions</button>
