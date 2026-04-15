import { Index, RecordMetadata, PineconeRecord, Pinecone } from '@pinecone-database/pinecone';

export interface TextRecord {
  id: string;
  text: string;
  metadata?: RecordMetadata;
}

export interface EmbedStats {
  writes: number;
  errors: number;
  elapsedMs: number;
}

export interface EmbedOptions<T extends RecordMetadata = RecordMetadata> {
  index: Index<T>;
  texts: TextRecord[];
  embedder?: (texts: string[]) => Promise<number[][]>;
  pc?: Pinecone;
  model?: string;
  batchSize?: number;
  indexName?: string;
  cloud?: string;
  region?: string;
}

export interface ClusterResult<T extends RecordMetadata = RecordMetadata> {
  centroid: number[];
  records: PineconeRecord<T>[];
}

export interface RetrieveAndClusterResult<T extends RecordMetadata = RecordMetadata> {
  clusters: ClusterResult<T>[];
  pcaModel?: any;
}

export interface RetrieveAndClusterOptions<T extends RecordMetadata = RecordMetadata> {
  ids: string[];
  index: Index<T>;
  namespace: string;
  numClusters: number;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
}

export interface ClusterWithTexts {
  texts: string[];
  textIds: string[];
}

export interface NamedCluster extends ClusterWithTexts {
  name: string;
  description: string;
  summary: string;
}
import { RecordMetadata, Index, PineconeRecord } from '@pinecone-database/pinecone';
import { RetrieveAndClusterResult, ClusterResult, RetrieveAndClusterOptions } from './types';
import { customKMeans } from './utils';
import { PCA } from 'ml-pca';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPCAIfRequested(points: number[][], reduceDimensions: boolean, pcaDimensions: number): { finalPoints: number[][], pcaModelJson: any } {
  let finalPoints = points;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pcaModelJson: any = undefined;

  if (reduceDimensions && points.length > 0 && points[0].length > 0) {
    const pca = new PCA(points);
    const nComponents = Math.min(pcaDimensions, pca.getExplainedVariance().length);
    if (nComponents > 0) {
      finalPoints = pca.predict(points, { nComponents }).to2DArray();
      pcaModelJson = pca.toJSON();
    }
  }
  return { finalPoints, pcaModelJson };
}

async function fetchAndFilterRecords<T extends RecordMetadata = RecordMetadata>(
  ids: string[],
  index: Index<T>,
  namespace: string
): Promise<{ validRecords: PineconeRecord<T>[], points: number[][] }> {
  const validRecords: PineconeRecord<T>[] = [];
  const points: number[][] = [];

  if (!ids || ids.length === 0) {
    return { validRecords, points };
  }

  const fetchResponse = await index.namespace(namespace).fetch({ ids });
  const fetchedRecords = fetchResponse.records || {};

  for (const id of ids) {
    const record = fetchedRecords[id];
    if (record && record.values && record.values.length > 0) {
      validRecords.push(record as PineconeRecord<T>);
      points.push(record.values);
    }
  }

  return { validRecords, points };
}

export async function retrieveAndCluster<T extends RecordMetadata = RecordMetadata>(
  options: RetrieveAndClusterOptions<T>
): Promise<RetrieveAndClusterResult<T>> {
  const { ids, index, namespace, numClusters, reduceDimensions = true, pcaDimensions = 20 } = options;

  if (!ids || ids.length === 0) {
    return { clusters: [] };
  }

  const { validRecords, points } = await fetchAndFilterRecords(ids, index, namespace);

  if (points.length === 0) {
    return { clusters: [] };
  }

  if (points.length < numClusters) {
    throw new Error(`Number of clusters (${numClusters}) cannot be greater than the number of valid points (${points.length}).`);
  }

  const reduced = applyPCAIfRequested(points, reduceDimensions, pcaDimensions);
  const finalPoints = reduced.finalPoints;
  const pcaModelJson = reduced.pcaModelJson;

  const { labels, centroids } = customKMeans(finalPoints, numClusters);

  const clusters: ClusterResult<T>[] = centroids.map((centroid: number[]) => ({
    centroid,
    records: []
  }));

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    clusters[label].records.push(validRecords[i]);
  }

  return { clusters, pcaModel: pcaModelJson };
}import { ClusterWithTexts, NamedCluster } from './types';
import { gemmaGenerate } from './gemma';

async function generateClusterNameAndDesc(clusterTexts: string[]): Promise<{ name: string, description: string, summary: string }> {
  const prompt = `
You are a helpful AI assistant. I will provide you with a list of texts belonging to a single cluster.
Please analyze the themes and subjects of these texts and provide:
1. A concise "name" for the cluster.
2. A "description" of the cluster that includes examples of the items in it.
3. A short "summary" of the cluster.

Respond ONLY with a valid JSON object with keys: "name", "description", and "summary". Do not include markdown formatting like \`\`\`json.

Cluster texts:
${JSON.stringify(clusterTexts, null, 2)}
`;

  try {
    const response = await gemmaGenerate(prompt, {
      systemInstruction: "You are an expert at categorizing text. Always output raw, valid JSON."
    });

    let responseText = response.text.trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.substring(7);
    }
    if (responseText.startsWith('```')) {
      responseText = responseText.substring(3);
    }
    if (responseText.endsWith('```')) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    return JSON.parse(responseText);
  } catch (error) {
    console.error("Failed to generate name for cluster:", error);
    return {
      name: "Unknown Cluster",
      description: "Could not generate description.",
      summary: "Could not generate summary."
    };
  }
}

/**
 * Iterates through a list of clusters (sorted by number of texts, descending)
 * and uses Gemma to generate a name, description (with examples), and summary for each cluster.
 *
 * @param clusters - The list of clusters to name.
 * @returns A promise resolving to a list of named clusters.
 */
export async function nameClusters<T extends ClusterWithTexts>(
  clusters: T[]
): Promise<(T & NamedCluster)[]> {
  // Sort clusters from largest number of elements to smallest
  const sortedClusters = [...clusters].sort((a, b) => b.texts.length - a.texts.length);

  const namedClusters: (T & NamedCluster)[] = [];

  for (const cluster of sortedClusters) {
    const generated = await generateClusterNameAndDesc(cluster.texts);

    namedClusters.push({
      ...cluster,
      name: generated.name,
      description: generated.description,
      summary: generated.summary
    });
  }

  return namedClusters;
}
import { RecordMetadata } from '@pinecone-database/pinecone';
import { EmbedOptions, NamedCluster, ClusterWithTexts } from './types';
import { embed } from './embed';
import { retrieveAndCluster } from './cluster';
import { nameClusters } from './nameClusters';
import { connectMongoose } from './mongo';
import mongoose from 'mongoose';

export interface EmbedAndClusterOptions<T extends RecordMetadata = RecordMetadata> extends EmbedOptions<T> {
  numClusters: number;
  namespace?: string;
  skipEmbed?: boolean;
  reduceDimensions?: boolean;
  pcaDimensions?: number;
  mongoDb?: string;
  mongoCollection?: string;
}

export async function embedAndCluster<T extends RecordMetadata = RecordMetadata>(
  options: EmbedAndClusterOptions<T>
): Promise<NamedCluster[]> {
  const { texts, index, numClusters, namespace = '', skipEmbed = false, reduceDimensions, pcaDimensions, mongoDb, mongoCollection, ...embedOpts } = options;

  if (!skipEmbed) {
    await embed({ texts, index, ...embedOpts });
  }

  const ids = texts.map((t) => t.id);
  const { clusters, pcaModel } = await retrieveAndCluster({ ids, index, namespace, numClusters, reduceDimensions, pcaDimensions });

  const textMap = new Map<string, string>();
  for (const t of texts) {
    textMap.set(t.id, t.text);
  }

  const clustersWithTexts: ClusterWithTexts[] = clusters.map((c) => {
    const clusterTexts: string[] = [];
    const clusterTextIds: string[] = [];
    for (const record of c.records) {
      const text = textMap.get(record.id);
      if (text) {
        clusterTexts.push(text);
        clusterTextIds.push(record.id);
      }
    }
    return { texts: clusterTexts, textIds: clusterTextIds };
  });

  const namedClusters = await nameClusters(clustersWithTexts);

  if (mongoDb && mongoCollection && pcaModel) {
    await storeToMongo(mongoDb, mongoCollection, pcaModel, namedClusters);
  }

  return namedClusters;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeToMongo(mongoDb: string, mongoCollection: string, pcaModel: any, namedClusters: NamedCluster[]) {
  try {
    const isConnected = await connectMongoose(mongoDb);
    if (!isConnected) return;

    const pcaSchema = new mongoose.Schema({
      modelBuffer: Buffer,
      createdAt: { type: Date, default: Date.now }
    });

    const clusterSchema = new mongoose.Schema({
      name: String,
      description: String,
      summary: String,
      createdAt: { type: Date, default: Date.now }
    });

    const itemSchema = new mongoose.Schema({
      textId: String,
      clusterId: mongoose.Schema.Types.ObjectId,
      createdAt: { type: Date, default: Date.now }
    });

    const PCAModel = mongoose.models[`${mongoCollection}_pca`] || mongoose.model(`${mongoCollection}_pca`, pcaSchema, `${mongoCollection}_pca`);
    const ClusterModel = mongoose.models[`${mongoCollection}_clusters`] || mongoose.model(`${mongoCollection}_clusters`, clusterSchema, `${mongoCollection}_clusters`);
    const ItemModel = mongoose.models[`${mongoCollection}_items`] || mongoose.model(`${mongoCollection}_items`, itemSchema, `${mongoCollection}_items`);

    const pcaString = JSON.stringify(pcaModel);
    await PCAModel.create({ modelBuffer: Buffer.from(pcaString, 'utf-8') });

    for (const nc of namedClusters) {
      const clusterDoc = await ClusterModel.create({
        name: nc.name,
        description: nc.description,
        summary: nc.summary
      });

      const itemDocs = nc.textIds.map(id => ({
        textId: id,
        clusterId: clusterDoc._id
      }));

      if (itemDocs.length > 0) {
        await ItemModel.insertMany(itemDocs);
      }
    }
  } catch (err) {
    console.error('Failed to store PCA model and clusters to Mongo:', err);
  }
}
import { Handler } from '@netlify/functions';
import { Pinecone } from '@pinecone-database/pinecone';
import { embedAndCluster, EmbedAndClusterOptions } from '../../lib/index';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
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
    const { texts, numClusters = 2, batchSize = 50, namespace, skipEmbed = false, cloud, region } = parsedBody;
    const indexName = (parsedBody.indexName || 'default-index').toLowerCase();
    const mongoDb = parsedBody.mongoDb?.toLowerCase();
    const mongoCollection = parsedBody.mongoCollection;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      index = index.namespace(namespace) as any;
    }

    const options: EmbedAndClusterOptions = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    await embedAndCluster(options);
    console.log(`[cluster-background function] embedAndCluster completed successfully. Processed ${texts.length} texts into ${numClusters} clusters.`);

    return {
      statusCode: 202,
      headers: corsHeaders,
      body: 'Accepted'
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[cluster-background function] Uncaught error during processing:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
