/**
 * traffic.js
 * FinTech Consortium Traffic Flow Simulator.
 * Generates synthetic multi-dimensional network records customized for 
 * Retail Banking, Institutional Investing, and Cryptographic Ledger nodes.
 */

const ATTACK_LABELS = {
    NORMAL: 0,
    DDOS: 1,
    PORT_SCAN: 2,
    BRUTE_FORCE: 3,
    EXFILTRATION: 4
};

const ATTACK_NAMES = ['Normal', 'DDoS Attack', 'Port Scan', 'Brute Force SSH', 'Data Exfiltration'];

// Features:
// 0: duration (0-1)
// 1: packet_rate (0-1)
// 2: byte_rate (0-1)
// 3: port_diversity (0-1)
// 4: protocol_type (0 = TCP, 0.5 = UDP, 1.0 = ICMP/Other)
// 5: payload_entropy (0-1)
// 6: failed_logins (0-1)
// 7: error_rate (0-1)

/**
 * Generates a network traffic flow sample based on the bank node type and attack vector.
 */
function generateTrafficSample(nodeType, attackType) {
    let features = new Array(8).fill(0);
    let label = attackType;

    const randGaussian = (mean, stdDev) => {
        let u1 = Math.random();
        let u2 = Math.random();
        let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
        return mean + stdDev * randStdNormal;
    };
    const clamp = (val, min = 0, max = 1) => Math.max(min, Math.min(max, val));

    if (attackType === ATTACK_LABELS.NORMAL) {
        // Normal profile modeling per financial client
        switch (nodeType) {
            case 'retail': // Apex Retail Bank: High-volume customer login, small transfers
                features[0] = clamp(randGaussian(0.12, 0.03)); // short sessions
                features[1] = clamp(randGaussian(0.45, 0.08)); // high packet rate
                features[2] = clamp(randGaussian(0.25, 0.05)); // low-to-medium bytes
                features[3] = clamp(randGaussian(0.04, 0.01)); // low port diversity
                features[4] = 0.0; // TCP
                features[5] = clamp(randGaussian(0.35, 0.05)); // standard transaction strings
                features[6] = 0.0;
                features[7] = clamp(randGaussian(0.01, 0.005));
                break;

            case 'fund': // Global Trust Fund: Big corporate transactions, long secure sessions
                features[0] = clamp(randGaussian(0.65, 0.12)); // long active sessions
                features[1] = clamp(randGaussian(0.2, 0.04));  // low constant packet rate
                features[2] = clamp(randGaussian(0.55, 0.1));  // high byte rate (large encrypted transfers)
                features[3] = clamp(randGaussian(0.08, 0.02)); // single target port
                features[4] = 0.0; // TCP
                features[5] = clamp(randGaussian(0.75, 0.08)); // heavily encrypted/high entropy payloads
                features[6] = 0.0;
                features[7] = clamp(randGaussian(0.02, 0.01));
                break;

            case 'crypto': // CryptoPay Gateway: Lightning sync ledger, high-speed p2p syncs
                features[0] = clamp(randGaussian(0.05, 0.01)); // extremely brief handshakes
                features[1] = clamp(randGaussian(0.7, 0.1));   // extremely high constant UDP packets
                features[2] = clamp(randGaussian(0.35, 0.06)); // moderate byte size
                features[3] = clamp(randGaussian(0.15, 0.03)); // distributed peers
                features[4] = 0.5; // UDP
                features[5] = clamp(randGaussian(0.4, 0.05));  // moderate ledger serialization entropy
                features[6] = 0.0;
                features[7] = clamp(randGaussian(0.05, 0.02));
                break;
        }
    } else {
        // Attack definitions
        switch (attackType) {
            case ATTACK_LABELS.DDOS:
                features[0] = clamp(randGaussian(0.04, 0.01));
                features[1] = clamp(randGaussian(0.96, 0.02)); // maximum packet frequency
                features[2] = clamp(randGaussian(0.85, 0.05));
                features[3] = clamp(randGaussian(0.01, 0.005)); // single targeted API endpoint
                features[4] = nodeType === 'crypto' ? 0.5 : 0.0; // UDP flood on Crypto, TCP Syn on Banks
                features[5] = clamp(randGaussian(0.2, 0.08));  // low payload complexity (junk data)
                features[6] = 0.0;
                features[7] = clamp(randGaussian(0.9, 0.05));  // severe connection faults
                break;

            case ATTACK_LABELS.PORT_SCAN:
                features[0] = clamp(randGaussian(0.06, 0.02));
                features[1] = clamp(randGaussian(0.8, 0.08));
                features[2] = clamp(randGaussian(0.1, 0.02));
                features[3] = clamp(randGaussian(0.96, 0.02)); // sweep across all ports
                features[4] = 0.0; // TCP Syn
                features[5] = 0.0; // no payload
                features[6] = 0.0;
                features[7] = clamp(randGaussian(0.75, 0.1));
                break;

            case ATTACK_LABELS.BRUTE_FORCE:
                features[0] = clamp(randGaussian(0.7, 0.1));
                features[1] = clamp(randGaussian(0.25, 0.04));
                features[2] = clamp(randGaussian(0.12, 0.02));
                features[3] = clamp(randGaussian(0.01, 0.005)); // login port (port 22/443)
                features[4] = 0.0; // TCP
                features[5] = clamp(randGaussian(0.48, 0.08));
                features[6] = clamp(randGaussian(0.92, 0.04)); // massive login failures
                features[7] = clamp(randGaussian(0.08, 0.03));
                break;

            case ATTACK_LABELS.EXFILTRATION:
                features[0] = clamp(randGaussian(0.85, 0.08)); // long sustained dump
                features[1] = clamp(randGaussian(0.35, 0.06));
                features[2] = clamp(randGaussian(0.92, 0.04)); // massive data transmission rate
                features[3] = clamp(randGaussian(0.02, 0.01));
                features[4] = 0.0; // TCP
                features[5] = clamp(randGaussian(0.96, 0.02)); // encrypted zip/backup dump (highest entropy)
                features[6] = 0.0;
                features[7] = clamp(randGaussian(0.01, 0.005));
                break;
        }
    }

    return { features, label };
}

/**
 * Pre-populates a mock dataset containing heterogeneous attack labels tailored per FinTech client
 */
function generateNodeDataset(nodeType, numSamples = 200) {
    const data = [];
    const distributions = {
        retail: [0.75, 0.16, 0.01, 0.07, 0.01], // High Normal, vulnerable to DDoS and Brute Force
        fund:   [0.72, 0.01, 0.05, 0.01, 0.21], // Normal, highly vulnerable to Exfiltration
        crypto: [0.65, 0.22, 0.11, 0.01, 0.01]  // High DDoS, moderate Port Scan
    };
    const dist = distributions[nodeType] || [0.8, 0.05, 0.05, 0.05, 0.05];

    for (let i = 0; i < numSamples; i++) {
        const r = Math.random();
        let cumSum = 0;
        let selectedLabel = 0;
        for (let j = 0; j < dist.length; j++) {
            cumSum += dist[j];
            if (r <= cumSum) {
                selectedLabel = j;
                break;
            }
        }
        data.push(generateTrafficSample(nodeType, selectedLabel));
    }
    return data;
}

// Export for browser
window.trafficSimulator = {
    ATTACK_LABELS,
    ATTACK_NAMES,
    generateTrafficSample,
    generateNodeDataset
};
