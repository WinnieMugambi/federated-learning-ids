/**
 * static/js/dashboard.js
 * Frontend Orchestrator for FinTech CyberShield.
 * Bridges dashboard UI events with Flask REST API routes, loops transaction flows,
 * handles gRPC-simulated canvas animations, and draws the SVG neural network.
 */

const state = {
    activeTab: 'dashboard',
    isTraining: false,
    activeAttacks: {}, // Key: Node ID, Value: Attack Type (1-4)
    activeParticles: [],
    logsCount: 0,
    selectedInspectorNode: 0,
    
    // Banking indicators
    serverCPU: 12,
    serverSuccessRate: 100,
    transactionCount: 0,

    // Chart configurations
    accuracyChart: null,
    privacyChart: null
};

// FinTech Nodes
const NODES = [
    { id: 0, key: 'retail', name: 'Apex Retail Bank', type: 'retail', xPercent: 0.3, yPercent: 0.72, color: '#00d2ff', desc: 'Apex Retail Database.' },
    { id: 1, key: 'fund', name: 'Global Trust Fund', type: 'fund', xPercent: 0.3, yPercent: 0.28, color: '#b100ff', desc: 'Secure institutional ledger.' },
    { id: 2, key: 'crypto', name: 'CryptoPay Gateway', type: 'crypto', xPercent: 0.7, yPercent: 0.28, color: '#81b29a', desc: 'P2P API payment ledger.' }
];

const SERVER_NODE = { name: 'Flower Aggregator', xPercent: 0.5, yPercent: 0.5, color: '#00ff88' };
const INTERNET_NODE = { name: 'Internet WAN', xPercent: 0.08, yPercent: 0.5, color: '#ff0055' };

window.addEventListener('DOMContentLoaded', () => {
    initUI();
    initCanvas();
    initCharts();
    startBankingSimulation();
    fetchStats();
    fetchLogs();
    
    // Poll logs and stats every 3 seconds to keep UI fresh
    setInterval(() => {
        if (!state.isTraining) {
            fetchStats();
            fetchLogs();
        }
    }, 3000);
});

/**
 * Configure Sidebar Tabs Router & Buttons
 */
function initUI() {
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
            
            if (pageId === 'inspector') {
                fetchWeightsAndDraw();
            }
        });
    });

    // Slider label updates
    const hookSlider = (sliderId, valId) => {
        const s = document.getElementById(sliderId);
        const v = document.getElementById(valId);
        if (s && v) {
            s.addEventListener('input', () => v.textContent = s.value);
        }
    };
    hookSlider('lr-slider', 'lr-val');
    hookSlider('epochs-slider', 'epochs-val');
    hookSlider('batch-slider', 'batch-val');
    hookSlider('mu-slider', 'mu-val');
    hookSlider('clip-slider', 'clip-val');
    hookSlider('noise-slider', 'noise-val');

    const aggSelect = document.getElementById('aggregation-select');
    if (aggSelect) {
        aggSelect.addEventListener('change', () => {
            const p = document.getElementById('fedprox-mu-group');
            if (p) p.style.display = aggSelect.value === 'fedprox' ? 'block' : 'none';
        });
    }

    const dpToggle = document.getElementById('dp-toggle');
    const dpSettings = document.querySelectorAll('.dp-setting');
    if (dpToggle) {
        dpToggle.addEventListener('change', () => {
            dpSettings.forEach(el => {
                el.style.opacity = dpToggle.checked ? '1' : '0.4';
                el.querySelectorAll('input').forEach(i => i.disabled = !dpToggle.checked);
            });
        });
    }

    // Trigger FL training via Flask API
    document.getElementById('train-round-btn').addEventListener('click', triggerFederatedRound);
    document.getElementById('auto-train-btn').addEventListener('click', toggleAutoTrain);

    // Page 2 Simulator Attack vector buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const attackType = parseInt(btn.dataset.attack);
            let targetId = 0;
            if (attackType === 1) targetId = 0; // DDoS targets Retail
            else if (attackType === 4) targetId = 1; // Exfil targets Fund
            else targetId = 2; // Brute force targets Crypto

            if (state.activeAttacks[targetId] === attackType) {
                delete state.activeAttacks[targetId];
                btn.classList.remove('active');
                logToTerminal(`Sim: Cleared Vector [${getAttackName(attackType)}] targeting ${NODES[targetId].name}.`, 'info');
            } else {
                state.activeAttacks[targetId] = attackType;
                btn.classList.add('active');
                logToTerminal(`ALERT: Threat simulation vector launched targeting ${NODES[targetId].name}!`, 'alert');
            }
            updateThreatsUI();
        });
    });

    document.getElementById('clear-attacks-btn-page2').addEventListener('click', () => {
        state.activeAttacks = {};
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
        logToTerminal('Threat vectors reset. Reverting to baseline normal traffic.', 'success');
        updateThreatsUI();
    });

    // Inspector Node select grid
    document.querySelectorAll('.node-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.node-select-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedInspectorNode = parseInt(btn.dataset.node);
            fetchWeightsAndDraw();
        });
    });
}

function getAttackName(id) {
    const names = ['Normal', 'DDoS Attack', 'Port Scan', 'Brute Force SSH', 'Data Exfiltration'];
    return names[id] || 'Unknown';
}

/**
 * Fetch Stats from Flask API
 */
function fetchStats() {
    fetch('/api/stats')
        .then(res => res.json())
        .then(data => {
            document.getElementById('dash-acc').textContent = data.accuracy;
            document.getElementById('dash-eps').textContent = data.epsilon;
            document.getElementById('dash-rounds').textContent = data.rounds;
            document.getElementById('dash-threats').textContent = data.threats;
            
            // Sync dashboard values to Lab scoreboard
            const labAcc = document.getElementById('global-acc-val');
            if (labAcc) labAcc.textContent = data.accuracy;
            const labEps = document.getElementById('global-eps-val');
            if (labEps) labEps.textContent = data.epsilon;
            const labRounds = document.getElementById('global-round-val');
            if (labRounds) labRounds.textContent = data.rounds;
        })
        .catch(err => console.error("Error fetching stats:", err));
}

/**
 * Fetch Logs from Flask API
 */
function fetchLogs() {
    fetch('/api/logs')
        .then(res => res.json())
        .then(logs => {
            const term = document.getElementById('log-terminal-output');
            const miniLogs = document.getElementById('log-stream-mini');
            if (!term) return;

            // Render scrolling terminal
            term.innerHTML = '';
            logs.forEach(log => {
                const logType = log.status === 'BLOCKED' ? 'success' : (log.status === 'COMPROMISED' ? 'alert' : 'info');
                term.innerHTML += `
                    <div class="log-line">
                        <span class="log-time">[${log.time_str}]</span>
                        <span class="log-tag ${logType}">${logType}</span>
                        <span>[${log.attack_type}] Source: ${log.source_ip} -> Status: ${log.status} (Conf: ${(log.confidence * 100).toFixed(0)}%)</span>
                    </div>
                `;
            });
            term.scrollTop = term.scrollHeight;

            // Render mini logs sidebar
            if (miniLogs) {
                miniLogs.innerHTML = '';
                const alertLogs = logs.filter(l => l.status === 'COMPROMISED' || l.status === 'BLOCKED').slice(0, 5);
                if (alertLogs.length === 0) {
                    miniLogs.innerHTML = '<div class="empty-log">Grid quiet. Monitoring active transactions...</div>';
                } else {
                    alertLogs.forEach(log => {
                        const classColor = log.status === 'COMPROMISED' ? 'danger' : 'success';
                        miniLogs.innerHTML += `
                            <div class="mini-log-line ${classColor}">
                                [${log.time_str}] [${log.status}] ${log.attack_type} on Node ${log.target_node}
                            </div>
                        `;
                    });
                }
            }
        })
        .catch(err => console.error("Error fetching logs:", err));
}

/**
 * Trigger Federated Training Round
 */
function triggerFederatedRound() {
    if (state.isTraining) return;
    state.isTraining = true;

    logToTerminal("Initiating Flower FLWR gRPC server round. Waiting for clients to connect...", "system");
    animateModelTransfer('upload');

    fetch('/api/trigger-train', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            logToTerminal(`Round complete! Global accuracy: ${data.accuracy}, Loss: ${data.loss}, Epsilon ε: ${data.epsilon}`, 'success');
            animateModelTransfer('download');
            
            // Push values to Chart.js
            state.accuracyChart.data.labels.push(data.round);
            state.accuracyChart.data.datasets[0].data.push(parseFloat(data.accuracy));
            state.accuracyChart.update();

            state.privacyChart.data.labels.push(data.round);
            state.privacyChart.data.datasets[0].data.push(parseFloat(data.epsilon));
            state.privacyChart.update();

            fetchStats();
            fetchLogs();
            state.isTraining = false;
        })
        .catch(err => {
            console.error("Error triggering FL round:", err);
            logToTerminal("Flower server round crashed. Verify fl_server.py gRPC port availability.", "alert");
            state.isTraining = false;
        });
}

function toggleAutoTrain() {
    const btn = document.getElementById('auto-train-btn');
    if (state.isAutoTraining) {
        clearInterval(state.autoTrainInterval);
        state.isAutoTraining = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Toggle Continuous Training';
        btn.classList.remove('active');
    } else {
        state.isAutoTraining = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-stop"></i> Stop Training';
        btn.classList.add('active');
        
        triggerFederatedRound();
        state.autoTrainInterval = setInterval(() => {
            if (!state.isTraining) triggerFederatedRound();
        }, 3200);
    }
}

/**
 * Fetch weights and draw MLP SVG Nodes
 */
function fetchWeightsAndDraw() {
    fetch('/api/weights')
        .then(res => res.json())
        .then(data => {
            drawNeuralNetworkSVG(data.W1, data.W2);
            updateWeightsGrid(data.W1);
        })
        .catch(err => console.error("Error fetching weights:", err));
}

function drawNeuralNetworkSVG(W1, W2) {
    const svg = document.getElementById('neural-network-svg');
    if (!svg) return;
    svg.innerHTML = '';

    const width = svg.clientWidth || 500;
    const height = svg.clientHeight || 400;

    const numInputs = 8;
    const numHidden = 8;
    const numOutputs = 5;

    const featureLabels = ['Duration', 'Pkt Rate', 'Byte Rate', 'Port Div', 'Protocol', 'Entropy', 'Fail Login', 'Error Rate'];
    const outputLabels = ['Normal', 'DDoS', 'PortScan', 'Brute', 'Exfil'];

    const getCoords = (size, xPos) => {
        const coords = [];
        const pad = 35;
        const spacing = (height - pad * 2) / (size - 1 || 1);
        for (let i = 0; i < size; i++) {
            coords.push({ x: xPos, y: pad + i * spacing });
        }
        return coords;
    };

    const inputCoords = getCoords(numInputs, width * 0.15);
    const hiddenCoords = getCoords(numHidden, width * 0.5);
    const outputCoords = getCoords(numOutputs, width * 0.85);

    // 1. Draw W1 connections
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

    // 2. Draw W2 connections
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

    // 3. Nodes Drawing helper
    const drawNodes = (coords, radius, strokeColor, labels, isLeftText = true) => {
        coords.forEach((c, idx) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', c.x);
            circle.setAttribute('cy', c.y);
            circle.setAttribute('r', radius);
            circle.setAttribute('fill', '#050811');
            circle.setAttribute('stroke', strokeColor);
            circle.setAttribute('stroke-width', 2);
            svg.appendChild(circle);

            if (labels) {
                const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                txt.setAttribute('x', isLeftText ? c.x - 14 : c.x + 16);
                txt.setAttribute('y', c.y + 4);
                txt.setAttribute('fill', isLeftText ? '#94a3b8' : '#f8fafc');
                txt.setAttribute('font-size', '10px');
                txt.setAttribute('text-anchor', isLeftText ? 'end' : 'start');
                txt.setAttribute('font-family', 'Outfit');
                txt.textContent = labels[idx];
                svg.appendChild(txt);
            }
        });
    };

    drawNodes(inputCoords, 8, '#00d2ff', featureLabels, true);
    drawNodes(hiddenCoords, 7, '#b100ff', null);
    drawNodes(outputCoords, 10, '#00ff88', outputLabels, false);
}

function updateWeightsGrid(W1) {
    const grid = document.getElementById('weights-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const flat = W1.flatMap(row => row.map(Math.abs));
    const maxVal = Math.max(...flat) || 1;

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const w = W1[i][j];
            const cell = document.createElement('div');
            cell.className = 'matrix-cell';
            const norm = Math.abs(w) / maxVal;
            cell.style.backgroundColor = w > 0 ? `rgba(0, 255, 136, ${norm})` : `rgba(255, 0, 85, ${norm})`;
            cell.title = `W1[${i}][${j}]: ${w.toFixed(4)}`;
            grid.appendChild(cell);
        }
    }
}

/**
 * Topology map canvas drawer
 */
function initCanvas() {
    const canvas = document.getElementById('network-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const resize = () => {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

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

        // Draw Links: WAN -> Clients
        NODES.forEach(n => {
            const nX = W * n.xPercent;
            const realNY = H * n.yPercent;
            ctx.strokeStyle = state.activeAttacks[n.id] ? 'rgba(255, 0, 85, 0.25)' : 'rgba(0, 210, 255, 0.1)';
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
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.05)';
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

function animateModelTransfer(direction = 'upload') {
    const canvas = document.getElementById('network-canvas');
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const sX = W * SERVER_NODE.xPercent, sY = H * SERVER_NODE.yPercent;

    NODES.forEach(n => {
        const nX = W * n.xPercent, nY = H * n.yPercent;
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
 * PAGE 2: Banking queue simulation with Flask /api/predict link
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

        // Fetch prediction from Python Flask backend (Scikit-Learn model)
        fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                features: tx.features,
                target_node: tx.targetNode,
                is_malicious: tx.isMalicious,
                attack_class: tx.attackClass
            })
        })
        .then(res => res.json())
        .then(res => {
            const badge = document.getElementById(`tx-badge-${tx.id}`);
            const shieldEl = document.getElementById('ml-gate-shield');
            
            if (tx.isMalicious) {
                if (res.status === 'BLOCKED') {
                    if (badge) {
                        badge.className = 'tx-status-badge allowed'; // Green theme in BT5
                        badge.textContent = 'BLOCKED';
                    }
                    shieldEl.className = 'ml-gate-shield active';
                    
                    state.serverCPU = Math.max(12, state.serverCPU - 10);
                    state.serverSuccessRate = Math.min(100, state.serverSuccessRate + 2);
                } else {
                    if (badge) {
                        badge.className = 'tx-status-badge blocked'; // Red theme
                        badge.textContent = 'BYPASSED';
                    }
                    card.style.borderColor = '#ff0055';
                    shieldEl.className = 'ml-gate-shield compromised';
                    
                    state.serverCPU = Math.min(100, state.serverCPU + 30);
                    state.serverSuccessRate = Math.max(0, state.serverSuccessRate - 12);
                }
            } else {
                if (res.status === 'ALLOWED') {
                    if (badge) {
                        badge.className = 'tx-status-badge allowed';
                        badge.textContent = 'ALLOWED';
                    }
                    shieldEl.className = 'ml-gate-shield active';
                } else {
                    if (badge) {
                        badge.className = 'tx-status-badge blocked';
                        badge.textContent = 'FALSE BLOCK';
                    }
                    shieldEl.className = 'ml-gate-shield compromised';
                    state.serverSuccessRate = Math.max(50, state.serverSuccessRate - 5);
                }
            }

            // Sync visual gauges
            document.getElementById('cpu-load-val').textContent = `${state.serverCPU.toFixed(0)}%`;
            document.getElementById('cpu-load-fill').style.width = `${state.serverCPU}%`;
            document.getElementById('success-rate-val').textContent = `${state.serverSuccessRate.toFixed(0)}%`;
            document.getElementById('success-rate-fill').style.width = `${state.serverSuccessRate}%`;

            // Adjust colors based on health threshold values
            const cpuFill = document.getElementById('cpu-load-fill');
            cpuFill.className = `progress-bar-fill ${state.serverCPU > 75 ? 'danger' : (state.serverCPU > 45 ? 'warning' : 'success')}`;
            const successFill = document.getElementById('success-rate-fill');
            successFill.className = `progress-bar-fill ${state.serverSuccessRate < 60 ? 'danger' : (state.serverSuccessRate < 85 ? 'warning' : 'success')}`;

            setTimeout(() => { shieldEl.className = 'ml-gate-shield'; }, 600);
            
            // Force reload logs instantly to keep events in sync
            fetchLogs();
            fetchStats();
        })
        .catch(err => console.error("Error during prediction fetch:", err));
    }

    // Generate simulated user events
    setInterval(() => {
        if (state.activeTab !== 'dashboard' && state.activeTab !== 'banking') return;

        const activeNodes = Object.keys(state.activeAttacks);
        let tx = { id: state.transactionCount + 1 };
        
        if (activeNodes.length > 0 && Math.random() > 0.3) {
            const targetId = parseInt(activeNodes[Math.floor(Math.random() * activeNodes.length)]);
            const attackClass = state.activeAttacks[targetId];
            
            // Build dummy features (simulating traffic.js client side profiles)
            // 8 inputs: [duration, packet_rate, byte_rate, port_diversity, protocol_type, payload_entropy, failed_logins, error_rate]
            let features = [0.1, 0.4, 0.3, 0.05, 0.0, 0.4, 0.0, 0.02];
            if (attackClass === 1) features = [0.03, 0.95, 0.85, 0.01, 0.0, 0.2, 0.0, 0.9]; // DDoS
            else if (attackClass === 3) features = [0.75, 0.25, 0.12, 0.01, 0.0, 0.4, 0.92, 0.08]; // BruteForce
            else if (attackClass === 4) features = [0.85, 0.35, 0.92, 0.02, 0.0, 0.96, 0.0, 0.01]; // Exfiltration

            tx.isMalicious = true;
            tx.attackClass = attackClass;
            tx.targetNode = targetId;
            tx.features = features;
            
            if (attackClass === 1) tx.title = `CRITICAL: High-frequency UDP Syn packet burst`;
            else if (attackClass === 3) tx.title = `AUTH FAILURE: Repetitive SSH login attempts`;
            else tx.title = `DATABASE DUMP: Exporting secure tables`;
        } else {
            const targetId = Math.floor(Math.random() * 3);
            tx.isMalicious = false;
            tx.attackClass = 0;
            tx.targetNode = targetId;
            tx.features = [0.15, 0.35, 0.25, 0.05, 0.0, 0.35, 0.0, 0.01]; // Normal features
            
            const sender = names[Math.floor(Math.random() * names.length)];
            const receiver = names[Math.floor(Math.random() * names.length)];
            const amount = Math.floor(Math.random() * 450) + 5;
            tx.title = `${sender} transferred $${amount} to ${receiver}`;
        }

        addTransactionCard(tx);
    }, 1800);
}

function updateThreatsUI() {
    const tc = Object.keys(state.activeAttacks).length;
    document.getElementById('dash-threats').textContent = tc;
    
    const badge = document.getElementById('system-status-badge');
    const text = document.getElementById('system-status-text');
    const globalStatus = document.getElementById('global-status-text');
    const globalDot = document.querySelector('.sidebar-footer .status-dot');

    const page2Threat = document.getElementById('global-threats-val');
    if (page2Threat) page2Threat.textContent = tc;

    if (tc === 0) {
        badge.style.color = '#00ff88';
        badge.style.borderColor = 'rgba(0, 255, 136, 0.2)';
        text.textContent = 'Network Guard: Active';
        globalStatus.textContent = 'Consortium Secure';
        globalStatus.style.color = '#00ff88';
        if (globalDot) globalDot.className = 'status-dot';
    } else {
        badge.style.color = '#ff0055';
        badge.style.borderColor = 'rgba(255, 0, 85, 0.2)';
        text.textContent = `${tc} ACTIVE THREATS`;
        globalStatus.textContent = 'THREAT INTRUSION';
        globalStatus.style.color = '#ff0055';
        if (globalDot) globalDot.className = 'status-dot red';
    }
}

function initCharts() {
    const make = (id, color) => new Chart(document.getElementById(id), {
        type: 'line',
        data: { labels: [0], datasets: [{ data: [0], borderColor: color, fill: false, tension: 0.2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    state.accuracyChart = make('accuracy-chart', '#00ff88');
    state.privacyChart = make('privacy-chart', '#b100ff');
}

function logToTerminal(msg, type) {
    const term = document.getElementById('log-terminal-output');
    if (!term) return;
    const time = new Date().toLocaleTimeString();
    term.innerHTML += `<div class="log-line"><span class="log-time">[${time}]</span><span class="log-tag ${type}">${type}</span><span>${msg}</span></div>`;
    term.scrollTop = term.scrollHeight;
}
