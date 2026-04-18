import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { featureInference, FeatureInferenceOptions } from '../../lib/index';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[feature-inference function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[feature-inference function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[feature-inference function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts, model, reduceDimensions, mongoCollection, categoryId, indexName, namespace } = parsedBody;
    const mongoDb = parsedBody.mongoDb?.toLowerCase();

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[feature-inference function] Validation failed: texts array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    if (!mongoDb || !mongoCollection || !categoryId) {
      console.warn(`[feature-inference function] Validation failed: mongoDb, mongoCollection, and categoryId are required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'mongoDb, mongoCollection, and categoryId are required' })
      };
    }

    console.log(`[feature-inference function] Processing payload: ${texts.length} texts`);

    const apiKey = process.env.PINECONE_API_KEY;
    let pc: Pinecone | undefined;
    if (apiKey) {
      console.log(`[feature-inference function] Initializing Pinecone client...`);
      pc = new Pinecone({ apiKey });
    } else {
      console.log(`[feature-inference function] PINECONE_API_KEY not found. Assuming custom embedder or skip.`);
    }

    const options: FeatureInferenceOptions = {
      texts,
      pc,
      model: model || 'multilingual-e5-large',
      reduceDimensions: reduceDimensions ?? true,
      mongoDb,
      mongoCollection,
      categoryId,
      indexName,
      namespace
    };

    console.log(`[feature-inference function] Calling featureInference() logic...`);
    const evaluations = await featureInference(options);
    console.log(`[feature-inference function] featureInference completed successfully. Returned ${evaluations.length} evaluations.`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ evaluations })
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[feature-inference function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
