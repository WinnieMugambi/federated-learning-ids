/**
 * client.js
 * Local FinTech Client Model.
 * Implements the Multi-Layer Perceptron (MLP) classification network,
 * Backpropagation algorithm, and Differential Privacy (DP-SGD) with gradient clipping
 * and noise insertion. Also supports FedProx local proximity constraints.
 */

function randomNormal(mean = 0, stdDev = 1) {
    let u1 = Math.random();
    let u2 = Math.random();
    let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
    return mean + stdDev * randStdNormal;
}

const Matrix = {
    create: (rows, cols, fillVal = 0) => Array.from({ length: rows }, () => new Array(cols).fill(fillVal)),
    
    randomHe: (rows, cols) => {
        const stdDev = Math.sqrt(2.0 / rows);
        return Array.from({ length: rows }, () => 
            Array.from({ length: cols }, () => randomNormal(0, stdDev))
        );
    },
    
    transpose: (A) => {
        const r = A.length, c = A[0].length;
        const T = Matrix.create(c, r);
        for (let i = 0; i < r; i++) {
            for (let j = 0; j < c; j++) T[j][i] = A[i][j];
        }
        return T;
    },

    computeL2Norm: (arrays) => {
        let sumSq = 0;
        for (const arr of arrays) {
            if (Array.isArray(arr[0])) {
                for (let i = 0; i < arr.length; i++) {
                    for (let j = 0; j < arr[i].length; j++) sumSq += arr[i][j] * arr[i][j];
                }
            } else {
                for (let i = 0; i < arr.length; i++) sumSq += arr[i] * arr[i];
            }
        }
        return Math.sqrt(sumSq);
    }
};

class LocalClient {
    constructor(id, name, departmentType) {
        this.id = id;
        this.name = name;
        this.departmentType = departmentType;
        
        this.inputDim = 8;
        this.hiddenDim = 8;
        this.outputDim = 5; // 5 classes of traffic
        
        this.W1 = Matrix.randomHe(this.inputDim, this.hiddenDim);
        this.b1 = new Array(this.hiddenDim).fill(0);
        this.W2 = Matrix.randomHe(this.hiddenDim, this.outputDim);
        this.b2 = new Array(this.outputDim).fill(0);
        
        this.epsilon = 0.0;
        this.delta = 1e-5;
        this.stepsTrained = 0;
        
        this.history = {
            loss: [],
            accuracy: [],
            epsilon: []
        };
    }

    setWeights(weights) {
        this.W1 = weights.W1.map(row => [...row]);
        this.b1 = [...weights.b1];
        this.W2 = weights.W2.map(row => [...row]);
        this.b2 = [...weights.b2];
    }

    getWeights() {
        return {
            W1: this.W1.map(row => [...row]),
            b1: [...this.b1],
            W2: this.W2.map(row => [...row]),
            b2: [...this.b2]
        };
    }

    forward(x) {
        // Hidden Layer z1 = x * W1 + b1
        const z1 = new Array(this.hiddenDim).fill(0);
        for (let j = 0; j < this.hiddenDim; j++) {
            let sum = this.b1[j];
            for (let i = 0; i < this.inputDim; i++) sum += x[i] * this.W1[i][j];
            z1[j] = sum;
        }

        // ReLU Activation
        const a1 = z1.map(v => Math.max(0, v));

        // Output Layer z2 = a1 * W2 + b2
        const z2 = new Array(this.outputDim).fill(0);
        for (let j = 0; j < this.outputDim; j++) {
            let sum = this.b2[j];
            for (let i = 0; i < this.hiddenDim; i++) sum += a1[i] * this.W2[i][j];
            z2[j] = sum;
        }

        // Softmax
        const maxVal = Math.max(...z2);
        const exp = z2.map(v => Math.exp(v - maxVal));
        const sumExp = exp.reduce((a, b) => a + b, 0);
        const y_hat = exp.map(v => v / (sumExp || 1));

        return { z1, a1, z2, y_hat };
    }

    computeLoss(y_hat, targetClass) {
        return -Math.log(Math.max(y_hat[targetClass], 1e-15));
    }

    trainLocal(dataset, epochs = 5, batchSize = 16, lr = 0.05, dpEnabled = true, dpNoise = 1.0, dpClip = 1.0, globalWeights = null, mu = 0.0) {
        const N = dataset.length;
        if (N === 0) return 0;
        
        let epochLoss = 0;

        for (let epoch = 0; epoch < epochs; epoch++) {
            const indices = Array.from({ length: N }, (_, i) => i);
            indices.sort(() => Math.random() - 0.5);

            epochLoss = 0;

            for (let b = 0; b < N; b += batchSize) {
                const batchIndices = indices.slice(b, b + batchSize);
                const B = batchIndices.length;

                let accum_dW1 = Matrix.create(this.inputDim, this.hiddenDim);
                let accum_db1 = new Array(this.hiddenDim).fill(0);
                let accum_dW2 = Matrix.create(this.hiddenDim, this.outputDim);
                let accum_db2 = new Array(this.outputDim).fill(0);

                for (const idx of batchIndices) {
                    const sample = dataset[idx];
                    const { features, label } = sample;

                    // 1. Forward Pass
                    const { z1, a1, y_hat } = this.forward(features);
                    epochLoss += this.computeLoss(y_hat, label);

                    // 2. Backward Pass
                    const dZ2 = [...y_hat];
                    dZ2[label] -= 1.0;

                    const dW2 = Matrix.create(this.hiddenDim, this.outputDim);
                    for (let i = 0; i < this.hiddenDim; i++) {
                        for (let j = 0; j < this.outputDim; j++) dW2[i][j] = a1[i] * dZ2[j];
                    }
                    const db2 = [...dZ2];

                    const da1 = new Array(this.hiddenDim).fill(0);
                    for (let i = 0; i < this.hiddenDim; i++) {
                        let sum = 0;
                        for (let j = 0; j < this.outputDim; j++) sum += dZ2[j] * this.W2[i][j];
                        da1[i] = sum;
                    }

                    const dZ1 = new Array(this.hiddenDim).fill(0);
                    for (let i = 0; i < this.hiddenDim; i++) dZ1[i] = z1[i] > 0 ? da1[i] : 0.0;

                    const dW1 = Matrix.create(this.inputDim, this.hiddenDim);
                    for (let i = 0; i < this.inputDim; i++) {
                        for (let j = 0; j < this.hiddenDim; j++) dW1[i][j] = features[i] * dZ1[j];
                    }
                    const db1 = [...dZ1];

                    // FedProx Proximal Regularization Term
                    if (globalWeights && mu > 0) {
                        for (let i = 0; i < this.inputDim; i++) {
                            for (let j = 0; j < this.hiddenDim; j++) {
                                dW1[i][j] += mu * (this.W1[i][j] - globalWeights.W1[i][j]);
                            }
                        }
                        for (let j = 0; j < this.hiddenDim; j++) {
                            db1[j] += mu * (this.b1[j] - globalWeights.b1[j]);
                        }
                        for (let i = 0; i < this.hiddenDim; i++) {
                            for (let j = 0; j < this.outputDim; j++) {
                                dW2[i][j] += mu * (this.W2[i][j] - globalWeights.W2[i][j]);
                            }
                        }
                        for (let j = 0; j < this.outputDim; j++) {
                            db2[j] += mu * (this.b2[j] - globalWeights.b2[j]);
                        }
                    }

                    // 3. L2 Gradient Clipping
                    const clipFactor = dpEnabled 
                        ? Math.min(1.0, dpClip / (Matrix.computeL2Norm([dW1, db1, dW2, db2]) || 1e-8))
                        : 1.0;

                    for (let i = 0; i < this.inputDim; i++) {
                        for (let j = 0; j < this.hiddenDim; j++) accum_dW1[i][j] += dW1[i][j] * clipFactor;
                    }
                    for (let j = 0; j < this.hiddenDim; j++) accum_db1[j] += db1[j] * clipFactor;
                    for (let i = 0; i < this.hiddenDim; i++) {
                        for (let j = 0; j < this.outputDim; j++) accum_dW2[i][j] += dW2[i][j] * clipFactor;
                    }
                    for (let j = 0; j < this.outputDim; j++) accum_db2[j] += db2[j] * clipFactor;
                }

                // 4. Weight Updates (Adding noise for DP-SGD)
                this.stepsTrained++;
                const stdDev = dpEnabled ? (dpNoise * dpClip) : 0.0;

                for (let i = 0; i < this.inputDim; i++) {
                    for (let j = 0; j < this.hiddenDim; j++) {
                        let g = accum_dW1[i][j];
                        if (stdDev > 0) g += randomNormal(0, stdDev);
                        this.W1[i][j] -= lr * (g / B);
                    }
                }
                for (let j = 0; j < this.hiddenDim; j++) {
                    let g = accum_db1[j];
                    if (stdDev > 0) g += randomNormal(0, stdDev);
                    this.b1[j] -= lr * (g / B);
                }
                for (let i = 0; i < this.hiddenDim; i++) {
                    for (let j = 0; j < this.outputDim; j++) {
                        let g = accum_dW2[i][j];
                        if (stdDev > 0) g += randomNormal(0, stdDev);
                        this.W2[i][j] -= lr * (g / B);
                    }
                }
                for (let j = 0; j < this.outputDim; j++) {
                    let g = accum_db2[j];
                    if (stdDev > 0) g += randomNormal(0, stdDev);
                    this.b2[j] -= lr * (g / B);
                }

                // Privacy Accounting
                if (dpEnabled && dpNoise > 0) {
                    const q = B / N;
                    const T = this.stepsTrained;
                    this.epsilon = (2.0 * q * Math.sqrt(T * Math.log(1.0 / this.delta))) / dpNoise;
                } else {
                    this.epsilon = Infinity;
                }
            }
        }

        const finalLoss = epochLoss / N;
        this.history.loss.push(finalLoss);
        this.history.epsilon.push(dpEnabled ? this.epsilon : 0);
        this.history.accuracy.push(this.evaluate(dataset).accuracy);

        return finalLoss;
    }

    evaluate(dataset) {
        const N = dataset.length;
        if (N === 0) return { accuracy: 0, loss: 0, confusionMatrix: [] };

        let correct = 0;
        let totalLoss = 0;
        const confMat = Matrix.create(this.outputDim, this.outputDim, 0);

        for (let i = 0; i < N; i++) {
            const { features, label } = dataset[i];
            const { y_hat } = this.forward(features);
            totalLoss += this.computeLoss(y_hat, label);

            let maxIdx = 0, maxVal = y_hat[0];
            for (let j = 1; j < this.outputDim; j++) {
                if (y_hat[j] > maxVal) {
                    maxVal = y_hat[j];
                    maxIdx = j;
                }
            }
            if (maxIdx === label) correct++;
            confMat[label][maxIdx]++;
        }

        const classMetrics = Array.from({ length: this.outputDim }, (_, c) => {
            let tp = confMat[c][c];
            let fp = 0, fn = 0;
            for (let i = 0; i < this.outputDim; i++) {
                if (i !== c) {
                    fp += confMat[i][c];
                    fn += confMat[c][i];
                }
            }
            const precision = tp / (tp + fp) || 0;
            const recall = tp / (tp + fn) || 0;
            return { f1: (2 * precision * recall) / (precision + recall) || 0 };
        });

        return {
            accuracy: correct / N,
            loss: totalLoss / N,
            classMetrics,
            W1: this.W1
        };
    }
}

window.LocalClient = LocalClient;
window.Matrix = Matrix;
