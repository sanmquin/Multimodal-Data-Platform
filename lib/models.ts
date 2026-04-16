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

  const featureSchema = new mongoose.Schema({ name: String, description: String, createdAt: { type: Date, default: Date.now } });
  const evaluationSchema = new mongoose.Schema({ text: String, evaluations: [{ featureName: String, score: Number }], createdAt: { type: Date, default: Date.now } });
  const linearRegressionSchema = new mongoose.Schema({ modelBuffer: Buffer, createdAt: { type: Date, default: Date.now } });

  const FeatureModel = mongoose.models[`${mongoCollection}_features`] || mongoose.model(`${mongoCollection}_features`, featureSchema, `${mongoCollection}_features`);
  const EvaluationModel = mongoose.models[`${mongoCollection}_evaluations`] || mongoose.model(`${mongoCollection}_evaluations`, evaluationSchema, `${mongoCollection}_evaluations`);
  const LinearRegressionModel = mongoose.models[`${mongoCollection}_linear_regression`] || mongoose.model(`${mongoCollection}_linear_regression`, linearRegressionSchema, `${mongoCollection}_linear_regression`);

  return { PCAModel, ClusterModel, ItemModel, FeatureModel, EvaluationModel, LinearRegressionModel };
}
