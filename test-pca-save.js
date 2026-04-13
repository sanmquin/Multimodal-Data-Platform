const { PCA } = require('ml-pca');
const dataset = [[1, 2], [3, 4]];
const pca = new PCA(dataset);
console.log(typeof pca.save);
console.log(typeof pca.toJSON);
