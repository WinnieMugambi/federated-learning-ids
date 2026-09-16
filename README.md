# Federated Learning-Based Intrusion Detection System (FL-IDS)

This repository implements a **Privacy-Preserving Federated Learning Intrusion Detection System (FL-IDS)** designed for enterprise environments. The system facilitates collaborative training of network anomaly detection models across multiple heterogeneous departments (e.g., Finance, R&D, HR, IoT) without requiring any raw packet logs to leave their respective local subnetworks, ensuring strict data residency and privacy compliance.

---

## 🚀 Key Features

1. **In-Browser Neural Engine**: A complete Multi-Layer Perceptron (MLP) classifier written from scratch in raw Javascript, featuring forward propagation, backpropagation, and weight updating.
2. **Privacy Preservation (DP-SGD)**: Implements differential privacy guarantees on local training weight updates:
   - **L2 Gradient Clipping**: Limits the influence of individual traffic flow logs.
   - **Gaussian Noise Addition**: Adds calibrated noise before model uploads.
   - **Moments Accountant**: Computes real-time privacy budget expenditure ($\epsilon$) at a target reliability threshold ($\delta = 10^{-5}$).
3. **Advanced Federated Optimization**:
   - **FedAvg**: Aggregates client weights proportional to dataset volume.
   - **FedProx**: Adjusts local client updates with a proximal regularization term ($\mu$) to prevent weight divergence in Non-IID traffic environments.
4. **Interactive Dashboard**:
   - Real-time packet animation showing threat flows and model exchanges.
   - Dynamic attack generator (DDoS, Port Scan, Brute Force, Exfiltration).
   - Local model weight matrix heat-map visualizer.
   - Chart.js integration showing system-wide model convergence and privacy-utility trade-offs.

---

## 🛠️ Mathematical Formulation

### 1. Local Loss with Proximal Constraint (FedProx)
During training with FedProx, the local loss is modified by adding a proximal regularization term to keep the client weights $W$ close to the current global model weights $W^{global}$:
$$\mathcal{L}_{prox}(W) = \mathcal{L}(W) + \frac{\mu}{2} \left\| W - W^{global} \right\|_2^2$$

Thus, the gradient update for a weight matrix includes:
$$\nabla \mathcal{L}_{prox}(W) = \nabla \mathcal{L}(W) + \mu(W - W^{global})$$

### 2. Differential Privacy Guarantees (DP-SGD)
For each training step, the gradients of individual samples $g_i$ are clipped to a maximum L2-norm threshold $C$:
$$\bar{g}_i = g_i \cdot \min\left(1, \frac{C}{\|g_i\|_2}\right)$$

Gaussian noise is added to the batch gradient sum:
$$\tilde{g} = \sum_{i=1}^B \bar{g}_i + \mathcal{N}(0, \sigma^2 C^2 I)$$

The weights are then updated:
$$W \leftarrow W - \eta \frac{\tilde{g}}{B}$$

---

## 📂 Project Directory Structure

```
federated_learning_ids/
├── index.html        # Main Cyber Command dashboard markup
├── styles.css        # Premium dark-theme glassmorphic styles
├── app.js            # Frontend orchestration, canvas animations, charts
├── traffic.js        # Synthetic multi-dimensional packet simulator
├── client.js         # Local MLP neural network & DP-SGD solver
├── federated.js      # Federated Server Aggregator (FedAvg & FedProx)
├── serve.py          # Python server utility (opens local browser)
└── README.md         # System documentation
```

---

## 🏃 How to Run the System

### Method 1: Local HTTP Server (Recommended)
If you have Python installed, you can serve the dashboard locally which automatically launches your default browser:
```bash
python serve.py
```
*The server runs on `http://localhost:8080`.*

### Method 2: Open HTML File
You can also open the `index.html` file directly in any modern web browser by double-clicking it. No compilation or dependencies are required.

---

## 🛡️ Validation Walkthrough

1. **Observe Untrained System**: Launch a **DDoS attack** or **Port Scan** vector. The live logs terminal will show that the local node's untrained model continuously **misses** the threat or misclassifies it (false negatives).
2. **Perform Training**: Run a few rounds of Federated Learning (or enable continuous auto-train).
3. **Observe Convergence**: The accuracy chart will climb toward >90% while the privacy budget spending ($\epsilon$) slowly accumulates.
4. **Inspect Node weights**: Click any node (e.g. Finance) to open the Node Inspector. View the live weights grid. If DP is enabled, notice how weights remain stable but show subtle stochastic fluctuations (noise injection).
5. **Verify Anomaly Block**: Re-trigger the attacks. The logs will report immediate, high-confidence **detections** of DDoS, Port Scan, Brute Force, and Exfiltration across all nodes.
