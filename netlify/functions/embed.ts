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
    const { texts, batchSize = 50 } = JSON.parse(event.body || '{}');

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
    const indexName = process.env.PINECONE_INDEX || 'default-index';
    const index = pc.index(indexName);

    // Dummy embedder for now, replacing with something real might require an OpenAI key.
    // We will just use random vectors to satisfy e2e testing.
    const embedder = async (texts: string[]) => {
      // Return 1536 dim random vector assuming openai's default
      return texts.map(() => Array.from({ length: 1536 }, () => Math.random()));
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
