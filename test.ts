import { embed, EmbedOptions, retrieveAndCluster } from './lib/index';

async function run() {
  const mockIndex: any = {
    fetch: async (optsOrIds: any) => {
      const ids = Array.isArray(optsOrIds) ? optsOrIds : optsOrIds.ids;
      // Mock existing id
      if (ids.includes('2')) {
        return { records: { '2': {} } };
      }
      return { records: {} };
    },
    upsert: async ({ records }: { records: any[] }) => {
      console.log('Upserting:', JSON.stringify(records, null, 2));
      return;
    },
    namespace: (ns: string) => mockIndex
  };

  const options: EmbedOptions = {
    index: mockIndex,
    texts: [
      { id: '1', text: 'First item' },
      { id: '2', text: 'Second item' }, // Should be skipped due to mock fetch returning it
      { id: '3', text: 'Third item' },
    ],
    embedder: async (texts: string[]) => {
      return texts.map(t => [Math.random(), Math.random(), Math.random()]);
    },
    batchSize: 2
  };

  const stats = await embed(options);
  console.log('Stats:', stats);

  console.log('--- Testing retrieveAndCluster ---');

  const mockClusterIndex: any = {
    namespace: (ns: string) => mockClusterIndex,
    fetch: async (optsOrIds: any) => {
      // Return simple records that are easily clusterable
      return {
        records: {
          '1': { id: '1', values: [0, 0] },
          '2': { id: '2', values: [1, 1] },
          '3': { id: '3', values: [0, 0.1] },
          '4': { id: '4', values: [1, 0.9] },
        }
      };
    }
  };

  const clusters = await retrieveAndCluster({
    ids: ['1', '2', '3', '4'],
    index: mockClusterIndex,
    namespace: 'test-ns',
    numClusters: 2
  });

  console.log(`Generated ${clusters.length} clusters.`);
  clusters.forEach((c, i) => {
    console.log(`Cluster ${i} (centroid: [${c.centroid.join(', ')}]):`);
    console.log(`  Records: ${c.records.map(r => r.id).join(', ')}`);
  });
}

run().catch(console.error);
