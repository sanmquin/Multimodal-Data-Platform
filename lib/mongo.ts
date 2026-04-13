import { MongoClient } from 'mongodb';

let cachedClient: MongoClient | null = null;

export async function getMongoClient(): Promise<MongoClient | null> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new MongoClient(uri);
  await cachedClient.connect();
  return cachedClient;
}
