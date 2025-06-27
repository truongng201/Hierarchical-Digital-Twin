export function calculateDistance(point1X, point1Y, point2X, point2Y) {
    const dx = point2X - point1X;
    const dy = point2Y - point1Y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function findNearestNode(nodes, current_user) {
    if (!nodes || nodes.length === 0 || !current_user) {
        return null;
    }

    let nearestNode = nodes[0];
    let minDistance = calculateDistance(current_user.x, current_user.y, nearestNode.x, nearestNode.y);

    for(let i = 1; i < nodes.length; i++) {
        const node = nodes[i];
        const distance = calculateDistance(current_user.x, current_user.y, node.x, node.y);

        if (distance < minDistance) {
            minDistance = distance;
            nearestNode = node;
        }
    }

    return nearestNode;
}

export function getAllNodes(edgeNodes, centralNodes) {
    if (!edgeNodes && !centralNodes) {
        return [];
    }
    const allNodes = []
    for(let i = 0; i < edgeNodes.length; i++) {
        allNodes.push(edgeNodes[i]);
    }
    for(let i = 0; i < centralNodes.length; i++) {
        allNodes.push(centralNodes[i]);
    }
    return allNodes
}

// Latency cache for user-node and edge-edge pairs
const latencyCache = new Map();

// Helper to build a cache key
function getLatencyKey(userId, nodeId, nodeType) {
  return `${userId || ''}|${nodeId}|${nodeType}`;
}

// Calculate latency based on connection using experimental formula, with caching that is invalidated if distance changes
export function calculateLatency(user, nodeId, nodeType, edgeNodes, centralNodes) {
  let targetNode = null;
  if (nodeType === "edge") {
    targetNode = edgeNodes.find((edge) => edge.id === nodeId);
  } else if (nodeType === "central") {
    targetNode = centralNodes.find((central) => central.id === nodeId);
  }

  if (!targetNode) return 100 + Math.random() * 50;

  const key = getLatencyKey(user?.id, nodeId, nodeType);
  const currentDistance = user && targetNode ? calculateDistance(user.x, user.y, targetNode.x, targetNode.y) : 0;
  const cached = latencyCache.get(key);
  if (cached && cached.distance === currentDistance) {
    return cached.latency;
  }

  // Generate random data size s(u,t) in range [100, 500] MB
  const dataSize = 100 + Math.random() * 400; // MB
  // Determine if it's Cold Start or Warm Start
  const isWarmStart = targetNode.isWarm || false; // I_{u,v,t}
  const coldStartIndicator = isWarmStart ? 1 : 0;
  // Calculate Communication Delay: d_com = s(u,t) × τ(v_u,t, v)
  let unitTransmissionDelay; // τ (ms/MB)
  if (nodeType === "edge") {
    // Between APs: [0.2, 1] ms/MB
    unitTransmissionDelay = 0.2 + Math.random() * 0.8;
  } else {
    // To Cloud: [2, 10] ms/MB  
    unitTransmissionDelay = 2 + Math.random() * 8;
  }
  const communicationDelay = dataSize * unitTransmissionDelay;
  // Calculate Processing Delay: d_proc = (1 - I_{u,v,t}) × d_cold + s(u,t) × ρ_{u,v}
  // Cold start delay [100, 500] ms
  const coldStartDelay = 100 + Math.random() * 400;
  // Unit processing time ρ_{u,v} (ms/MB)
  let unitProcessingTime;
  if (nodeType === "edge") {
    // Cloudlet: [0.5, 2] ms/MB
    unitProcessingTime = 0.5 + Math.random() * 1.5;
  } else {
    // Cloud: 0.05 ms/MB
    unitProcessingTime = 0.05;
  }
  const processingDelay = (1 - coldStartIndicator) * coldStartDelay + dataSize * unitProcessingTime;
  // Total Service Delay: D(u,v,t) = d_com + d_proc
  const totalLatency = communicationDelay + processingDelay;
  // Mark node as warm for next requests (simulating container reuse)
  if (targetNode) {
    targetNode.isWarm = true;
    targetNode.lastAccessTime = Date.now();
  }
  // Store additional metrics for debugging/display
  if (targetNode) {
    targetNode.lastMetrics = {
      dataSize: Math.round(dataSize),
      communicationDelay: Math.round(communicationDelay),
      processingDelay: Math.round(processingDelay),
      isWarmStart: isWarmStart,
      unitTransmissionDelay: unitTransmissionDelay.toFixed(3),
      unitProcessingTime: unitProcessingTime.toFixed(3)
    };
  }
  const rounded = Math.round(totalLatency);
  latencyCache.set(key, { latency: rounded, distance: currentDistance });
  return rounded;
}

// Optionally, provide a way to clear the cache (e.g., on simulation reset)
export function clearLatencyCache() {
  latencyCache.clear();
}

export default {
    calculateDistance,
    findNearestNode,
    getAllNodes,
    calculateLatency
}