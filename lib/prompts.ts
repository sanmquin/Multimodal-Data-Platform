export const prompts = [
  {
    name: 'nameClusters',
    description: 'Generates a name, detailed description, and a short summary for a given text cluster.',
    template: `{{context}}You are a helpful AI assistant. I will provide you with a list of texts belonging to a single cluster.
Please analyze the themes and subjects of these texts and provide:
1. A concise "name" for the cluster.
2. A "description" of the cluster that is a detailed explanation with concrete examples.
3. A short "summary" of the cluster that is a concise one-liner.{{avoidDuplicationInstructions}}

Respond ONLY with a valid JSON object with keys: "name", "description", and "summary". Do not include markdown formatting like \`\`\`json.

Cluster texts:
{{clusterTexts}}`
  },
  {
    name: 'refineClusters',
    description: 'Refines existing clusters into a Mutually Exclusive, Collectively Exhaustive (MECE) set.',
    template: `You are an expert taxonomist. Review the following clusters and their representative texts.
Please refine them into a Mutually Exclusive, Collectively Exhaustive (MECE) set of clusters.
You may merge similar clusters or split broad clusters.
Additionally, you MUST include one cluster named "Miscellaneous/Unknown" to catch outliers.
For each cluster, provide a "name", a "description" that is a detailed explanation with concrete examples, and a short "summary" that is a concise one-liner.

Input clusters:
{{clustersData}}`
  }
];

export function getPrompt(name: string): string | undefined {
  return prompts.find((p) => p.name === name)?.template;
}
