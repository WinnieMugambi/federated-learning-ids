# 🛡️ Collaborative FinTech FL-IDS: Privacy-Preserving Intrusion Detection System

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)](https://flask.palletsprojects.com/)
[![Flower](https://img.shields.io/badge/Federated%20Learning-Flower%20(FLWR)-ff69b4.svg)](https://flower.ai/)
[![Scikit-Learn](https://img.shields.io/badge/ML-Scikit--Learn-orange.svg)](https://scikit-learn.org/)
[![Database](https://img.shields.io/badge/Database-SQLite-003B57.svg)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-Pytest-yellow.svg)](https://docs.pytest.org/)

An enterprise-grade **Federated Learning Intrusion Detection System (FL-IDS)** for collaborative cyber threat defense across financial institutions (Retail Banking, Investment Funds, Crypto Payment Gateways).

The system enables financial consortiums to collaboratively train neural intrusion detection models to detect zero-day cyber threats (DDoS, Brute Force SSH, Data Exfiltration, Port Scanning) **without sharing raw customer financial data or packet logs**, ensuring strict banking privacy compliance (GDPR, PCI-DSS).

---

## 🏛️ System Architecture

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │      Interactive Web Dashboard (HTML5/CSS3/JS/SVG)     │
                                  │   - Command Center Topology Map   - Banking Portal     │
                                  │   - Federated Lab (Flower Engine) - Neural Inspector   │
                                  └───────────────────────────▲────────────────────────────┘
                                                              │ REST API / JSON
                                  ┌───────────────────────────▼────────────────────────────┐
                                  │                 Flask Web Backend (app.py)             │
                                  │       - Authentication (Flask-Login & Cryptography)    │
                                  │       - Real-time Threat Classification Engine         │
                                  └──────────────▲─────────────────────────────▲───────────┘
                                                 │                             │
                        ┌────────────────────────▼────────┐           ┌────────▼──────────────┐
                        │       SQLite (database.db)      │           │   Flower FL Server    │
                        │ - User Accounts                 │           │   (fl_server.py)      │
                        │ - Immutable Threat Logs Audit   │           │   Port: 5040 (gRPC)   │
                        │ - Training Round Metrics        │           └────────▲──────────────┘
                        └─────────────────────────────────┘                    │ FedAvg Aggregation
                                                                               │
                                                   ┌───────────────────────────┴───────────────────────────┐
                                                   │                                                       │
                                        ┌──────────▼──────────┐                                 ┌──────────▼──────────┐
                                        │  FL Client: Retail  │                                 │  FL Client: Crypto  │
                                        │ (fl_client.py 0)    │       ... (Fund Client 1)       │ (fl_client.py 2)    │
                                        │ - NSL-KDD Shard     │                                 │ - NSL-KDD Shard     │
                                        │ - Scikit-learn MLP  │                                 │ - Scikit-learn MLP  │
                                        └─────────────────────┘                                 └─────────────────────┘
```

---

## ✨ Core Features

1. **Decentralized Collaborative Defense (Flower / FLWR):**
   - Implements **Federated Averaging (FedAvg)** and **FedProx** algorithms over gRPC channels.
   - Cross-bank collaborative immunity: a zero-day attack identified at one bank updates the global neural weights for all participants without revealing raw transaction records.

2. **Machine Learning Intrusion Classifier (Scikit-Learn):**
   - Multi-Layer Perceptron (`MLPClassifier`) trained on 8-dimensional **NSL-KDD** network traffic features (packet rates, byte volume, protocol entropy, failed logins, error rates).

3. **Differential Privacy (DP-SGD):**
   - $L_2$ gradient clipping and Gaussian noise injection protect local training gradients against membership inference attacks.

4. **Live Banking Simulator & Neural Inspector:**
   - Real-time packet inspection queue with dynamic **ML Gate Shield**.
   - Interactive SVG neural graph visualizing neuron activations and synapse weights in real-time.

5. **Relational Database Audit Trails (SQLite):**
   - Persists all blocked threats, user authentication records, and historical accuracy/epsilon training metrics.

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.11+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/WinnieMugambi/federated-learning-ids.git
cd federated-learning-ids
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Initialize the SQLite Database
```bash
python database.py
```
*Creates `database.db` and seeds default administrator credentials (`admin` / `admin123`).*

### 4. Launch the Application
```bash
python app.py
```
Open your browser and navigate to: **`http://localhost:8080`**

---

## 🧪 Automated Testing
Run the Pytest validation suite to verify database CRUD operations and model parameter serialization:
```bash
pytest test_app.py
```

---

## 🐳 Docker Deployment
Run the complete stack inside a containerized environment:
```bash
docker-compose up --build
```
Access the application at `http://localhost:8080`.

---

## 📂 Project Structure

```
├── app.py               # Main Flask web application and API endpoints
├── database.py          # SQLite database schema, CRUD queries, and password hashing
├── data_loader.py       # NSL-KDD dataset preprocessor and Non-IID client sharding
├── fl_server.py         # Flower federated server (FedAvg weight aggregator)
├── fl_client.py         # Flower client wrapping Scikit-Learn MLPClassifier
├── test_app.py          # Automated Pytest unit test suite
├── requirements.txt     # Python package requirements
├── Dockerfile           # Docker container build specifications
├── docker-compose.yml   # Multi-service container orchestration
├── templates/
│   ├── login.html       # Glassmorphism login page
│   └── dashboard.html   # Multi-page cyber command center & simulator
└── static/
    ├── css/styles.css   # Dark-mode styling, glowing accents, animations
    └── js/dashboard.js  # REST API bridge, SVG neural network visualizer, charts
```

---

## 👥 Author
- **Winnie Mugambi**
