import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { featurePipeline, FeaturePipelineOptions } from '../../lib/index';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[features-background function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[features-background function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[features-background function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts, model, reduceDimensions, pcaDimensions, mongoCollection, categoryId } = parsedBody;
    const mongoDb = parsedBody.mongoDb?.toLowerCase();

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[features-background function] Validation failed: texts array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    if (!categoryId) {
      console.warn(`[features-background function] Validation failed: categoryId is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'categoryId is required' })
      };
    }

    console.log(`[features-background function] Processing payload: ${texts.length} texts`);

    const apiKey = process.env.PINECONE_API_KEY;
    let pc: Pinecone | undefined;
    if (apiKey) {
      console.log(`[features-background function] Initializing Pinecone client...`);
      pc = new Pinecone({ apiKey });
    } else {
      console.log(`[features-background function] PINECONE_API_KEY not found. Assuming custom embedder or skip.`);
    }

    const options: FeaturePipelineOptions = {
      texts,
      pc,
      model: model || 'multilingual-e5-large',
      reduceDimensions,
      pcaDimensions,
      mongoDb,
      mongoCollection,
      categoryId
    };

    console.log(`[features-background function] Calling featurePipeline() logic...`);
    await featurePipeline(options);
    console.log(`[features-background function] featurePipeline completed successfully. Processed ${texts.length} texts.`);

    return {
      statusCode: 202,
      headers: corsHeaders,
      body: 'Accepted'
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[features-background function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
