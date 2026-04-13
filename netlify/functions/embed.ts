import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { embed, EmbedOptions } from '../../lib/index';

export const handler: Handler = async (event, context) => {
  console.log(`[embed function] Received ${event.httpMethod} request`);

  if (event.httpMethod !== 'POST') {
    console.warn(`[embed function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[embed function] Parsing request body... length: ${bodyText.length} characters`);
    const { texts, batchSize = 50, indexName = 'default-index', namespace } = JSON.parse(bodyText);

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[embed function] Validation failed: texts array is required. Received: typeof texts = ${typeof texts}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    console.log(`[embed function] Processing payload: ${texts.length} texts, batchSize: ${batchSize}, indexName: '${indexName}', namespace: '${namespace || 'default'}'`);

    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      console.error(`[embed function] Error: PINECONE_API_KEY environment variable is not set`);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'PINECONE_API_KEY environment variable is not set' })
      };
    }

    console.log(`[embed function] Initializing Pinecone client...`);
    const pc = new Pinecone({ apiKey });
    let index = pc.index(indexName);

    if (namespace) {
      index = index.namespace(namespace) as any;
    }

    const options: EmbedOptions = {
      index: index as any,
      texts,
      batchSize,
      pc,
      model: 'multilingual-e5-large',
      indexName
    };

    console.log(`[embed function] Calling embed() logic...`);
    const stats = await embed(options);
    console.log(`[embed function] Embed completed successfully. Stats: ${JSON.stringify(stats)}`);

    return {
      statusCode: 200,
      body: JSON.stringify(stats)
    };
  } catch (error: any) {
    console.error(`[embed function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
