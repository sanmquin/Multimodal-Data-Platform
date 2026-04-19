import { Handler } from '@netlify/functions';
import { aggregateFeatures } from '../../lib/aggregateFeatures';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[aggregate-features function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[aggregate-features function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[aggregate-features function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { categoryIds, clusterId, mongoCollection } = parsedBody;
    const mongoDb = parsedBody.mongoDb?.toLowerCase();

    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      console.warn(`[aggregate-features function] Validation failed: categoryIds array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'categoryIds array is required and cannot be empty' })
      };
    }

    if (!clusterId) {
      console.warn(`[aggregate-features function] Validation failed: clusterId is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'clusterId is required' })
      };
    }

    if (!mongoDb || !mongoCollection) {
      console.warn(`[aggregate-features function] Validation failed: mongoDb and mongoCollection are required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'mongoDb and mongoCollection are required' })
      };
    }

    console.log(`[aggregate-features function] Processing synchronous aggregation for cluster: ${clusterId}`);

    const features = await aggregateFeatures({
      categoryIds,
      clusterId,
      mongoDb,
      mongoCollection
    });

    console.log(`[aggregate-features function] Completed aggregating ${features.length} features.`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ features })
    };

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[aggregate-features function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
