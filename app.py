"""
app.py
Main Flask Web Backend.
Handles user authentication, database query bindings, REST API,
and orchestrates the subprocess Flower federated network loops.
"""
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import subprocess
import pickle
import os
import sys
import time
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import log_loss

# Import local modules
import database
import data_loader

app = Flask(__name__)
app.secret_key = 'cybershield_secret_token_key'

# Configure Flask-Login
login_manager = LoginManager()
login_manager.login_view = 'login'
login_manager.init_app(app)

class User(UserMixin):
    def __init__(self, id, username):
        self.id = id
        self.username = username

@login_manager.user_loader
def load_user(user_id):
    u = database.get_user_by_id(int(user_id))
    if u:
        return User(u['id'], u['username'])
    return None

# Ensure SQLite Database and initial datasets are initialized on startup
database.init_db()
data_loader.verify_and_load_datasets()

# Global variable to reference active model weights in memory
global_weights = None

def init_global_model_if_missing():
    """Seeds a baseline model to global_model.pkl if no training has occurred."""
    global global_weights
    if not os.path.exists("global_model.pkl"):
        print("[*] Initializing baseline global model weights...")
        model = MLPClassifier(hidden_layer_sizes=(8,), activation='relu', solver='sgd')
        X = np.random.normal(size=(10, 8)).astype(np.float32)
        y = np.random.choice([0, 1, 2, 3, 4], size=(10,))
        model.partial_fit(X, y, classes=[0, 1, 2, 3, 4])
        
        # Save baseline parameter arrays
        baseline_params = [model.coefs_[0], model.coefs_[1], model.intercepts_[0], model.intercepts_[1]]
        with open("global_model.pkl", "wb") as f:
            pickle.dump(baseline_params, f)
        global_weights = baseline_params
    else:
        with open("global_model.pkl", "rb") as f:
            global_weights = pickle.load(f)

init_global_model_if_missing()

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = database.get_user_by_username(username)
        if user:
            if database.verify_password(password, user['password_hash']):
                user_obj = User(user['id'], user['username'])
                login_user(user_obj)
                return redirect(url_for('dashboard'))
                
        flash('Invalid username or password.', 'danger')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', username=current_user.username)

# --- REST API ENDPOINTS ---

@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    """Returns aggregated metadata statistics."""
    metrics = database.get_all_training_metrics()
    logs = database.get_recent_threat_logs()
    
    round_count = len(metrics)
    accuracy = metrics[-1]['accuracy'] * 100 if round_count > 0 else 58.2
    epsilon = metrics[-1]['epsilon'] if round_count > 0 else 0.0
    threats = len([l for l in logs if l['status'] == 'COMPROMISED'])
    
    return jsonify({
        'rounds': round_count,
        'accuracy': f"{accuracy:.1f}%",
        'epsilon': f"{epsilon:.2f}" if epsilon != float('inf') else "Infinity",
        'threats': threats
    })

@app.route('/api/logs', methods=['GET'])
@login_required
def get_logs():
    """Returns recent threat logs for visual console feed."""
    return jsonify(database.get_recent_threat_logs(limit=25))

@app.route('/api/weights', methods=['GET'])
@login_required
def get_weights():
    """Returns current weight parameters for neural graph drawings."""
    global global_weights
    init_global_model_if_missing()
    
    # Return W1 matrix values as nested JSON list
    w1_list = global_weights[0].tolist()
    w2_list = global_weights[1].tolist()
    return jsonify({
        'W1': w1_list,
        'W2': w2_list
    })

@app.route('/api/predict', methods=['POST'])
@login_required
def predict():
    """Classifies an incoming network packet and logs the decision to SQLite."""
    global global_weights
    init_global_model_if_missing()
    
    data = request.json
    features = np.array(data['features'], dtype=np.float32).reshape(1, -1)
    target_node = int(data['target_node'])
    is_malicious = bool(data['is_malicious'])
    attack_class = int(data['attack_class'])
    source_ip = data.get('source_ip', '192.168.1.105')

    # Construct temporary Scikit-Learn MLP
    model = MLPClassifier(hidden_layer_sizes=(8,), activation='relu', solver='sgd')
    model.partial_fit(features, [0], classes=[0, 1, 2, 3, 4]) # dummy fit to initialize structure
    
    # Inject active global weights
    model.coefs_[0] = global_weights[0]
    model.coefs_[1] = global_weights[1]
    model.intercepts_[0] = global_weights[2]
    model.intercepts_[1] = global_weights[3]

    # Predict probability distribution
    probs = model.predict_proba(features)[0]
    pred_label = int(np.argmax(probs))
    confidence = float(probs[pred_label])

    # Mapping logic for database audit logs
    status = "ALLOWED"
    if is_malicious:
        status = "BLOCKED" if pred_label == attack_class else "COMPROMISED"
    else:
        status = "FALSE BLOCK" if pred_label != 0 else "ALLOWED"

    # Save details to SQLite
    attack_names = ['Normal', 'DDoS Attack', 'Port Scan', 'Brute Force SSH', 'Data Exfiltration']
    database.insert_threat_log(
        source_ip=source_ip,
        target_node=target_node,
        attack_type=attack_names[attack_class if is_malicious else 0],
        status=status,
        confidence=confidence
    )

    return jsonify({
        'predicted_label': pred_label,
        'confidence': confidence,
        'status': status
    })

@app.route('/api/trigger-train', methods=['POST'])
@login_required
def trigger_train():
    """Coordinates a secure federated training round using Flower (FLWR) subprocesses."""
    global global_weights
    
    # 1. Spawn Flower server subprocess
    # Run for exactly 1 round. Server address: 127.0.0.1:5040
    print("[*] Starting Flower Server subprocess...")
    server_proc = subprocess.Popen([sys.executable, 'fl_server.py'])
    time.sleep(1.5) # Wait for port mapping

    # 2. Spawn Flower clients concurrently
    print("[*] Starting Flower Client processes (Apex, Global, Crypto)...")
    c0 = subprocess.Popen([sys.executable, 'fl_client.py', '0'])
    c1 = subprocess.Popen([sys.executable, 'fl_client.py', '1'])
    c2 = subprocess.Popen([sys.executable, 'fl_client.py', '2'])

    # 3. Wait for training round to finish
    c0.wait()
    c1.wait()
    c2.wait()
    server_proc.wait()
    print("[+] All FL processes terminated. Round complete.")

    # 4. Load updated parameters
    if os.path.exists("global_model.pkl"):
        with open("global_model.pkl", "rb") as f:
            global_weights = pickle.load(f)
    
    # 5. Evaluate the global model performance
    X_test, y_test = data_loader.load_test_data()
    
    model = MLPClassifier(hidden_layer_sizes=(8,))
    model.partial_fit(X_test[0:5], y_test[0:5], classes=[0, 1, 2, 3, 4])
    model.coefs_[0] = global_weights[0]
    model.coefs_[1] = global_weights[1]
    model.intercepts_[0] = global_weights[2]
    model.intercepts_[1] = global_weights[3]
    
    accuracy = float(model.score(X_test, y_test))
    probs = model.predict_proba(X_test)
    loss = float(log_loss(y_test, probs, labels=[0, 1, 2, 3, 4]))

    # Calculate privacy budget spent
    metrics = database.get_all_training_metrics()
    next_round = len(metrics) + 1
    
    # Standard DP Epsilon approximation based on noise setting (assuming default active noise)
    # sigma = 1.0, clip = 1.0, B = 16, N = 200
    q = 16 / 200
    delta_log = np.log(1e5)
    epsilon = (2.0 * q * np.sqrt(next_round * delta_log)) / 1.0

    # Save metrics to database
    database.insert_training_metric(
        round_number=next_round,
        accuracy=accuracy,
        loss=loss,
        epsilon=epsilon
    )

    return jsonify({
        'round': next_round,
        'accuracy': f"{accuracy*100:.1f}%",
        'loss': f"{loss:.4f}",
        'epsilon': f"{epsilon:.3f}"
    })

if __name__ == '__main__':
    # Start local Flask host on port 8080
    app.run(host='0.0.0.0', port=8080, debug=True)
