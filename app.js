/**
 * app.js
 * FinTech Consortium FL-IDS Application Orchestrator.
 * Manages the UI router, the banking transaction queue simulator,
 * SVG-based neural network architecture rendering, and Chart.js analytics.
 */

// Global Application State
const state = {
    clients: [],
    server: null,
    trainData: {},
    testData: [],
    activeAttacks: {}, // Key: Node ID, Value: Attack Type (1-4)
    activeParticles: [],
    activeTab: 'dashboard',
    isTraining: false,
    isAutoTraining: false,
    autoTrainInterval: null,
    accuracyChart: null,
    privacyChart: null,
    logsCount: 0,
    selectedInspectorNode: 0,
    
    // Banking portal metrics
    serverCPU: 12,
    serverSuccessRate: 100,
    transactionCount: 0
};

// FinTech Nodes Configurations
const NODES = [
    { id: 0, key: 'retail', name: 'Apex Retail Bank', type: 'retail', xPercent: 0.3, yPercent: 0.72, color: '#00d2ff', desc: 'Handles high-volume customer accounts and small cash transactions. Vulnerable to Brute Force login credential stuffing.' },
    { id: 1, key: 'fund', name: 'Global Trust Fund', type: 'fund', xPercent: 0.3, yPercent: 0.28, color: '#b100ff', desc: 'Manages low-frequency, high-value corporate investments. Target of data exfiltration exploits.' },
    { id: 2, key: 'crypto', name: 'CryptoPay Gateway', type: 'crypto', xPercent: 0.7, yPercent: 0.28, color: '#81b29a', desc: 'Manages cryptographic payment ledgers. Vulnerable to protocol exploits and DDoS port scans.' }
];

const SERVER_NODE = { name: 'Consortium Aggregator', xPercent: 0.5, yPercent: 0.5, color: '#00ff88' };
const INTERNET_NODE = { name: 'External Traffic WAN', xPercent: 0.08, yPercent: 0.5, color: '#ff0055' };

// Initialize System on DOM Load
window.addEventListener('DOMContentLoaded', () => {
    initSimulation();
    initUI();
    initCanvas();
    initCharts();
    startBankingSimulation();
    
    logToTerminal('Consortium Security Core active. Cryptographic channels initialized.', 'success');
    logToTerminal('Apex Retail Bank portal active. Monitoring transactions...', 'info');
});

/**
 * Initialize Clients, Server, and Datasets
 */
function initSimulation() {
    state.server = new FederatedServer(8, 8, 5);
    
    NODES.forEach(n => {
        const client = new LocalClient(n.id, n.name, n.type);
        state.clients.push(client);
        client.setWeights(state.server.getGlobalWeights());
        
        // Generate Non-IID local training sets
        state.trainData[n.id] = window.trafficSimulator.generateNodeDataset(n.type, 200);
    });

    // Generate balanced test set
    state.testData = [];
    NODES.forEach(n => {
        state.testData.push(...window.trafficSimulator.generateNodeDataset(n.type, 80));
    });

    // Record initial baseline round metrics
    const evalRes = state.server.evaluateGlobal(state.testData);
    state.server.history.round.push(0);
    state.server.history.accuracy.push(evalRes.accuracy);
    state.server.history.loss.push(evalRes.loss);
    state.server.history.epsilon.push(0.0);
}

/**
 * Configure Viewport Routing and Interactive Listeners
 */
function initUI() {
    // 1. Sidebar Tab Router
    const navButtons = document.querySelectorAll('.nav-btn');
    const pageSections = document.querySelectorAll('.page-section');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const pageId = btn.dataset.page;
            
            navButtons.forEach(b => b.classList.remove('active'));
            pageSections.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            const targetPage = document.getElementById(`page-${pageId}`);
            if (targetPage) targetPage.classList.add('active');
            
            state.activeTab = pageId;
            
            // Trigger drawings if switching to specific page
            if (pageId === 'inspector') {
                drawNeuralNetworkSVG();
                updateWeightsGrid();
            }
        });
    });

    // 2. Control Sliders Configuration
    const hookSlider = (sliderId, valId) => {
        const slider = document.getElementById(sliderId);
        const label = document.getElementById(valId);
        slider.addEventListener('input', () => {
            label.textContent = slider.value;
        });
    };
    hookSlider('lr-slider', 'lr-val');
    hookSlider('epochs-slider', 'epochs-val');
    hookSlider('batch-slider', 'batch-val');
    hookSlider('mu-slider', 'mu-val');
    hookSlider('clip-slider', 'clip-val');
    hookSlider('noise-slider', 'noise-val');

    // Aggregator algorithm selector
    const aggSelect = document.getElementById('aggregation-select');
    const proxGroup = document.getElementById('fedprox-mu-group');
    aggSelect.addEventListener('change', () => {
        proxGroup.style.display = aggSelect.value === 'fedprox' ? 'block' : 'none';
        logToTerminal(`Consortium: Aggregator solver toggled to ${aggSelect.value.toUpperCase()}.`, 'info');
    });

    // DP Toggle
    const dpToggle = document.getElementById('dp-toggle');
    const dpSettings = document.querySelectorAll('.dp-setting');
    dpToggle.addEventListener('change', () => {
        dpSettings.forEach(el => {
            el.style.opacity = dpToggle.checked ? '1' : '0.4';
            el.querySelectorAll('input').forEach(i => i.disabled = !dpToggle.checked);
        });
        logToTerminal(`Privacy Audit: Differential Privacy (DP-SGD) toggled ${dpToggle.checked ? 'ON' : 'OFF'}.`, 'system');
    });

    // 3. Training Triggers
    document.getElementById('train-round-btn').addEventListener('click', runFederatedRound);
    document.getElementById('auto-train-btn').addEventListener('click', toggleAutoTrain);

    // 4. Attack simulators page triggers
    const setupAttackToggles = (buttonsClass) => {
        document.querySelectorAll(buttonsClass).forEach(btn => {
            btn.addEventListener('click', () => {
                const attackType = parseInt(btn.dataset.attack);
                
                // Map attack vectors to target nodes
                let targetId = 0;
                if (attackType === 1) targetId = 0; // DDoS on Retail
                else if (attackType === 4) targetId = 1; // Exfiltration on Fund
                else targetId = 2; // Brute force on Crypto

                if (state.activeAttacks[targetId] === attackType) {
                    delete state.activeAttacks[targetId];
                    btn.classList.remove('active');
                    logToTerminal(`Sim: Cleared Vector [${window.trafficSimulator.ATTACK_NAMES[attackType]}] targeting ${NODES[targetId].name}.`, 'info');
                } else {
                    state.activeAttacks[targetId] = attackType;
                    
                    // Clear other active buttons for this node
                    document.querySelectorAll(buttonsClass).forEach(b => {
                        if (parseInt(b.dataset.attack) !== attackType) {
                            let bTarget = 0;
                            const bAttack = parseInt(b.dataset.attack);
                            if (bAttack === 1) bTarget = 0;
                            else if (bAttack === 4) bTarget = 1;
                            else bTarget = 2;
                            if (bTarget === targetId) bTarget.classList?.remove('active');
                        }
                    });
                    
                    btn.classList.add('active');
                    logToTerminal(`CRITICAL DETECTED: Intrusion simulation vector launched targeting ${NODES[targetId].name}!`, 'alert');
                }
                updateDashboardThreatsGauge();
            });
        });
    };
    setupAttackToggles('.action-btn');

    document.getElementById('clear-attacks-btn-page2').addEventListener('click', () => {
        state.activeAttacks = {};
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
        logToTerminal('Threat simulation vectors disabled. Reverting to baseline normal traffic.', 'success');
        updateDashboardThreatsGauge();
    });

    // 5. Neural Inspector Node Selectors
    document.querySelectorAll('.node-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.node-select-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedInspectorNode = parseInt(btn.dataset.node);
            updateWeightsGrid();
        });
    });
}

/**
 * Configure ChartJS Instances
 */
function initCharts() {
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#64748b', font: { size: 9 } } },
            y: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#64748b', font: { size: 9 } } }
        }
    };

    state.accuracyChart = new Chart(document.getElementById('accuracy-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [0],
            datasets: [{
                data: [state.server.history.accuracy[0] * 100],
                borderColor: '#00ff88',
                backgroundColor: 'rgba(0, 255, 136, 0.05)',
                borderWidth: 2,
                fill: true,
                tension: 0.25
            }]
        },
        options: {
            ...defaultOptions,
            scales: {
                ...defaultOptions.scales,
                y: { min: 0, max: 100 }
            }
        }
    });

    state.privacyChart = new Chart(document.getElementById('privacy-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [0],
            datasets: [{
                data: [0.0],
                borderColor: '#b100ff',
                backgroundColor: 'rgba(177, 0, 255, 0.05)',
                borderWidth: 2,
                fill: true,
                tension: 0.25
            }]
        },
        options: defaultOptions
    });

    updateDashboardMetricsUI();
}

/**
 * Live Network Topology Drawing Loop (Canvas)
 */
function initCanvas() {
    const canvas = document.getElementById('network-canvas');
    const ctx = canvas.getContext('2d');
    
    const resize = () => {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Canvas particle spawner
    function spawnTrafficParticles() {
        const W = canvas.width;
        const H = canvas.height;
        const iX = W * INTERNET_NODE.xPercent;
        const iY = H * INTERNET_NODE.yPercent;

        NODES.forEach(n => {
            if (Math.random() < 0.035) {
                const isAttack = !!state.activeAttacks[n.id];
                state.activeParticles.push({
                    x: iX, y: iY,
                    sX: iX, sY: iY,
                    eX: W * n.xPercent, eY: H * n.yPercent,
                    progress: 0,
                    speed: (isAttack ? (2.2 + Math.random() * 1.5) : (1.1 + Math.random() * 1.0)) / 100,
                    color: isAttack ? '#ff0055' : '#00d2ff',
                    size: isAttack ? 4 : 2,
                    type: isAttack ? 'attack' : 'normal',
                    targetNode: n.id
                });
            }
        });
    }

    function drawNode(x, y, radius, color, label, ringActive = false) {
        ctx.shadowBlur = ringActive ? 15 : 0;
        ctx.shadowColor = color;
        ctx.fillStyle = '#050811';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = `600 ${radius * 0.45}px 'Outfit'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const W = canvas.width;
        const H = canvas.height;

        const iX = W * INTERNET_NODE.xPercent;
        const iY = H * INTERNET_NODE.yPercent;
        const sX = W * SERVER_NODE.xPercent;
        const sY = H * SERVER_NODE.yPercent;

        // Draw background mesh grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Draw Links: WAN -> Clients
        NODES.forEach(n => {
            const nX = W * n.xPercent;
            const nY = W * n.yPercent * (H / W); // keep ratio
            const realNY = H * n.yPercent;
            
            const grad = ctx.createLinearGradient(iX, iY, nX, realNY);
            grad.addColorStop(0, state.activeAttacks[n.id] ? 'rgba(255, 0, 85, 0.25)' : 'rgba(0, 210, 255, 0.1)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(iX, iY);
            ctx.lineTo(nX, realNY);
            ctx.stroke();
        });

        // Draw Links: Server <-> Clients
        NODES.forEach(n => {
            const nX = W * n.xPercent;
            const realNY = H * n.yPercent;
            
            const grad = ctx.createLinearGradient(sX, sY, nX, realNY);
            grad.addColorStop(0, 'rgba(0, 255, 136, 0.15)');
            grad.addColorStop(1, 'rgba(0, 210, 255, 0.03)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sX, sY);
            ctx.lineTo(nX, realNY);
            ctx.stroke();
        });

        // Spawn and update particles
        spawnTrafficParticles();
        for (let i = state.activeParticles.length - 1; i >= 0; i--) {
            const p = state.activeParticles[i];
            p.progress += p.speed;
            if (p.progress >= 1.0) {
                state.activeParticles.splice(i, 1);
            } else {
                p.x = p.sX + (p.eX - p.sX) * p.progress;
                p.y = p.sY + (p.eY - p.sY) * p.progress;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw Nodes
        drawNode(iX, iY, 18, INTERNET_NODE.color, 'WAN');
        drawNode(sX, sY, 30, SERVER_NODE.color, 'SERVER');
        NODES.forEach(n => {
            const isAttacked = !!state.activeAttacks[n.id];
            drawNode(W * n.xPercent, H * n.yPercent, 22, isAttacked ? '#ff0055' : n.color, n.key.substring(0,2).toUpperCase(), isAttacked);
        });

        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}

/**
 * Triggers upload/download weight animations on Canvas
 */
function animateModelTransfer(direction = 'upload') {
    const canvas = document.getElementById('network-canvas');
    const W = canvas.width;
    const H = canvas.height;
    const sX = W * SERVER_NODE.xPercent;
    const sY = H * SERVER_NODE.yPercent;

    NODES.forEach(n => {
        const nX = W * n.xPercent;
        const nY = H * n.yPercent;
        const color = direction === 'upload' ? '#b100ff' : '#00ff88';

        for (let k = 0; k < 6; k++) {
            setTimeout(() => {
                state.activeParticles.push({
                    x: direction === 'upload' ? nX : sX,
                    y: direction === 'upload' ? nY : sY,
                    sX: direction === 'upload' ? nX : sX,
                    sY: direction === 'upload' ? nY : sY,
                    eX: direction === 'upload' ? sX : nX,
                    eY: direction === 'upload' ? sY : nY,
                    progress: 0,
                    speed: (1.5 + Math.random() * 1.5) / 100,
                    color: color,
                    size: 3,
                    type: 'weights'
                });
            }, k * 100);
        }
    });
}

/**
 * PAGE 2: Banking Transaction Simulator Loop
 */
function startBankingSimulation() {
    const queue = document.getElementById('transaction-queue');
    const names = ['Emma', 'Liam', 'Sophia', 'Noah', 'Olivia', 'Jackson', 'Ava', 'Ethan', 'Isabella', 'Lucas', 'Mia', 'Aiden'];
    const nodesMap = { 0: 'Retail Bank', 1: 'Investment Fund', 2: 'CryptoPay Gateway' };

    function addTransactionCard(tx) {
        state.transactionCount++;
        if (queue.children.length > 7) {
            queue.removeChild(queue.lastChild);
        }

        const card = document.createElement('div');
        card.className = `tx-card ${tx.isMalicious ? 'malicious' : ''}`;
        card.id = `tx-${state.transactionCount}`;

        card.innerHTML = `
            <div class="tx-left">
                <div class="tx-icon"><i class="fa-solid ${tx.isMalicious ? 'fa-triangle-exclamation' : 'fa-circle-dollar-to-slot'}"></i></div>
                <div class="tx-details">
                    <span class="tx-title">${tx.title}</span>
                    <span class="tx-sub">Target: ${nodesMap[tx.targetNode]}</span>
                </div>
            </div>
            <div class="tx-right">
                <span class="tx-status-badge pending" id="tx-badge-${state.transactionCount}">Inspecting...</span>
            </div>
        `;

        queue.insertBefore(card, queue.firstChild);

        // Animate ML Shield processing
        setTimeout(() => {
            const badge = document.getElementById(`tx-badge-${tx.id}`);
            const shieldEl = document.getElementById('ml-gate-shield');
            
            // Run Machine Learning Classifier prediction
            const client = state.clients[tx.targetNode];
            const evaluation = client.forward(tx.features);
            const y_hat = evaluation.y_hat;

            // Argmax
            let predLabel = 0, confidence = y_hat[0];
            for (let j = 1; j < y_hat.length; j++) {
                if (y_hat[j] > confidence) {
                    confidence = y_hat[j];
                    predLabel = j;
                }
            }

            const shieldStatus = document.getElementById('ml-gate-shield');
            
            if (tx.isMalicious) {
                // If model detects it as attack
                if (predLabel === tx.attackClass) {
                    // Correct block!
                    if (badge) {
                        badge.className = 'tx-status-badge blocked';
                        badge.textContent = 'BLOCKED';
                    }
                    shieldEl.className = 'ml-gate-shield active'; // green glow
                    logToTerminal(`[Collaborative Shield] BLOCKED Simulated Attack [${window.trafficSimulator.ATTACK_NAMES[tx.attackClass]}] on ${client.name}`, 'success');
                    
                    // Recover server metrics
                    state.serverCPU = Math.max(12, state.serverCPU - 10);
                    state.serverSuccessRate = Math.min(100, state.serverSuccessRate + 2);
                } else {
                    // Bypass! Model classified it as Normal or wrong attack
                    if (badge) {
                        badge.className = 'tx-status-badge allowed';
                        badge.textContent = 'COMPROMISED';
                    }
                    card.style.borderColor = '#ff0055';
                    shieldEl.className = 'ml-gate-shield compromised'; // red flashing
                    logToTerminal(`[BYPASS WARNING] ${client.name} COMPROMISED by [${window.trafficSimulator.ATTACK_NAMES[tx.attackClass]}] (Classified as ${window.trafficSimulator.ATTACK_NAMES[predLabel]})`, 'alert');
                    
                    // Degrade server metrics
                    state.serverCPU = Math.min(100, state.serverCPU + 35);
                    state.serverSuccessRate = Math.max(0, state.serverSuccessRate - 15);
                }
            } else {
                // Normal transaction processing
                if (predLabel === 0) {
                    // Correctly allowed
                    if (badge) {
                        badge.className = 'tx-status-badge allowed';
                        badge.textContent = 'ALLOWED';
                    }
                    shieldEl.className = 'ml-gate-shield active';
                } else {
                    // False positive: blocked normal traffic!
                    if (badge) {
                        badge.className = 'tx-status-badge blocked';
                        badge.textContent = 'FALSE BLOCK';
                    }
                    shieldEl.className = 'ml-gate-shield compromised';
                    logToTerminal(`[FALSE POSITIVE] Local model on ${client.name} BLOCKED legitimate user transaction (Classified as ${window.trafficSimulator.ATTACK_NAMES[predLabel]})`, 'alert');
                    state.serverSuccessRate = Math.max(50, state.serverSuccessRate - 5);
                }
            }

            // Sync visual gauges
            document.getElementById('cpu-load-val').textContent = `${state.serverCPU.toFixed(0)}%`;
            document.getElementById('cpu-load-fill').style.width = `${state.serverCPU}%`;
            document.getElementById('success-rate-val').textContent = `${state.serverSuccessRate.toFixed(0)}%`;
            document.getElementById('success-rate-fill').style.width = `${state.serverSuccessRate}%`;

            // Style colors based on warning values
            const cpuFill = document.getElementById('cpu-load-fill');
            cpuFill.className = `progress-bar-fill ${state.serverCPU > 75 ? 'danger' : (state.serverCPU > 45 ? 'warning' : 'success')}`;
            const successFill = document.getElementById('success-rate-fill');
            successFill.className = `progress-bar-fill ${state.serverSuccessRate < 60 ? 'danger' : (state.serverSuccessRate < 85 ? 'warning' : 'success')}`;

            // Restore status indicator after 600ms
            setTimeout(() => {
                shieldEl.className = 'ml-gate-shield';
            }, 600);

        }, 800);
    }

    // Interval loop to feed transactions
    setInterval(() => {
        // Only run if on dashboard or banking tab
        if (state.activeTab !== 'dashboard' && state.activeTab !== 'banking') return;

        // Check if any attack is active
        const activeNodes = Object.keys(state.activeAttacks);
        
        let tx = { id: state.transactionCount + 1 };
        
        if (activeNodes.length > 0 && Math.random() > 0.3) {
            // Spawn malicious packets matching the active vector
            const targetId = parseInt(activeNodes[Math.floor(Math.random() * activeNodes.length)]);
            const attackClass = state.activeAttacks[targetId];
            
            const sample = window.trafficSimulator.generateTrafficSample(NODES[targetId].type, attackClass);
            tx.isMalicious = true;
            tx.attackClass = attackClass;
            tx.targetNode = targetId;
            tx.features = sample.features;
            
            if (attackClass === 1) tx.title = `CRITICAL: High-frequency UDP Syn packet burst`;
            else if (attackClass === 3) tx.title = `AUTH FAILURE: Repetitive SSH login attempts`;
            else tx.title = `DATABASE DUMP: Exporting secure tables`;
        } else {
            // Normal banking user transactions
            const targetId = Math.floor(Math.random() * 3);
            const sample = window.trafficSimulator.generateTrafficSample(NODES[targetId].type, 0);
            
            tx.isMalicious = false;
            tx.attackClass = 0;
            tx.targetNode = targetId;
            tx.features = sample.features;
            
            const sender = names[Math.floor(Math.random() * names.length)];
            const receiver = names[Math.floor(Math.random() * names.length)];
            const amount = Math.floor(Math.random() * 450) + 5;
            tx.title = `${sender} transferred $${amount} to ${receiver}`;
        }

        addTransactionCard(tx);
    }, 1800);
}

/**
 * PAGE 3: Federated Training Orchestration
 */
function runFederatedRound() {
    if (state.isTraining) return;
    state.isTraining = true;

    // Hyperparameters
    const lr = parseFloat(document.getElementById('lr-slider').value);
    const epochs = parseInt(document.getElementById('epochs-slider').value);
    const batchSize = parseInt(document.getElementById('batch-slider').value);
    const dpEnabled = document.getElementById('dp-toggle').checked;
    const dpNoise = parseFloat(document.getElementById('noise-slider').value);
    const dpClip = parseFloat(document.getElementById('clip-slider').value);
    const aggAlg = document.getElementById('aggregation-select').value;
    const mu = parseFloat(document.getElementById('mu-slider').value);

    logToTerminal(`------ CONSORTIUM FEDERATED LEARNING ROUND ${state.server.round + 1} ------`, 'system');
    logToTerminal(`Config: Solver=${aggAlg.toUpperCase()}, Epochs=${epochs}, Batch=${batchSize}, DP=${dpEnabled ? 'ON' : 'OFF'} (σ=${dpNoise}, C=${dpClip})`, 'info');

    // Canvas animation trigger
    animateModelTransfer('upload');

    setTimeout(() => {
        const clientSizes = {};
        
        // Local Client updates
        state.clients.forEach(c => {
            sizes = state.trainData[c.id].length;
            clientSizes[c.id] = sizes;

            const gw = (aggAlg === 'fedprox') ? state.server.getGlobalWeights() : null;
            const loss = c.trainLocal(state.trainData[c.id], epochs, batchSize, lr, dpEnabled, dpNoise, dpClip, gw, mu);
            const evalRes = c.evaluate(state.trainData[c.id]);

            logToTerminal(`Local model [${c.name}] Loss: ${loss.toFixed(4)}, Acc: ${(evalRes.accuracy*100).toFixed(1)}%, εSpent: ${c.epsilon === Infinity ? '∞' : c.epsilon.toFixed(2)}`, 'info');
        });

        // Aggregation
        if (aggAlg === 'fedprox') {
            state.server.aggregateFedProx(state.clients, clientSizes);
        } else {
            state.server.aggregateFedAvg(state.clients, clientSizes);
        }

        // Broadcast weights
        const globalWeights = state.server.getGlobalWeights();
        state.clients.forEach(c => c.setWeights(globalWeights));

        // Evaluate updated global model
        const evalRes = state.server.evaluateGlobal(state.testData);
        const maxEps = dpEnabled ? Math.max(...state.clients.map(c => c.epsilon)) : Infinity;

        // Log outputs
        logToTerminal(`Aggregator: Model Aggregation complete. Unified accuracy: ${(evalRes.accuracy*100).toFixed(2)}%, Loss: ${evalRes.loss.toFixed(4)}`, 'success');
        if (dpEnabled) {
            logToTerminal(`Privacy Audit: Maximum consortium privacy leakage spent ε = ${maxEps.toFixed(3)} at delta = 10^-5`, 'system');
        } else {
            logToTerminal('Privacy Audit: Differential Privacy noise bypassed.', 'warning');
        }

        // Animate download back to nodes
        animateModelTransfer('download');

        // Record history
        state.server.history.round.push(state.server.round);
        state.server.history.accuracy.push(evalRes.accuracy);
        state.server.history.loss.push(evalRes.loss);
        state.server.history.epsilon.push(maxEps);

        // Update charts & scoreboards
        updateCharts(state.server.round, evalRes.accuracy * 100, maxEps);
        updateDashboardMetricsUI();

        state.isTraining = false;
    }, 1200);
}

function toggleAutoTrain() {
    const btn = document.getElementById('auto-train-btn');
    if (state.isAutoTraining) {
        clearInterval(state.autoTrainInterval);
        state.isAutoTraining = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Toggle Continuous Training';
        btn.classList.remove('active');
        logToTerminal('Continuous learning cycle suspended.', 'info');
    } else {
        state.isAutoTraining = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-stop"></i> Stop Training';
        btn.classList.add('active');
        logToTerminal('Continuous learning cycle started.', 'success');
        
        runFederatedRound();
        state.autoTrainInterval = setInterval(() => {
            if (!state.isTraining) runFederatedRound();
        }, 2800);
    }
}

/**
 * PAGE 4: Draw Interactive Neural Network SVG Graph
 */
function drawNeuralNetworkSVG() {
    const svg = document.getElementById('neural-network-svg');
    if (!svg) return;
    svg.innerHTML = ''; // clear

    const width = svg.clientWidth || 500;
    const height = svg.clientHeight || 400;

    const numInputs = 8;
    const numHidden = 8;
    const numOutputs = 5;

    // Feature Labels
    const featureLabels = ['Duration', 'Pkt Rate', 'Byte Rate', 'Port Div', 'Protocol', 'Entropy', 'Fail Login', 'Error Rate'];
    const outputLabels = ['Normal', 'DDoS', 'PortScan', 'Brute', 'Exfil'];

    // Coordinates mapping
    const getCoordinates = (layerSize, xPosition, isLabelLeft = true) => {
        const coords = [];
        const padding = 35;
        const spacing = (height - padding * 2) / (layerSize - 1 || 1);
        for (let i = 0; i < layerSize; i++) {
            coords.push({
                x: xPosition,
                y: padding + i * spacing
            });
        }
        return coords;
    };

    const inputCoords = getCoordinates(numInputs, width * 0.15);
    const hiddenCoords = getCoordinates(numHidden, width * 0.5);
    const outputCoords = getCoordinates(numOutputs, width * 0.85);

    // Fetch weights from the currently selected client node
    const client = state.clients[state.selectedInspectorNode];
    const W1 = client.W1;
    const W2 = client.W2;

    // 1. Draw connecting lines: Input -> Hidden
    let maxW1 = Math.max(...W1.flatMap(r => r.map(Math.abs))) || 1;
    for (let i = 0; i < numInputs; i++) {
        for (let j = 0; j < numHidden; j++) {
            const w = W1[i][j];
            const norm = Math.abs(w) / maxW1;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', inputCoords[i].x);
            line.setAttribute('y1', inputCoords[i].y);
            line.setAttribute('x2', hiddenCoords[j].x);
            line.setAttribute('y2', hiddenCoords[j].y);
            line.setAttribute('stroke', w > 0 ? '#00ff88' : '#ff0055');
            line.setAttribute('stroke-width', norm * 2);
            line.setAttribute('opacity', 0.15 + norm * 0.6);
            svg.appendChild(line);
        }
    }

    // 2. Draw connecting lines: Hidden -> Output
    let maxW2 = Math.max(...W2.flatMap(r => r.map(Math.abs))) || 1;
    for (let i = 0; i < numHidden; i++) {
        for (let j = 0; j < numOutputs; j++) {
            const w = W2[i][j];
            const norm = Math.abs(w) / maxW2;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', hiddenCoords[i].x);
            line.setAttribute('y1', hiddenCoords[i].y);
            line.setAttribute('x2', outputCoords[j].x);
            line.setAttribute('y2', outputCoords[j].y);
            line.setAttribute('stroke', w > 0 ? '#00ff88' : '#ff0055');
            line.setAttribute('stroke-width', norm * 2);
            line.setAttribute('opacity', 0.15 + norm * 0.6);
            svg.appendChild(line);
        }
    }

    // 3. Draw Input Nodes & Labels
    inputCoords.forEach((c, idx) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', c.x);
        circle.setAttribute('cy', c.y);
        circle.setAttribute('r', 8);
        circle.setAttribute('fill', '#050811');
        circle.setAttribute('stroke', '#00d2ff');
        circle.setAttribute('stroke-width', 2);
        svg.appendChild(circle);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', c.x - 14);
        txt.setAttribute('y', c.y + 4);
        txt.setAttribute('fill', '#94a3b8');
        txt.setAttribute('font-size', '10px');
        txt.setAttribute('text-anchor', 'end');
        txt.setAttribute('font-family', 'Outfit');
        txt.textContent = featureLabels[idx];
        svg.appendChild(txt);
    });

    // 4. Draw Hidden Nodes
    hiddenCoords.forEach(c => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', c.x);
        circle.setAttribute('cy', c.y);
        circle.setAttribute('r', 7);
        circle.setAttribute('fill', '#050811');
        circle.setAttribute('stroke', '#b100ff');
        circle.setAttribute('stroke-width', 1.5);
        svg.appendChild(circle);
    });

    // 5. Draw Output Nodes & Labels
    outputCoords.forEach((c, idx) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', c.x);
        circle.setAttribute('cy', c.y);
        circle.setAttribute('r', 10);
        circle.setAttribute('fill', '#050811');
        circle.setAttribute('stroke', '#00ff88');
        circle.setAttribute('stroke-width', 2);
        svg.appendChild(circle);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', c.x + 16);
        txt.setAttribute('y', c.y + 4);
        txt.setAttribute('fill', '#f8fafc');
        txt.setAttribute('font-size', '11px');
        txt.setAttribute('font-weight', '600');
        txt.setAttribute('text-anchor', 'start');
        txt.setAttribute('font-family', 'Outfit');
        txt.textContent = outputLabels[idx];
        svg.appendChild(txt);
    });
}

/**
 * Updates weight matrix grid in Model Inspector tab
 */
function updateWeightsGrid() {
    const grid = document.getElementById('weights-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const client = state.clients[state.selectedInspectorNode];
    const flatWeights = client.W1.flatMap(row => row.map(Math.abs));
    const maxVal = Math.max(...flatWeights) || 1;

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const w = client.W1[i][j];
            const cell = document.createElement('div');
            cell.className = 'matrix-cell';
            const norm = Math.abs(w) / maxVal;
            
            // Map color intensity
            if (w > 0) {
                cell.style.backgroundColor = `rgba(0, 255, 136, ${norm})`;
            } else {
                cell.style.backgroundColor = `rgba(255, 0, 85, ${norm})`;
            }
            
            cell.title = `W1[Input ${i}][Hidden ${j}]: ${w.toFixed(4)}`;
            grid.appendChild(cell);
        }
    }
}

/**
 * Refresh charts data points
 */
function updateCharts(round, accuracy, epsilon) {
    state.accuracyChart.data.labels.push(round);
    state.accuracyChart.data.datasets[0].data.push(accuracy);
    state.accuracyChart.update();

    state.privacyChart.data.labels.push(round);
    state.privacyChart.data.datasets[0].data.push(epsilon === Infinity ? 0 : epsilon);
    state.privacyChart.update();
}

/**
 * Update general text counters on dashboard
 */
function updateDashboardMetricsUI() {
    const lastAcc = state.server.history.accuracy[state.server.history.accuracy.length - 1];
    const lastEps = state.server.history.epsilon[state.server.history.epsilon.length - 1];
    const roundCount = state.server.round;

    document.getElementById('dash-acc').textContent = `${(lastAcc * 100).toFixed(1)}%`;
    document.getElementById('dash-eps').textContent = lastEps === Infinity ? 'Infinity' : lastEps.toFixed(2);
    document.getElementById('dash-rounds').textContent = roundCount;
    
    // Synced with lab metrics panel
    const labAcc = document.getElementById('global-acc-val');
    if (labAcc) labAcc.textContent = `${(lastAcc * 100).toFixed(1)}%`;
    const labEps = document.getElementById('global-eps-val');
    if (labEps) labEps.textContent = lastEps === Infinity ? 'Infinity' : lastEps.toFixed(2);
    const labRounds = document.getElementById('global-round-val');
    if (labRounds) labRounds.textContent = roundCount;
}

/**
 * Sync overall threat level badge
 */
function updateDashboardThreatsGauge() {
    const threatCount = Object.keys(state.activeAttacks).length;
    document.getElementById('dash-threats').textContent = threatCount;
    
    const badge = document.getElementById('system-status-badge');
    const text = document.getElementById('system-status-text');
    const globalStatus = document.getElementById('global-status-text');
    const globalDot = document.querySelector('.sidebar-footer .status-dot');

    // Synced with page 2 threat counters
    const page2Threat = document.getElementById('global-threats-val');
    if (page2Threat) page2Threat.textContent = threatCount;

    if (threatCount === 0) {
        badge.className = 'status-badge';
        badge.style.color = '#00ff88';
        badge.style.borderColor = 'rgba(0, 255, 136, 0.2)';
        text.textContent = 'Network Guard: Active';
        
        globalStatus.textContent = 'Consortium Secure';
        globalStatus.style.color = '#00ff88';
        if (globalDot) globalDot.className = 'status-dot';
    } else {
        badge.className = 'status-badge active';
        badge.style.color = '#ff0055';
        badge.style.borderColor = 'rgba(255, 0, 85, 0.2)';
        text.textContent = `${threatCount} ACTIVE THREATS`;
        
        globalStatus.textContent = 'THREAT INTRUSION';
        globalStatus.style.color = '#ff0055';
        if (globalDot) globalDot.className = 'status-dot red';
    }
}

/**
 * Audit stream logger output
 */
function logToTerminal(message, type = 'info') {
    const term = document.getElementById('log-terminal-output');
    const miniLogs = document.getElementById('log-stream-mini');
    if (!term) return;

    state.logsCount++;
    if (state.logsCount > 80) {
        term.removeChild(term.firstChild);
    }

    const time = new Date().toLocaleTimeString();
    
    // Primary Terminal Line
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-tag ${type}">${type}</span>
        <span>${message}</span>
    `;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;

    // Mini Alerts Stream Sync (Only threat warnings/blocks)
    if (miniLogs && (type === 'alert' || type === 'success')) {
        // Clear empty state text
        if (miniLogs.querySelector('.empty-log')) {
            miniLogs.innerHTML = '';
        }
        
        if (miniLogs.children.length > 5) {
            miniLogs.removeChild(miniLogs.lastChild);
        }

        const miniLine = document.createElement('div');
        miniLine.className = `mini-log-line ${type === 'alert' ? 'danger' : 'success'}`;
        miniLine.textContent = `[${time}] ${message}`;
        
        miniLogs.insertBefore(miniLine, miniLogs.firstChild);
    }
}
