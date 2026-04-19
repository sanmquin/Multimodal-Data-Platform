import { Handler } from '@netlify/functions';
import { assignClusters } from '../../lib/assignClusters';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[assign-clusters-background function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[assign-clusters-background function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[assign-clusters-background function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts, mongoCollection } = parsedBody;
    const mongoDb = parsedBody.mongoDb?.toLowerCase();

    console.log(`[assign-clusters-background function] Processing payload: mongoDb: '${mongoDb}', mongoCollection: '${mongoCollection}', texts count: ${texts?.length}`);

    const options = {
      mongoDb,
      mongoCollection,
      texts
    };

    console.log(`[assign-clusters-background function] Calling assignClusters() logic...`);
    await assignClusters(options);
    console.log(`[assign-clusters-background function] assignClusters completed successfully.`);

    return {
      statusCode: 202,
      headers: corsHeaders,
      body: 'Accepted'
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[assign-clusters-background function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
