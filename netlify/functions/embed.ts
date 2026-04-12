import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { embed, EmbedOptions } from '../../src/index';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { texts, batchSize = 50, indexName = 'default-index' } = JSON.parse(event.body || '{}');

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
    const index = pc.index(indexName);

    const embedder = async (texts: string[]) => {
      const embeddings = await pc.inference.embed({
        model: 'multilingual-e5-large',
        inputs: texts,
        parameters: {
          inputType: 'passage',
          truncate: 'END'
        }
      });
      return embeddings.data.map(d => (d as any).values as number[]);
    };

    const options: EmbedOptions = {
      index: index as any,
      texts,
      batchSize,
      embedder
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
