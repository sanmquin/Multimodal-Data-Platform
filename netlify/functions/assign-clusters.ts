import { Handler } from '@netlify/functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[assign-clusters function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[assign-clusters function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[assign-clusters function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts, mongoDb, mongoCollection } = parsedBody;

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[assign-clusters function] Validation failed: texts array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    if (!mongoDb || !mongoCollection) {
      console.warn(`[assign-clusters function] Validation failed: mongoDb and mongoCollection are required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'mongoDb and mongoCollection are required' })
      };
    }

    console.log(`[assign-clusters function] Validation passed. Delegating to background function...`);

    // Determine the host for triggering the background function
    const host = event.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const backgroundUrl = `${protocol}://${host}/.netlify/functions/assign-clusters-background`;

    console.log(`[assign-clusters function] Triggering background function at: ${backgroundUrl}`);

    // Trigger the background function asynchronously. We must await the request being sent successfully
    // before returning 202, otherwise the serverless function execution container could freeze and kill the request.
    try {
      await fetch(backgroundUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: bodyText
      });
      console.log(`[assign-clusters function] Background function triggered successfully. Returning 202 Accepted.`);
    } catch (err) {
      console.error(`[assign-clusters function] Error triggering background function:`, err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to trigger background job' })
      };
    }

    return {
      statusCode: 202,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Accepted. Assign clusters job has been triggered in the background.' })
    };

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[assign-clusters function] Uncaught error during validation:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
