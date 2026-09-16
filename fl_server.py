"""
fl_server.py
Flower (FLWR) Federated Aggregation Server.
Orchestrates training rounds, aggregates local scikit-learn weights via FedAvg,
and saves the global model back to disk.
"""
import flwr as fl
import pickle
import os
import numpy as np

# We define a custom FedAvg strategy to save the model parameters after each round
class SaveModelStrategy(fl.server.strategy.FedAvg):
    def aggregate_fit(self, server_round, results, failures):
        # Call parent aggregation function
        aggregated_parameters, aggregated_metrics = super().aggregate_fit(server_round, results, failures)
        
        if aggregated_parameters is not None:
            print(f"\n[+] Round {server_round}: Aggregation complete. Deserializing weights...")
            # Convert aggregated parameters back to NumPy ndarrays
            ndarrays = fl.common.parameters_to_ndarrays(aggregated_parameters)
            
            # Save the parameters to global_model.pkl
            with open("global_model.pkl", "wb") as f:
                pickle.dump(ndarrays, f)
            print(f"[+] Saved updated global model parameters to 'global_model.pkl'")
            
        return aggregated_parameters, aggregated_metrics

def start_fl_server(num_rounds=1):
    print("\n=======================================================")
    print("      Flower (FLWR) Federated Aggregator Server        ")
    print("=======================================================")
    
    # Initialize the custom strategy
    strategy = SaveModelStrategy(
        fraction_fit=1.0,          # Sample 100% of clients for training
        fraction_evaluate=1.0,     # Sample 100% of clients for evaluation
        min_fit_clients=3,         # Minimum client threshold to train (Apex, Global, Crypto)
        min_evaluate_clients=3,    # Minimum client threshold to evaluate
        min_available_clients=3,   # Wait for all 3 clients to be connected
    )
    
    # Start the server on port 5040 to avoid conflicts
    fl.server.start_server(
        server_address="0.0.0.0:5040",
        config=fl.server.ServerConfig(num_rounds=num_rounds),
        strategy=strategy
    )

if __name__ == '__main__':
    # Default is 1 round when executed independently
    start_fl_server(num_rounds=1)
