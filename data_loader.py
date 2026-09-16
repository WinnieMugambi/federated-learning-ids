"""
data_loader.py
NSL-KDD Dataset Preprocessor and Loader.
Generates local CSV data shards and preprocesses them into 
standard NumPy arrays for local client model training.
"""
import pandas as pd
import numpy as np
import os

TRAIN_FILE = 'kdd_train.csv'
TEST_FILE = 'kdd_test.csv'

# Column Names representing NSL-KDD extracted feature dimensions
COLUMNS = [
    'duration', 'packet_rate', 'byte_rate', 'port_diversity', 
    'protocol_type', 'payload_entropy', 'failed_logins', 'error_rate', 
    'label', 'node_type'
]

def generate_synthetic_kdd_csv(filepath, num_samples):
    """Generates synthetic network flow records mirroring the NSL-KDD feature bounds."""
    np.random.seed(42 if 'train' in filepath else 100)
    data = []
    
    nodes = ['retail', 'fund', 'crypto']
    # Distributions for normal vs attack types per node
    # Labels: 0=Normal, 1=DDoS, 2=PortScan, 3=BruteForce, 4=Exfiltration
    dist_map = {
        'retail': [0.75, 0.16, 0.01, 0.07, 0.01],
        'fund':   [0.72, 0.01, 0.05, 0.01, 0.21],
        'crypto': [0.65, 0.22, 0.11, 0.01, 0.01]
    }

    for _ in range(num_samples):
        node = np.random.choice(nodes)
        label = np.random.choice([0, 1, 2, 3, 4], p=dist_map[node])
        
        # Base features
        duration = np.random.exponential(scale=0.2) if node != 'fund' else np.random.exponential(scale=0.6)
        pkt_rate = np.random.normal(loc=0.4, scale=0.1) if node != 'crypto' else np.random.normal(loc=0.7, scale=0.1)
        byte_rate = np.random.normal(loc=0.3, scale=0.1) if node != 'fund' else np.random.normal(loc=0.8, scale=0.1)
        port_div = np.random.normal(loc=0.08, scale=0.03)
        proto = 0.0 # TCP
        entropy = np.random.normal(loc=0.4, scale=0.08)
        failed_logins = 0.0
        error_rate = np.random.normal(loc=0.02, scale=0.01)

        # Inject attack anomalies
        if label == 1: # DDoS
            duration = np.random.exponential(scale=0.03)
            pkt_rate = np.random.normal(loc=0.95, scale=0.02)
            byte_rate = np.random.normal(loc=0.85, scale=0.05)
            port_div = np.random.normal(loc=0.01, scale=0.005)
            proto = 0.5 if node == 'crypto' else 0.0
            error_rate = np.random.normal(loc=0.9, scale=0.04)
        elif label == 2: # PortScan
            duration = np.random.exponential(scale=0.05)
            pkt_rate = np.random.normal(loc=0.8, scale=0.05)
            port_div = np.random.normal(loc=0.96, scale=0.02)
            error_rate = np.random.normal(loc=0.75, scale=0.08)
        elif label == 3: # BruteForce
            duration = np.random.exponential(scale=0.75)
            failed_logins = np.random.normal(loc=0.92, scale=0.04)
        elif label == 4: # Exfiltration
            duration = np.random.exponential(scale=0.9)
            byte_rate = np.random.normal(loc=0.94, scale=0.03)
            entropy = np.random.normal(loc=0.96, scale=0.02)

        row = [
            np.clip(duration, 0, 1),
            np.clip(pkt_rate, 0, 1),
            np.clip(byte_rate, 0, 1),
            np.clip(port_div, 0, 1),
            proto,
            np.clip(entropy, 0, 1),
            np.clip(failed_logins, 0, 1),
            np.clip(error_rate, 0, 1),
            int(label),
            node
        ]
        data.append(row)

    df = pd.DataFrame(data, columns=COLUMNS)
    df.to_csv(filepath, index=False)
    print(f"[*] Synthetic dataset written to {filepath} ({num_samples} samples)")

def verify_and_load_datasets():
    """Checks for dataset presence, spawning synthetic profiles if missing."""
    if not os.path.exists(TRAIN_FILE):
        generate_synthetic_kdd_csv(TRAIN_FILE, 1000)
    if not os.path.exists(TEST_FILE):
        generate_synthetic_kdd_csv(TEST_FILE, 300)

def load_client_data(node_type):
    """Loads a specific bank client data shard from the train set."""
    verify_and_load_datasets()
    df = pd.read_csv(TRAIN_FILE)
    
    # Filter by node type to represent Non-IID sharding
    client_df = df[df['node_type'] == node_type]
    
    X = client_df.iloc[:, 0:8].values.astype(np.float32)
    y = client_df['label'].values.astype(np.int64)
    
    return X, y

def load_test_data():
    """Loads the unified test dataset for model evaluation."""
    verify_and_load_datasets()
    df = pd.read_csv(TEST_FILE)
    
    X = df.iloc[:, 0:8].values.astype(np.float32)
    y = df['label'].values.astype(np.int64)
    
    return X, y

if __name__ == '__main__':
    verify_and_load_datasets()
    X, y = load_client_data('retail')
    print(f"[*] Preprocessing complete. Retail bank shard size: {X.shape}, Label shapes: {y.shape}")
