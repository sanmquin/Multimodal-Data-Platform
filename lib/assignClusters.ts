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

  if (!texts || texts.length === 0) return;

  const isConnected = await connectMongoose(mongoDb);
  if (!isConnected) throw new Error("Failed to connect to MongoDB");

  const { ClusterModel, ItemModel } = getMongooseModels(mongoCollection);

  const latestCluster = await ClusterModel.findOne().sort({ version: -1 });
  if (!latestCluster) {
    throw new Error("No clusters found.");
  }
  const currentVersion = latestCluster.version || 1;

  const currentClusters = await ClusterModel.find({ version: currentVersion }).lean();

  if (currentClusters.length === 0) {
      throw new Error("No clusters found for the current version.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clustersInfo = currentClusters.map((c: any) => ({
    name: c.name,
    description: c.description
  }));

  console.log("Assign cluster descriptions:");

  // Create a mapping from lowercased name to cluster ID for fast lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterMap: Record<string, string> = {};
  for (const c of currentClusters) {
      clusterMap[(c as any).name.toLowerCase()] = (c as any)._id.toString();
  }

  const basePrompt = getPrompt('assignClusters') || '';
  const batchSize = 10;

  const processBatch = async (batchTexts: TextItem[]) => {
      let prompt = basePrompt.replace('{{clusters}}', JSON.stringify(clustersInfo, null, 2));
      prompt = prompt.replace('{{texts}}', JSON.stringify(batchTexts, null, 2));

      try {
          const response = await gemmaGenerate(prompt, {
            systemInstruction: "You are an expert taxonomist. Always output raw, valid JSON. Only return a JSON array.",
            promptCategory: 'assignClusters'
          });

          let text = response.text.trim();
          if (text.startsWith('```json')) text = text.substring(7);
          if (text.startsWith('```')) text = text.substring(3);
          if (text.endsWith('```')) text = text.slice(0, -3);

          const assignments = JSON.parse(text.trim());
          return assignments;
      } catch (e) {
          console.error("Error processing batch", e);
          return null;
      }
  };

  const toSave = [];
  let unassignedTexts: TextItem[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batchTexts = texts.slice(i, i + batchSize);
    const assignments = await processBatch(batchTexts);

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
      console.log(`[assignClusters] Second pass for ${unassignedTexts.length} unassigned texts...`);
      for (let i = 0; i < unassignedTexts.length; i += batchSize) {
          const batchTexts = unassignedTexts.slice(i, i + batchSize);
          const assignments = await processBatch(batchTexts);

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
      await ItemModel.insertMany(toSave);
  }
}
