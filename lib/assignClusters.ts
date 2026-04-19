import { connectMongoose } from './mongo';
import { getMongooseModels } from './models';
import { gemmaGenerate } from './gemma';
import { getPrompt } from './prompts';

export interface TextItem {
  id: string;
  text: string;
}

export interface AssignClustersOptions {
  mongoDb: string;
  mongoCollection: string;
  texts: TextItem[];
}

export async function assignClusters(options: AssignClustersOptions): Promise<void> {
  const { mongoDb, mongoCollection, texts } = options;
  console.log(`[assignClusters] Starting assignment process for collection: ${mongoCollection}`);

  if (!texts || texts.length === 0) {
    console.log(`[assignClusters] No texts provided. Exiting.`);
    return;
  }

  console.log(`[assignClusters] Connecting to MongoDB: ${mongoDb}...`);
  const isConnected = await connectMongoose(mongoDb);
  if (!isConnected) {
    console.error(`[assignClusters] MongoDB connection failed.`);
    throw new Error("Failed to connect to MongoDB");
  }
  console.log(`[assignClusters] Connected to MongoDB successfully.`);

  const { ClusterModel, ItemModel } = getMongooseModels(mongoCollection);

  console.log(`[assignClusters] Fetching latest cluster version...`);
  const latestCluster = await ClusterModel.findOne().sort({ version: -1 });
  if (!latestCluster) {
    console.error(`[assignClusters] No clusters found in collection: ${mongoCollection}_clusters`);
    throw new Error(`No clusters found in the '${mongoCollection}_clusters' collection. You must run the clustering pipeline on this collection before assigning new items.`);
  }
  const currentVersion = latestCluster.version || 1;
  console.log(`[assignClusters] Latest cluster version is ${currentVersion}.`);

  console.log(`[assignClusters] Fetching all clusters for version ${currentVersion}...`);
  const currentClusters = await ClusterModel.find({ version: currentVersion }).lean();

  if (currentClusters.length === 0) {
      console.error(`[assignClusters] No clusters found for version ${currentVersion} in collection: ${mongoCollection}_clusters.`);
      throw new Error(`No clusters found for version ${currentVersion} in the '${mongoCollection}_clusters' collection. You must run the clustering pipeline on this collection before assigning new items.`);
  }
  console.log(`[assignClusters] Found ${currentClusters.length} clusters for version ${currentVersion}.`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clustersInfo = currentClusters.map((c: any) => ({
    name: c.name,
    description: c.description
  }));

  console.log(`[assignClusters] Extracted cluster descriptions for assignment mapping.`);

  // Create a mapping from lowercased name to cluster ID for fast lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterMap: Record<string, string> = {};
  for (const c of currentClusters) {
      clusterMap[(c as any).name.toLowerCase()] = (c as any)._id.toString();
  }

  const basePrompt = getPrompt('assignClusters') || '';
  const batchSize = 10;

  const processBatch = async (batchTexts: TextItem[], pass: number = 1) => {
      console.log(`[assignClusters] [Pass ${pass}] Processing batch of ${batchTexts.length} texts...`);
      let prompt = basePrompt.replace('{{clusters}}', JSON.stringify(clustersInfo, null, 2));
      prompt = prompt.replace('{{texts}}', JSON.stringify(batchTexts, null, 2));

      try {
          const response = await gemmaGenerate(prompt, {
            systemInstruction: "You are an expert taxonomist. Always output raw, valid JSON. Only return a JSON array.",
            promptCategory: 'assignClusters',
            mongoDb
          });

          let text = response.text.trim();
          if (text.startsWith('```json')) text = text.substring(7);
          if (text.startsWith('```')) text = text.substring(3);
          if (text.endsWith('```')) text = text.slice(0, -3);

          const assignments = JSON.parse(text.trim());
          console.log(`[assignClusters] [Pass ${pass}] Batch completed. Returned ${assignments.length} assignments.`);
          return assignments;
      } catch (e) {
          console.error(`[assignClusters] [Pass ${pass}] Error processing batch:`, e);
          return null;
      }
  };

  const toSave = [];
  let unassignedTexts: TextItem[] = [];

  console.log(`[assignClusters] Starting Pass 1 for ${texts.length} texts across multiple batches...`);
  for (let i = 0; i < texts.length; i += batchSize) {
    const batchTexts = texts.slice(i, i + batchSize);
    const assignments = await processBatch(batchTexts, 1);

    if (assignments && Array.isArray(assignments)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assignedIds = new Set();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const a of assignments) {
            const lowerName = a.clusterName ? a.clusterName.toLowerCase() : "";
            if (clusterMap[lowerName]) {
                toSave.push({ textId: a.id, clusterId: clusterMap[lowerName] });
                assignedIds.add(a.id);
            }
        }

        // find unassigned texts from this batch
        for (const t of batchTexts) {
            if (!assignedIds.has(t.id)) {
                unassignedTexts.push(t);
            }
        }
    } else {
        // whole batch failed
        unassignedTexts = unassignedTexts.concat(batchTexts);
    }
  }

  // Second pass for unassigned texts
  if (unassignedTexts.length > 0) {
      console.log(`[assignClusters] Starting Pass 2 for ${unassignedTexts.length} unassigned texts...`);
      for (let i = 0; i < unassignedTexts.length; i += batchSize) {
          const batchTexts = unassignedTexts.slice(i, i + batchSize);
          const assignments = await processBatch(batchTexts, 2);

          if (assignments && Array.isArray(assignments)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const a of assignments) {
                const lowerName = a.clusterName ? a.clusterName.toLowerCase() : "";
                if (clusterMap[lowerName]) {
                    toSave.push({ textId: a.id, clusterId: clusterMap[lowerName] });
                }
            }
          }
      }
  }

  if (toSave.length > 0) {
      console.log(`[assignClusters] Saving ${toSave.length} total assignments to MongoDB...`);
      await ItemModel.insertMany(toSave);
      console.log(`[assignClusters] Assignments saved successfully.`);
  } else {
      console.log(`[assignClusters] No successful assignments generated to save.`);
  }
}
