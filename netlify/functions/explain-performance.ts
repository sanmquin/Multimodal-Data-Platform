import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { explainPerformance, ExplainPerformanceOptions } from '../../lib/index';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[explain-performance function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[explain-performance function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[explain-performance function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts, model, reduceDimensions, mongoCollection, categoryId, featureName, indexName, namespace, cloud, region } = parsedBody;
    const mongoDb = parsedBody.mongoDb?.toLowerCase();

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[explain-performance function] Validation failed: texts array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    if (!mongoDb || !mongoCollection || !categoryId || !featureName) {
      console.warn(`[explain-performance function] Validation failed: mongoDb, mongoCollection, categoryId, and featureName are required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'mongoDb, mongoCollection, categoryId, and featureName are required' })
      };
    }

    console.log(`[explain-performance function] Processing payload: ${texts.length} texts for feature ${featureName}`);

    const apiKey = process.env.PINECONE_API_KEY;
    let pc: Pinecone | undefined;
    if (apiKey) {
      console.log(`[explain-performance function] Initializing Pinecone client...`);
      pc = new Pinecone({ apiKey });
    } else {
      console.log(`[explain-performance function] PINECONE_API_KEY not found. Assuming custom embedder or skip.`);
    }

    const options: ExplainPerformanceOptions = {
      texts,
      pc,
      model: model || 'multilingual-e5-large',
      reduceDimensions: reduceDimensions ?? true,
      mongoDb,
      mongoCollection,
      categoryId,
      featureName,
      indexName,
      namespace,
      cloud,
      region
    };

    console.log(`[explain-performance function] Calling explainPerformance() logic...`);
    const result = await explainPerformance(options);
    console.log(`[explain-performance function] explainPerformance completed successfully. Correlation: ${result.correlation}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result)
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[explain-performance function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
