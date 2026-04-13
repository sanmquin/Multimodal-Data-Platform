import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { embed, EmbedOptions } from '../../lib/index';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { texts, batchSize = 50, indexName = 'default-index', namespace } = JSON.parse(event.body || '{}');

    if (!texts || !Array.isArray(texts)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'PINECONE_API_KEY environment variable is not set' })
      };
    }

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

    const stats = await embed(options);

    return {
      statusCode: 200,
      body: JSON.stringify(stats)
    };
  } catch (error: any) {
    console.error('Embed error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
