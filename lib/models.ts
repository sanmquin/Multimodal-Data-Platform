import mongoose from 'mongoose';

export function getMongooseModels(mongoCollection: string) {
  const pcaSchema = new mongoose.Schema({
    modelBuffer: Buffer,
    createdAt: { type: Date, default: Date.now }
  });

  const clusterSchema = new mongoose.Schema({
    name: String,
    description: String,
    summary: String,
    version: { type: Number, default: 1 },
    centroid: [Number],
    createdAt: { type: Date, default: Date.now }
  });

  const itemSchema = new mongoose.Schema({
    textId: String,
    clusterId: mongoose.Schema.Types.ObjectId,
    reducedDimensions: [Number],
    createdAt: { type: Date, default: Date.now }
  });

  const PCAModel = mongoose.models[`${mongoCollection}_pca`] || mongoose.model(`${mongoCollection}_pca`, pcaSchema, `${mongoCollection}_pca`);
  const ClusterModel = mongoose.models[`${mongoCollection}_clusters`] || mongoose.model(`${mongoCollection}_clusters`, clusterSchema, `${mongoCollection}_clusters`);
  const ItemModel = mongoose.models[`${mongoCollection}_items`] || mongoose.model(`${mongoCollection}_items`, itemSchema, `${mongoCollection}_items`);

  return { PCAModel, ClusterModel, ItemModel };
}
