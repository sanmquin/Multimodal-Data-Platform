import { Handler } from '@netlify/functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[cluster function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[cluster function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[cluster function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts } = parsedBody;

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[cluster function] Validation failed: texts array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    console.log(`[cluster function] Validation passed. Delegating ${texts.length} texts to background function...`);

    // Determine the host for triggering the background function
    const host = event.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const backgroundUrl = `${protocol}://${host}/.netlify/functions/cluster-background`;

    console.log(`[cluster function] Triggering background function at: ${backgroundUrl}`);

    // Trigger the background function asynchronously. We must await the request being sent successfully
    // before returning 202, otherwise the serverless function execution container could freeze and kill the request.
    try {
      const response = await fetch(backgroundUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: bodyText
      });
      await response.text(); // Consume the response body to ensure the request completes
      console.log(`[cluster function] Background function triggered successfully. Returning 202 Accepted.`);
    } catch (err) {
      console.error(`[cluster function] Error triggering background function:`, err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to trigger background job' })
      };
    }

    return {
      statusCode: 202,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Accepted. Clustering job has been triggered in the background.' })
    };

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[cluster function] Uncaught error during validation:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
