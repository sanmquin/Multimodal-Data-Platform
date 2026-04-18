import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { embed, EmbedOptions } from '../../lib/index';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  console.log(`[embed function] Received ${event.httpMethod} request`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.warn(`[embed function] Invalid method: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: 'Method Not Allowed'
    };
  }

  try {
    const bodyText = event.body || '{}';
    console.log(`[embed function] Parsing request body... length: ${bodyText.length} characters`);
    const parsedBody = JSON.parse(bodyText);
    const { texts, batchSize = 50, namespace, cloud, region, reduceDimensions, pcaDimensions, mongoDb, mongoCollection } = parsedBody;
    const indexName = (parsedBody.indexName || 'default-index').toLowerCase();

    if (!texts || !Array.isArray(texts)) {
      console.warn(`[embed function] Validation failed: texts array is required. Received: typeof texts = ${typeof texts}`);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'texts array is required' })
      };
    }

    console.log(`[embed function] Processing payload: ${texts.length} texts, batchSize: ${batchSize}, indexName: '${indexName}', namespace: '${namespace || 'default'}'`);

    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      console.error(`[embed function] Error: PINECONE_API_KEY environment variable is not set`);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'PINECONE_API_KEY environment variable is not set' })
      };
    }

    console.log(`[embed function] Initializing Pinecone client...`);
    const pc = new Pinecone({ apiKey });
    let index = pc.index(indexName);

    if (namespace) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      index = index.namespace(namespace) as any;
    }

    const options: EmbedOptions = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      index: index as any,
      texts,
      batchSize,
      pc,
      model: 'multilingual-e5-large',
      indexName,
      cloud,
      region
    };

    let statsObj;

    if (reduceDimensions || (mongoDb && mongoCollection)) {
      console.log(`[embed function] Calling embedAndReduce logic...`);
      const { embedAndReduce } = await import('../../lib/index');
      const { points, reducedPoints, pcaModelJson, stats } = await embedAndReduce({
        ...options,
        reduceDimensions: reduceDimensions ?? false,
        pcaDimensions,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        index: index as any,
        namespace: namespace || ''
      });

      statsObj = stats || {};

      if (mongoDb && mongoCollection) {
        console.log(`[embed function] Storing embeddings to MongoDB...`);
        const { connectMongoose } = await import('../../lib/mongo');
        const { getEmbeddingModels } = await import('../../lib/models');
        if (await connectMongoose(mongoDb)) {
          const { EmbeddingModel, PCAModel } = getEmbeddingModels(mongoCollection);

          if (pcaModelJson) {
            // pcaModelJson is already JSON from applyPCAIfRequested
            await PCAModel.create({ modelBuffer: Buffer.from(JSON.stringify(pcaModelJson), 'utf-8') });
          }

          const docs = texts.map((t: any, i: number) => ({
            textId: t.id,
            text: t.text,
            values: points[i],
            reducedDimensions: reducedPoints[i] || []
          }));
          await EmbeddingModel.insertMany(docs);
        }
      }
    } else {
      console.log(`[embed function] Calling embed() logic...`);
      statsObj = await embed(options);
    }

    console.log(`[embed function] Embed completed successfully. Stats: ${JSON.stringify(statsObj)}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(statsObj)
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[embed function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
