import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { refineClusters } from '../../lib/refineClusters';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[refine-clusters-background function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[refine-clusters-background function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[refine-clusters-background function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { namespace } = parsedBody;
    const indexName = (parsedBody.indexName || 'default-index').toLowerCase();
    const mongoDb = parsedBody.mongoDb?.toLowerCase();
    const mongoCollection = parsedBody.mongoCollection;

    console.log(`[refine-clusters-background function] Processing payload: indexName: '${indexName}', namespace: '${namespace || 'default'}', mongoDb: '${mongoDb}', mongoCollection: '${mongoCollection}'`);

    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      console.error(`[refine-clusters-background function] Error: PINECONE_API_KEY environment variable is not set`);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'PINECONE_API_KEY environment variable is not set' })
      };
    }

    console.log(`[refine-clusters-background function] Initializing Pinecone client...`);
    const pc = new Pinecone({ apiKey });
    let index = pc.index(indexName);

    if (namespace) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      index = index.namespace(namespace) as any;
    }

    const options = {
      mongoDb,
      mongoCollection,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      index: index as any,
      namespace: namespace || ''
    };

    console.log(`[refine-clusters-background function] Calling refineClusters() logic...`);
    await refineClusters(options);
    console.log(`[refine-clusters-background function] refineClusters completed successfully.`);

    return {
      statusCode: 202,
      headers: corsHeaders,
      body: 'Accepted'
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[refine-clusters-background function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
