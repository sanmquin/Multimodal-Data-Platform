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
  ]
}
```

- **texts**: Array of objects containing text records to analyze.

### Environment Setup

The function depends on the `GEMINI_API_KEY` environment variable for generating the textual features.

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
  ]
}
```

#### Inputs
*   `texts` (**Required**): Array of objects containing text records to analyze.
    *   `id` (*Optional* for this endpoint): Identifier.
    *   `text` (**Required**): Text content to extract features from.

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
