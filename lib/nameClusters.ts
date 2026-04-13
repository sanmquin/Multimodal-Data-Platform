import { ClusterWithTexts, NamedCluster } from './types';
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
