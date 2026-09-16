"""
test_app.py
Pytest Validation Suite.
Validates database CRUD functions, dataset array formatting,
and MLP model weight serialization consistency.
"""
import pytest
import os
import numpy as np
from sklearn.neural_network import MLPClassifier

import database
import data_loader

def test_database_initialization():
    """Verifies SQLite database file and tables initialize correctly."""
    database.init_db()
    assert os.path.exists(database.DB_FILE)
    
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # Check users table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    assert cursor.fetchone() is not None
    
    # Check threat logs table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='threat_logs'")
    assert cursor.fetchone() is not None
    
    # Check training metrics table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='training_metrics'")
    assert cursor.fetchone() is not None
    
    conn.close()

def test_database_logs_crud():
    """Tests writing and reading threat log rows inside SQLite."""
    database.init_db()
    
    # Insert threat log
    database.insert_threat_log(
        source_ip="10.0.0.12",
        target_node=1,
        attack_type="Port Scan",
        status="BLOCKED",
        confidence=0.985
    )
    
    # Retrieve logs
    logs = database.get_recent_threat_logs(limit=1)
    assert len(logs) == 1
    assert logs[0]['source_ip'] == "10.0.0.12"
    assert logs[0]['attack_type'] == "Port Scan"
    assert logs[0]['status'] == "BLOCKED"
    assert logs[0]['confidence'] == 0.985

def test_data_loader_arrays():
    """Checks that the data preprocessor loads and scales NumPy arrays correctly."""
    data_loader.verify_and_load_datasets()
    
    # Verify train files shape
    X, y = data_loader.load_client_data('retail')
    assert isinstance(X, np.ndarray)
    assert isinstance(y, np.ndarray)
    assert X.shape[1] == 8  # 8 features
    assert len(X) == len(y)
    
    # Verify test files shape
    X_test, y_test = data_loader.load_test_data()
    assert X_test.shape[1] == 8
    assert len(X_test) == len(y_test)

def test_model_weight_serialization():
    """Validates that Scikit-learn MLP Classifier weights can be extracted and reassigned."""
    model = MLPClassifier(hidden_layer_sizes=(8,), activation='relu', solver='sgd')
    
    # Fit once on dummy data to allocate structures
    X = np.random.normal(size=(5, 8))
    y = np.array([0, 1, 2, 3, 4])
    model.partial_fit(X, y, classes=[0, 1, 2, 3, 4])
    
    # Extract weights
    w1 = model.coefs_[0]
    w2 = model.coefs_[1]
    b1 = model.intercepts_[0]
    b2 = model.intercepts_[1]
    
    assert w1.shape == (8, 8)
    assert w2.shape == (8, 5)
    assert b1.shape == (8,)
    assert b2.shape == (5,)
    
    # Reassign weights
    model.coefs_[0] = w1 * 2
    model.coefs_[1] = w2 * 2
    model.intercepts_[0] = b1 * 2
    model.intercepts_[1] = b2 * 2
    
    assert np.array_equal(model.coefs_[0], w1 * 2)
