import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { embedAndCluster, EmbedAndClusterOptions } from '../../lib/index';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event, context) => {
  console.log(`[cluster-background function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[cluster-background function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[cluster-background function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts, numClusters = 2, batchSize = 50, namespace, skipEmbed = false, cloud, region, mongoDb, mongoCollection } = parsedBody;
    const indexName = (parsedBody.indexName || 'default-index').toLowerCase();

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[cluster-background function] Validation failed: texts array is required.`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    console.log(`[cluster-background function] Processing payload: ${texts.length} texts, numClusters: ${numClusters}, batchSize: ${batchSize}, indexName: '${indexName}', namespace: '${namespace || 'default'}', skipEmbed: ${skipEmbed}`);

    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      console.error(`[cluster-background function] Error: PINECONE_API_KEY environment variable is not set`);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'PINECONE_API_KEY environment variable is not set' })
      };
    }

    console.log(`[cluster-background function] Initializing Pinecone client...`);
    const pc = new Pinecone({ apiKey });
    let index = pc.index(indexName);

    if (namespace) {
      index = index.namespace(namespace) as any;
    }

    const options: EmbedAndClusterOptions = {
      index: index as any,
      texts,
      batchSize,
      pc,
      model: 'multilingual-e5-large',
      indexName,
      numClusters,
      namespace,
      skipEmbed,
      cloud,
      region,
      mongoDb,
      mongoCollection
    };

    console.log(`[cluster-background function] Calling embedAndCluster() logic...`);
    const namedClusters = await embedAndCluster(options);
    console.log(`[cluster-background function] embedAndCluster completed successfully. Clusters: ${JSON.stringify(namedClusters, null, 2)}`);

    return {
      statusCode: 202,
      headers: corsHeaders,
      body: 'Accepted'
    };
  } catch (error: any) {
    console.error(`[cluster-background function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
