"""
fl_client.py
Flower (FLWR) Federated Learning Client.
Loads local bank shards, wraps a Scikit-Learn MLPClassifier model,
and exchanges weight parameters with the Flower server.
"""
import flwr as fl
import numpy as np
import sys
import os
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import log_loss

# Import local data loader
import data_loader

class IntrusionDetectionClient(fl.client.NumPyClient):
    def __init__(self, client_id, node_type, X_train, y_train, X_test, y_test):
        self.client_id = client_id
        self.node_type = node_type
        self.X_train = X_train
        self.y_train = y_train
        self.X_test = X_test
        self.y_test = y_test

        # Initialize Scikit-Learn MLP Classifier
        # Input layer: 8 features, Hidden layer: 8 neurons, Output: 5 classes
        self.model = MLPClassifier(
            hidden_layer_sizes=(8,),
            activation='relu',
            solver='sgd',
            learning_rate_init=0.05,
            max_iter=1
        )

        # Pre-initialize model parameters using a small batch (required by Scikit-Learn)
        # Classes represent [0: Normal, 1: DDoS, 2: PortScan, 3: BruteForce, 4: Exfil]
        self.model.partial_fit(self.X_train[0:10], self.y_train[0:10], classes=[0, 1, 2, 3, 4])

    def get_parameters(self, config):
        """Extracts model weights as standard NumPy arrays."""
        # Return weights (W1, W2) and biases (b1, b2)
        return [
            self.model.coefs_[0],
            self.model.coefs_[1],
            self.model.intercepts_[0],
            self.model.intercepts_[1]
        ]

    def fit(self, parameters, config):
        """Updates local weights with global weights and trains model locally."""
        self.model.coefs_[0] = parameters[0]
        self.model.coefs_[1] = parameters[1]
        self.model.intercepts_[0] = parameters[2]
        self.model.intercepts_[1] = parameters[3]

        # Train locally using partial_fit (equivalent to 1 epoch of backpropagation)
        self.model.partial_fit(self.X_train, self.y_train)

        print(f"[Client {self.client_id}] Completed training. Returning updated weights.")
        return self.get_parameters(config={}), len(self.X_train), {}

    def evaluate(self, parameters, config):
        """Evaluates model performance against the local validation set."""
        self.model.coefs_[0] = parameters[0]
        self.model.coefs_[1] = parameters[1]
        self.model.intercepts_[0] = parameters[2]
        self.model.intercepts_[1] = parameters[3]

        # Calculate loss and accuracy
        # Scikit-learn score returns mean accuracy
        accuracy = self.model.score(self.X_test, self.y_test)
        
        # Calculate cross-entropy log loss
        y_prob = self.model.predict_proba(self.X_test)
        loss = log_loss(self.y_test, y_prob, labels=[0, 1, 2, 3, 4])

        print(f"[Client {self.client_id}] Local accuracy: {accuracy*100:.1f}%, Loss: {loss:.4f}")
        return float(loss), len(self.X_test), {"accuracy": float(accuracy)}

def main():
    if len(sys.argv) < 2:
        print("[Error] Client ID argument is required. Use 0, 1, or 2.")
        sys.exit(1)

    client_id = int(sys.argv[1])
    node_types = ['retail', 'fund', 'crypto']
    node_type = node_types[client_id]

    print(f"\n=======================================================")
    print(f"  Starting FL Client Node: {node_type.upper()} ({client_id})")
    print(f"=======================================================")

    # Load Non-IID local training splits
    X_train, y_train = data_loader.load_client_data(node_type)
    
    # Load unified test set for validation splits
    X_test, y_test = data_loader.load_test_data()

    # Instantiate and connect client to Flower Server (port 5040)
    client = IntrusionDetectionClient(client_id, node_type, X_train, y_train, X_test, y_test)
    fl.client.start_numpy_client(server_address="127.0.0.1:5040", client=client)

if __name__ == '__main__':
    main()
