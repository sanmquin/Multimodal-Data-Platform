import { PCA } from 'ml-pca';
import { mean } from 'simple-statistics';

/**
 * Batches an array into smaller arrays of a specified size.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function assignPointsToCentroids(points: number[][], centroids: number[][], k: number, labels: number[]): boolean {
  let changed = false;
  for (let i = 0; i < points.length; i++) {
    let minDist = Infinity;
    let label = -1;
    for (let j = 0; j < k; j++) {
      const dist = euclideanDistance(points[i], centroids[j]);
      if (dist < minDist) {
        minDist = dist;
        label = j;
      }
    }
    if (labels[i] !== label) {
      labels[i] = label;
      changed = true;
    }
  }
  return changed;
}

function recalculateCentroids(points: number[][], labels: number[], k: number, dimensions: number, oldCentroids: number[][]): number[][] {
  const newCentroids = Array(k).fill(0).map(() => new Array(dimensions).fill(0));
  const clustersPoints: number[][][] = Array.from({ length: k }, () => []);

  for (let i = 0; i < points.length; i++) {
    const label = labels[i];
    if (label !== -1) {
      clustersPoints[label].push(points[i]);
    }
  }

  for (let j = 0; j < k; j++) {
    const clusterPoints = clustersPoints[j];
    if (clusterPoints.length === 0) {
      newCentroids[j] = [...oldCentroids[j]];
    } else {
      for (let d = 0; d < dimensions; d++) {
        const dimensionValues = clusterPoints.map(p => p[d]);
        newCentroids[j][d] = mean(dimensionValues);
      }
    }
  }
  return newCentroids;
}

export function customKMeans(points: number[][], k: number): { labels: number[], centroids: number[][] } {
  const dimensions = points[0].length;
  let centroids = points.slice(0, k).map(p => [...p]);
  const labels = new Array(points.length).fill(-1);
  let changed = true;
  let maxIterations = 100;

  while (changed && maxIterations > 0) {
    maxIterations--;

    changed = assignPointsToCentroids(points, centroids, k, labels);
    centroids = recalculateCentroids(points, labels, k, dimensions, centroids);
  }

  return { labels, centroids };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPCAIfRequested(points: number[][], reduceDimensions: boolean, pcaDimensions: number): { finalPoints: number[][], pcaModelJson: any } {
  let finalPoints = points;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pcaModelJson: any = undefined;

  if (reduceDimensions && points.length > 0 && points[0].length > 0) {
    const pca = new PCA(points);
    const nComponents = Math.min(pcaDimensions, pca.getExplainedVariance().length);
    if (nComponents > 0) {
      finalPoints = pca.predict(points, { nComponents }).to2DArray();
      pcaModelJson = pca.toJSON();
    }
  }
  return { finalPoints, pcaModelJson };
}
