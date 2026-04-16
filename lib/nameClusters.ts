import { ClusterWithTexts, NamedCluster } from './types';
import { gemmaGenerate } from './gemma';
import { getPrompt } from './prompts';

async function generateClusterNameAndDesc(
  clusterTexts: string[],
  previousClusters: string[] = [],
  context: string = ""
): Promise<{ name: string, description: string, summary: string }> {
  const promptContext = context ? `${context}\n\n` : "";
  let avoidDuplicationInstructions = "";

  if (previousClusters.length > 0) {
    avoidDuplicationInstructions = `\nAvoid duplicating these definitions. The following clusters have already been defined:\n${previousClusters.join('\n')}\n`;
  }

  let prompt = getPrompt('nameClusters') || '';
  prompt = prompt.replace('{{context}}', promptContext);
  prompt = prompt.replace('{{avoidDuplicationInstructions}}', avoidDuplicationInstructions);
  prompt = prompt.replace('{{clusterTexts}}', JSON.stringify(clusterTexts, null, 2));

  try {
    const response = await gemmaGenerate(prompt, {
      systemInstruction: "You are an expert at categorizing text. Always output raw, valid JSON."
    });

    let text = response.text.trim();
    if (text.startsWith('```json')) text = text.substring(7);
    if (text.startsWith('```')) text = text.substring(3);
    if (text.endsWith('```')) text = text.slice(0, -3);

    return JSON.parse(text.trim());
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
  clusters: T[],
  options: { cumulative?: boolean, context?: string } = {}
): Promise<(T & NamedCluster)[]> {
  // Sort clusters from largest number of elements to smallest
  const sortedClusters = [...clusters].sort((a, b) => b.texts.length - a.texts.length);

  const namedClusters: (T & NamedCluster)[] = [];
  const previousClusters: string[] = [];
  const { cumulative = false, context = "" } = options;

  for (const cluster of sortedClusters) {
    const generated = await generateClusterNameAndDesc(cluster.texts, previousClusters, context);

    if (cumulative) {
      previousClusters.push(`Name: ${generated.name}\nSummary: ${generated.summary}`);
    }

    namedClusters.push({
      ...cluster,
      name: generated.name,
      description: generated.description,
      summary: generated.summary,
      centroid: cluster.centroid,
      reducedPoints: cluster.reducedPoints
    });
  }

  return namedClusters;
}
