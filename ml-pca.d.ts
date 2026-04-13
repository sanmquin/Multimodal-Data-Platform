declare module 'ml-pca' {
  export class PCA {
    constructor(dataset: number[][], options?: any);
    predict(dataset: number[][], options?: { nComponents: number }): { to2DArray(): number[][] };
    getExplainedVariance(): number[];
    toJSON(): any;
  }
}
