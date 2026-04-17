const { PCA } = require('ml-pca');
const MLR = require('ml-regression-multivariate-linear');

const pca = new PCA([[1, 2], [3, 4]]);
const mlr = new MLR([[1, 2], [3, 4]], [[1], [2]]);

console.log(typeof pca.toJSON());
console.log(typeof JSON.stringify(pca));
console.log(typeof mlr.toJSON());
