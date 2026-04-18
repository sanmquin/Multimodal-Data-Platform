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

export function getFeatureModels(mongoCollection: string) {
  const pcaSchema = new mongoose.Schema({
    categoryId: { type: String, required: true },
    modelBuffer: Buffer,
    createdAt: { type: Date, default: Date.now }
  });

  const featureSchema = new mongoose.Schema({
    categoryId: { type: String, required: true },
    name: String,
    description: String,
    modelBuffer: Buffer,
    error: Number,
    averageValue: Number,
    createdAt: { type: Date, default: Date.now }
  });

  const evaluationSchema = new mongoose.Schema({
    categoryId: { type: String, required: true },
    textId: String,
    text: String,
    evaluations: [{
      featureName: String,
      score: Number,
      inferenceValue: Number
    }],
    createdAt: { type: Date, default: Date.now }
  });

  const performanceSchema = new mongoose.Schema({
    categoryId: { type: String, required: true },
    featureName: String,
    correlation: Number,
    createdAt: { type: Date, default: Date.now }
  });

  const PCAModel = mongoose.models[`${mongoCollection}_pca`] || mongoose.model(`${mongoCollection}_pca`, pcaSchema, `${mongoCollection}_pca`);
  const FeatureModel = mongoose.models[`${mongoCollection}_features`] || mongoose.model(`${mongoCollection}_features`, featureSchema, `${mongoCollection}_features`);
  const EvaluationModel = mongoose.models[`${mongoCollection}_evaluations`] || mongoose.model(`${mongoCollection}_evaluations`, evaluationSchema, `${mongoCollection}_evaluations`);
  const PerformanceModel = mongoose.models[`${mongoCollection}_performance`] || mongoose.model(`${mongoCollection}_performance`, performanceSchema, `${mongoCollection}_performance`);

  return { PCAModel, FeatureModel, EvaluationModel, PerformanceModel };
}
