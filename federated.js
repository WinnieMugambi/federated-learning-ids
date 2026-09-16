/**
 * federated.js
 * FinTech Aggregator Server.
 * Coordinates federated epochs, averages parameters from the local client models,
 * and maintains the unified consortium model.
 */

class FederatedServer {
    constructor(inputDim = 8, hiddenDim = 8, outputDim = 5) {
        this.inputDim = inputDim;
        this.hiddenDim = hiddenDim;
        this.outputDim = outputDim;

        // Initialize global model weights (He Initialization)
        this.globalWeights = {
            W1: Matrix.randomHe(this.inputDim, this.hiddenDim),
            b1: new Array(this.hiddenDim).fill(0),
            W2: Matrix.randomHe(this.hiddenDim, this.outputDim),
            b2: new Array(this.outputDim).fill(0)
        };

        this.round = 0;
        this.history = {
            round: [],
            accuracy: [],
            loss: [],
            epsilon: []
        };
    }

    /**
     * Aggregates the local model weights from clients using FedAvg.
     * Weights are averaged proportionally to each client's dataset size.
     */
    aggregateFedAvg(clients, clientDataSizes) {
        const totalSamples = Object.values(clientDataSizes).reduce((a, b) => a + b, 0);
        if (totalSamples === 0) return;

        const newWeights = {
            W1: Matrix.create(this.inputDim, this.hiddenDim),
            b1: new Array(this.hiddenDim).fill(0),
            W2: Matrix.create(this.hiddenDim, this.outputDim),
            b2: new Array(this.outputDim).fill(0)
        };

        // Accumulate weighted updates
        for (const client of clients) {
            const size = clientDataSizes[client.id] || 0;
            const weightFactor = size / totalSamples;
            const cw = client.getWeights();

            // Accumulate W1 & b1
            for (let i = 0; i < this.inputDim; i++) {
                for (let j = 0; j < this.hiddenDim; j++) {
                    newWeights.W1[i][j] += cw.W1[i][j] * weightFactor;
                }
            }
            for (let j = 0; j < this.hiddenDim; j++) {
                newWeights.b1[j] += cw.b1[j] * weightFactor;
            }

            // Accumulate W2 & b2
            for (let i = 0; i < this.hiddenDim; i++) {
                for (let j = 0; j < this.outputDim; j++) {
                    newWeights.W2[i][j] += cw.W2[i][j] * weightFactor;
                }
            }
            for (let j = 0; j < this.outputDim; j++) {
                newWeights.b2[j] += cw.b2[j] * weightFactor;
            }
        }

        this.globalWeights = newWeights;
        this.round++;
    }

    /**
     * Aggregates the local model weights from clients using FedProx.
     * Leverages the same aggregation step, but is called when clients
     * run local training loops with proximal loss configurations.
     */
    aggregateFedProx(clients, clientDataSizes) {
        this.aggregateFedAvg(clients, clientDataSizes);
    }

    getGlobalWeights() {
        return {
            W1: this.globalWeights.W1.map(row => [...row]),
            b1: [...this.globalWeights.b1],
            W2: this.globalWeights.W2.map(row => [...row]),
            b2: [...this.globalWeights.b2]
        };
    }

    evaluateGlobal(testDataset) {
        const tempClient = new LocalClient(-1, 'Consortium Evaluator', 'retail');
        tempClient.setWeights(this.globalWeights);
        return tempClient.evaluate(testDataset);
    }
}

window.FederatedServer = FederatedServer;
