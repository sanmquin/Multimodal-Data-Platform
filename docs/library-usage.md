# Library Usage

This library allows you to embed text and store it in Pinecone efficiently. It deduplicates automatically and batches the upserts.

## Cloud API (Netlify Function)

A deployed instance of this library is available as a Netlify function. You can make an HTTP POST request to:

`POST {{DOMAIN}}/.netlify/functions/embed`

### Payload structure

```json
{
  "texts": [
    { "id": "1", "text": "Testing the cloud version." }
  ],
  "batchSize": 50,
  "indexName": "your-target-index",
  "namespace": "your-namespace"
}
```

### Environment Setup

The function depends on the `PINECONE_API_KEY` environment variable inside Netlify to authorize against Pinecone.

### Agent Prompt

If you are an LLM agent or an automated tooling developer, you can quickly write integration code by copying the prompt below and sending it to your agent:

```text
Please write code to integrate the multimodal data platform API. Read the agent instructions at {{DOMAIN}}/agent.md
```
