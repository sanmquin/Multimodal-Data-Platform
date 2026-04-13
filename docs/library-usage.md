# Library Usage

This library allows you to embed text and store it in Pinecone efficiently. It deduplicates automatically and batches the upserts.

## Cloud API (Netlify Function)

A deployed instance of this library is available as a Netlify function. You can make an HTTP POST request to:

`POST https://<YOUR_NETLIFY_DOMAIN>.netlify.app/.netlify/functions/embed`

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
