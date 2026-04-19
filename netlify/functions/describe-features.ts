import { Handler } from '@netlify/functions';
import { describeFeatures } from '../../lib/describeFeatures';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[describe-features function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[describe-features function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[describe-features function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts } = parsedBody;

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[describe-features function] Validation failed: texts array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    console.log(`[describe-features function] Processing ${texts.length} texts synchronously...`);
    const rawTexts = texts.map((t: any) => t.text || t);
    const features = await describeFeatures(rawTexts);
    console.log(`[describe-features function] Completed describing ${features.length} features.`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ features })
    };

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[describe-features function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
