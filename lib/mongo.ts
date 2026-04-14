import mongoose from 'mongoose';

let isConnected = false;

export async function connectMongoose(mongoDb: string): Promise<boolean> {
  if (!mongoDb || typeof mongoDb !== 'string' || /[/\\. "$*<>:|?]/.test(mongoDb)) {
    console.error('Invalid MongoDB database name provided.');
    return false;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    return false;
  }

  if (isConnected && mongoose.connection.readyState === 1 && mongoose.connection.name === mongoDb) {
    return true;
  }

  // If connected to a different DB, we may need to use a different connection or handle it.
  // For simplicity, we connect to the target DB using the base URI.
  // Mongoose connection handles the DB name if specified in connect, or we can use useDb.

  try {
    await mongoose.connect(uri, { dbName: mongoDb });
    isConnected = true;
    return true;
  } catch (err) {
    console.error('Failed to connect to MongoDB with Mongoose:', err);
    return false;
  }
}

export function getMongooseConnection() {
  return mongoose.connection;
}
