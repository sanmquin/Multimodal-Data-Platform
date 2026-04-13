# Development and Setup Guide

This guide explains how to set up the Multimodal Data Platform for development, local testing, and self-hosted environments. It differentiates between setting up a local or self-hosted deployment vs. the provided cloud API setup.

## Pinecone Index Setup

Before running tests or a self-hosted instance, you must configure your Pinecone index correctly.

### Setting up the Index

1.  **Sign up or Log in** to your [Pinecone Console](https://app.pinecone.io).
2.  **Create a New Index**:
    *   **Index Name**: Choose a name (e.g., `default-index` or `test-index`).
    *   **Dimensions**: Depending on your embedder, the required dimension will vary. For example, if using the native integration with Pinecone's inference model (`multilingual-e5-large`), check the model documentation for its output dimensions (e.g., 1024). For OpenAI `text-embedding-3-small`, it is typically 1536.
    *   **Metric**: Choose the appropriate metric (commonly `cosine` for embedding similarity).
3.  **API Key**: Obtain your API Key from the "API Keys" section in the console.

## Environment Variables

You need to provide your `PINECONE_API_KEY`. The `PINECONE_INDEX` can be optional depending on how you invoke the library, but it is required if your code looks for it.

### Local Development / Self-Hosted
When running your own instance (e.g. standard Node.js server), set the variables in your environment:

```bash
export PINECONE_API_KEY="your-api-key"
export PINECONE_INDEX="your-index-name"
```

### Cloud Deployment (Netlify)
If you deploy using Netlify Serverless Functions, ensure these environment variables are set inside the Netlify Dashboard -> Site settings -> Environment variables.

## Running Tests Locally

To run the local test suite (which mocks network calls):

```bash
npm run test
```

To run end-to-end tests targeting the Netlify function handler:

```bash
npx ts-node test-e2e.ts
```

## Running the Frontend Locally

If you are developing the user interface and playground, you can build the project:

```bash
npm run build
```

This compiles both the library code and the React frontend into the `public` directory, and translates `docs/` Markdown into a consumable JSON format.
