import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { trainFeaturesPipeline, TrainFeaturesPipelineOptions } from '../../lib/index';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[train-features-background function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[train-features-background function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[train-features-background function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts, features, model, reduceDimensions, pcaDimensions, mongoCollection, categoryId, clusterId, isClustered, indexName, namespace, cloud, region } = parsedBody;
    const mongoDb = parsedBody.mongoDb?.toLowerCase();

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[train-features-background function] Validation failed: texts array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    if (!features || !Array.isArray(features)) {
      console.warn(`[train-features-background function] Validation failed: features array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'features array is required' })
      };
    }

    if (!categoryId && !clusterId) {
      console.warn(`[train-features-background function] Validation failed: categoryId or clusterId is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'categoryId or clusterId is required' })
      };
    }

    console.log(`[train-features-background function] Processing payload: ${texts.length} texts and ${features.length} features`);

    const apiKey = process.env.PINECONE_API_KEY;
    let pc: Pinecone | undefined;
    if (apiKey) {
      console.log(`[train-features-background function] Initializing Pinecone client...`);
      pc = new Pinecone({ apiKey });
    } else {
      console.log(`[train-features-background function] PINECONE_API_KEY not found. Assuming custom embedder or skip.`);
    }

    const options: TrainFeaturesPipelineOptions = {
      texts,
      features,
      pc,
      model: model || 'multilingual-e5-large',
      reduceDimensions,
      pcaDimensions,
      mongoDb,
      mongoCollection,
      categoryId,
      clusterId,
      isClustered,
      indexName,
      namespace,
      cloud,
      region
    };

    console.log(`[train-features-background function] Calling trainFeaturesPipeline() logic...`);
    await trainFeaturesPipeline(options);
    console.log(`[train-features-background function] trainFeaturesPipeline completed successfully. Processed ${texts.length} texts.`);

    return {
      statusCode: 202,
      headers: corsHeaders,
      body: 'Accepted'
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[train-features-background function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
