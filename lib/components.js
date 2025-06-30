class Node {
    constructor(id, x, y, capacity, currentLoad, coverage) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.capacity = capacity; 
        this.currentLoad = currentLoad;
        this.coverage = coverage; 
    }
}

export class Graph {
    constructor() {
        this.nodes = [];
        this.centralNodes = [];
        this.edgeNodes = [];
        this.userNodes = [];
        this.edges = [];
        this.nodeMap = new Map(); // Optional: to quickly access nodes by id
    }

    addNode(node) {
        this.nodes.push(node);
        this.nodeMap.set(node.id, node);
        if (node.type === 'central') {
            this.centralNodes.push(node);
        } else if (node.type === 'edge') {
            this.edgeNodes.push(node);
        } else if (node.type === 'user') {
            this.userNodes.push(node);
        } else {
            throw new Error("Node type must be 'central', 'edge', or 'user'");
        }
    }

    deleteNode(nodeId) {
        const node = this.nodeMap.get(nodeId);
        if (!node) {
            throw new Error(`Node with id ${nodeId} does not exist`);
        }
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        this.nodeMap.delete(nodeId);
        if (node.type === 'central') {
            this.centralNodes = this.centralNodes.filter(n => n.id !== nodeId);
        } else if (node.type === 'edge') {
            this.edgeNodes = this.edgeNodes.filter(n => n.id !== nodeId);
        } else if (node.type === 'user') {
            this.userNodes = this.userNodes.filter(n => n.id !== nodeId);
        }
        // Remove edges associated with the deleted node
        this.edges = this.edges.filter(edge => edge.source.id !== nodeId && edge.target.id !== nodeId);
    }

    addEdge(source, target, distance) {
        if(source.type !== 'edge' && source.type !== 'central' && source.type !== 'user') {
            throw new Error("Source node must be of type 'edge' or 'central'");
        }
        if(target.type !== 'edge' && target.type !== 'central' && target.type !== 'user') {
            throw new Error("Target node must be of type 'edge' or 'central'");
        }
        if(this.nodeMap.has(source.id) && this.nodeMap.has(target.id)) {
            
        }
        let latency = 0; // Default weight for the edge
        let speed = 0; 
        if(source.type === 'edge' && target.type === 'edge') {
            speed = Math.random() * (5 - 1) + 1 // random speed in range [1, 5] MB/ms
        } else if(source.type === 'central' && target.type === 'edge' || source.type === 'edge' && target.type === 'central') {
            speed = Math.random() * (0.5 - 0.1) + 0.1 // random speed in range [0.1, 0.5] MB/ms
        } else if(source.type === 'user' && target.type === 'edge' || source.type === 'edge' && target.type === 'user') {
            speed = Math.random() * (2 - 0.5) + 0.5; // Random processing rate in range [0.5, 2] MB/ms for queries between user and edge nodes
        } else if(source.type === 'user' && target.type === 'central' || source.type === 'central' && target.type === 'user') {
            speed = 20 // Random processing rate is set to 20 MB/ms for queries between user and central nodes
        }
        latency = distance * speed
        this.edges.push({ source, target, latency });
        // Adjacency list representation
        if (!this.nodeMap.has(source.id)) {
            this.nodeMap.set(source.id, { edges: [] });
        }
        if (!this.nodeMap.has(target.id)) {
            this.nodeMap.set(target.id, { edges: [] });
        }
        this.nodeMap.get(source.id).edges.push({ target: target.id, latency, speed });
        this.nodeMap.get(target.id).edges.push({ target: source.id, latency, speed });
    }

    getNodeById(id) {
        return this.nodeMap.get(id);
    }

    getAllNodes() {
        return Array.from(this.nodeMap.values());
    }
}

export class Replica {
    constructor(id, nodeId, isWarm = false, coldStartDelay = 0) {
        this.id = id; // Unique identifier for the replica
        this.nodeId = nodeId; // ID of the node where the replica is stored
        this.isWarm = isWarm; // Indicates if the replica is warm (true) or cold (false)
        this.coldStartDelay = coldStartDelay; // Cold start delay in milliseconds, applicable if isWarm is false
        this.lastAccessTime = Date.now(); // Timestamp of the last access to the replica
        this.lastMetrics = {
            dataSize: 0, // Size of the data associated with the replica
            communicationDelay: 0, // Communication delay for the replica
            processingDelay: 0, // Processing delay for the replica
            isWarmStart: isWarm, // Indicates if the last access was a warm start
            unitTransmissionDelay: 0, // Transmission delay per MB
            unitProcessingTime: 0 // Processing time per MB
        };
    }
}

export class EdgeNode extends Node {
    constructor(id, x, y, capacity, coverage, replicas = [], currentLoad = 0) {
        super(id, x, y, capacity, 0, coverage);
        this.replicas = replicas;
        this.type = 'edge';
        this.currentLoad = currentLoad;
        this.coldStartDelay = Math.random() * (500 - 100) + 100; // Random cold start delay in range [100, 500] ms
    }
}

export class CentralNode extends Node {
    constructor(id, x, y, capacity, coverage, replicas = [], currentLoad = 0) {
        super(id, x, y, capacity, 0, coverage);
        this.replicas = replicas; // Replicas of the central node
        this.type = 'central';
        this.currentLoad = currentLoad; // Current load of the central node
    }
}

export class UserNode extends Node {
    constructor(id, x, y, capacity, coverage, userSpeed, latency = 0, assignedNode = null, predictedPath = []) {
        super(id, x, y, capacity, 0, coverage);
        this.type = 'user';
        this.userSpeed = userSpeed;
        this.velocity = {
            x: (Math.random() - 0.5) * userSpeed, // Random velocity in x direction
            y: (Math.random() - 0.5) * userSpeed  // Random velocity in y direction
        }
        this.latency = latency; // Latency to the nearest edge node
        this.assignedNode = assignedNode; // Node to which the user is currently connected
        this.predictedPath = predictedPath; // Predicted path for the user
        this.dataSize = Math.random() * (500 - 100) + 100; // Random data size for the user in range [100, 500] MB
    }
}

export function cloneGraph(graph) {
    return Object.create(Object.getPrototypeOf(graph), Object.getOwnPropertyDescriptors(graph));
}

export default {
    EdgeNode,
    CentralNode,
    UserNode,
    Replica,
    Graph,
    cloneGraph
}