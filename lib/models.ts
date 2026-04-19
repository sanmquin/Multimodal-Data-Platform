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

export function getEmbeddingModels(mongoCollection: string) {
  const pcaSchema = new mongoose.Schema({
    modelBuffer: Buffer,
    createdAt: { type: Date, default: Date.now }
  });

  const embeddingSchema = new mongoose.Schema({
    textId: String,
    text: String,
    values: [Number],
    reducedDimensions: [Number],
    createdAt: { type: Date, default: Date.now }
  });

  const PCAModel = mongoose.models[`${mongoCollection}_pca`] || mongoose.model(`${mongoCollection}_pca`, pcaSchema, `${mongoCollection}_pca`);
  const EmbeddingModel = mongoose.models[`${mongoCollection}_embeddings`] || mongoose.model(`${mongoCollection}_embeddings`, embeddingSchema, `${mongoCollection}_embeddings`);

  return { PCAModel, EmbeddingModel };
}

export function getFeatureModels(mongoCollection: string) {
  const pcaSchema = new mongoose.Schema({
    categoryId: { type: String, required: false },
    clusterId: { type: String, required: false },
    version: { type: Number, default: 1 },
    modelBuffer: Buffer,
    createdAt: { type: Date, default: Date.now }
  });

  const featureSchema = new mongoose.Schema({
    categoryId: { type: String, required: false },
    clusterId: { type: String, required: false },
    version: { type: Number, default: 1 },
    name: String,
    description: String,
    isClustered: { type: Boolean, default: false },
    modelBuffer: Buffer,
    error: Number,
    averageValue: Number,
    createdAt: { type: Date, default: Date.now }
  });

  const evaluationSchema = new mongoose.Schema({
    categoryId: { type: String, required: false },
    clusterId: { type: String, required: false },
    version: { type: Number, default: 1 },
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
    categoryId: { type: String, required: false },
    clusterId: { type: String, required: false },
    version: { type: Number, default: 1 },
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

export function getPromptModels(collectionName: string = 'prompts') {
  const promptSchema = new mongoose.Schema({
    category: String,
    model: String,
    prompt: String,
    result: mongoose.Schema.Types.Mixed,
    elapsedTime: Number,
    createdAt: { type: Date, default: Date.now }
  });

  const PromptModel = mongoose.models[collectionName] || mongoose.model(collectionName, promptSchema, collectionName);

  return { PromptModel };
}
