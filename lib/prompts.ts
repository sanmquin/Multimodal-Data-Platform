export const PROMPTS = {
  nameCluster: `{{CONTEXT}}You are a helpful AI assistant. I will provide you with a list of texts belonging to a single cluster.
Please analyze the themes and subjects of these texts and provide:
1. A concise "name" for the cluster.
2. A detailed "description" of the cluster that includes examples of the items in it.
3. A short one-liner "summary" of the cluster.{{AVOID_DUPLICATION}}

Respond ONLY with a valid JSON object with keys: "name", "description", and "summary". Do not include markdown formatting like \`\`\`json.

Cluster texts:
{{CLUSTER_TEXTS}}`,

  refineClusters: `
You are an expert taxonomist. Review the following clusters and their representative texts.
Please refine them into a Mutually Exclusive, Collectively Exhaustive (MECE) set of clusters.
You may merge similar clusters or split broad clusters.
Additionally, you MUST include one cluster named "Miscellaneous/Unknown" to catch outliers.
For each cluster, provide a "name", a detailed "description" (with examples), and a short one-liner "summary".

Input clusters:
{{CLUSTERS_DATA}}
`
};

export function buildNameClusterPrompt(
  clusterTexts: string[],
  previousClusters: string[] = [],
  context: string = ""
): string {
  const promptContext = context ? `${context}\n\n` : "";
  let avoidDuplicationInstructions = "";

  if (previousClusters.length > 0) {
    avoidDuplicationInstructions = `\n\nAvoid duplicating these definitions. To ensure Mutually Exclusive, Collectively Exhaustive (MECE) clustering, differentiate from the following already defined clusters:\n${previousClusters.join('\n')}\n`;
  }

  const prompt = PROMPTS.nameCluster
    .replace("{{CONTEXT}}", promptContext)
    .replace("{{AVOID_DUPLICATION}}", avoidDuplicationInstructions)
    .replace("{{CLUSTER_TEXTS}}", JSON.stringify(clusterTexts, null, 2));

  return prompt;
}

export function buildRefineClustersPrompt(clustersData: any[]): string {
  return PROMPTS.refineClusters.replace(
    "{{CLUSTERS_DATA}}",
    JSON.stringify(clustersData, null, 2)
  );
}
