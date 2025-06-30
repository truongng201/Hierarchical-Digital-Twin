import { calculateDistance, findNearestNode } from "./helper";

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
        this.centralNodes = [];
        this.edgeNodes = [];
        this.userNodes = [];
        this.edges = [];
        this.nodeMap = new Map(); // Optional: to quickly access nodes by id
        this.speedCache = new Map(); // Cache for latency calculations
    }

    addNode(node) {
        this.nodeMap.set(node.id, []);
        if (node.type === 'central') {
            this.centralNodes.push(node);
        } else if (node.type === 'edge') {
            this.edgeNodes.push(node);
        } else if (node.type === 'user') {
            this.addUserNode(node); // Automatically assign user nodes to the nearest edge or central node
        } else {
            throw new Error("Node type must be 'central', 'edge', or 'user'");
        }
    }

    addUserNode(current_node){
        const allServerNodes = [...this.centralNodes, ...this.edgeNodes];
        if (allServerNodes.length === 0) {
            throw new Error("No server nodes available to assign a user node");
        }

        const nearestNode = findNearestNode(allServerNodes, current_node);
        if (!nearestNode) {
            throw new Error("No nearest node found for the user node");
        }
        current_node.assignedNode = nearestNode.id; // Assign the nearest node to the user
        this.addNewEdge(current_node, nearestNode);
        this.userNodes.push(current_node);
    }

    deleteNode(nodeId) {
        const node = this.nodeMap.get(nodeId);
        if (!node) {
            throw new Error(`Node with id ${nodeId} does not exist`);
        }
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

    addNewEdge(source, target) {
        const distance = calculateDistance(source.x, source.y, target.x, target.y);
        if(source.type !== 'edge' && source.type !== 'central' && source.type !== 'user') {
            throw new Error("Source node must be of type 'edge' or 'central'");
        }
        if(target.type !== 'edge' && target.type !== 'central' && target.type !== 'user') {
            throw new Error("Target node must be of type 'edge' or 'central'");
        }

        let latency = 0; // Default weight for the edge
        let speed = 0;
        let unitTransmissionDelay = 0; 
        if(source.type === 'edge' && target.type === 'edge') {
            // unitTransmissionDelay = 0.2 + Math.random() * 0.8; // Random transmission delay in range [0.2, 1] ms/MB
            speed = Math.random() * (0.5 - 0.1) + 0.1; // Random processing rate in range [1, 5] MB/ms for queries between edge nodes
        } else if(source.type === 'central' && target.type === 'edge' || source.type === 'edge' && target.type === 'central') {
            // unitTransmissionDelay = 2 + Math.random() * 8;
            speed = Math.random() * (0.5 - 0.1) + 0.1 // random speed in range [0.1, 0.5] MB/ms
        } else if(source.type === 'user' && target.type === 'edge' || source.type === 'edge' && target.type === 'user') {
            
            speed = Math.random() * (0.5 - 0.1) + 0.1; // Random processing rate in range [0.5, 2] MB/ms for queries between user and edge nodes
            // if (source.type === 'user') {
            //     // If the source is a user, use the user's speed
            //     speed = speed * source.dataSize
            // } else if (target.type === 'user') {
            //     // If the target is a user, use the user's speed
            //     speed = speed * target.dataSize
            // }
        } else if(source.type === 'user' && target.type === 'central' || source.type === 'central' && target.type === 'user') {
            // speed = 20 // Random processing rate is set to 20 MB/ms for queries between user and central nodes
            speed = Math.random() * (0.5 - 0.1) + 0.1;
        }
        if(this.speedCache.has(`${source.id}-${target.id}`)) {
            speed = this.speedCache.get(`${source.id}-${target.id}`);
        }
        latency = distance * speed
        latency = Math.round(latency);

        if(this.nodeMap.has(source.id) && this.nodeMap.has(target.id)) {
            // If the edge already exists, update the latency
            const existingEdge = this.nodeMap.get(target.id)?.find(edge => (edge.target === target.id || edge.source === target.id));
            if (existingEdge) {
                // update the latency of the existing edge
                this.nodeMap.get(source.id).push({ target: target.id, latency });
                return;
            }
        }

        this.edges.push({ source, target, latency });
        // Adjacency list representation
        if (!this.nodeMap.has(source.id)) {
            this.nodeMap.set(source.id, []);
        }
        if (!this.nodeMap.has(target.id)) {
            this.nodeMap.set(target.id, []);
        }
        this.speedCache.set(`${source.id}-${target.id}`, speed);
        // Push adjacency list entries
        this.nodeMap.get(source.id).push({ target: target.id, latency });
        this.nodeMap.get(target.id).push({ target: source.id, latency });
    }

    getSpeedCache(sourceId, targetId) {
        return this.speedCache.get(`${sourceId}-${targetId}`) || this.speedCache.get(`${targetId}-${sourceId}`) || 0;
    }
    getLatency(source, target) {
        if (!source || !target) {
            throw new Error("Source and target nodes must be defined");
        }
        // return this.nodeMap.get(source.id)?.find(edge => edge.target === target.id)?.latency || 0;
        const edges = this.nodeMap.get(source.id)
        // Get the last latency of last edge that matching added between source and target
        let ans = 0;
        for (const edge of edges) {
            if (edge.target === target.id || edge.source === target.id) {
                ans = edge.latency;
            }
        }
        return ans;
    }

    updateUserNode(updatedUser) {
        const existingUser = this.userNodes.find(node => node.id === updatedUser.id);
        if (!existingUser || existingUser.type !== 'user') {
            throw new Error(`User node with id ${updatedUser.id} does not exist`);
        }
        // Update the user node properties
        existingUser.x = updatedUser.x;
        existingUser.y = updatedUser.y;
        existingUser.userSpeed = updatedUser.userSpeed;
        existingUser.assignedNode = updatedUser.assignedNode; // Update assigned node if changed
        existingUser.predictedPath = updatedUser.predictedPath; // Update predicted path if changed
        existingUser.dataSize = updatedUser.dataSize; // Update data size if changed
        // Update the latency to the nearest edge node
        const allServerNodes = [...this.centralNodes, ...this.edgeNodes];
        const nearestNode = findNearestNode(allServerNodes, existingUser);
        if (!nearestNode) {
            throw new Error("No nearest node found for the user node");
        }
        existingUser.assignedNode = nearestNode.id; // Update the assigned node to the nearest node
        // Update the edges associated with the user node
        this.edges = this.edges.filter(edge => edge.source.id !== existingUser.id && edge.target.id !== existingUser.id);
        // Re-add the edge to the nearest node
        this.addNewEdge(existingUser, nearestNode);
    }


    updateEdgeNode(updatedEdge) {
        const existingEdge = this.getNodeById(updatedEdge.id);
        if (!existingEdge || existingEdge.type !== 'edge') {
            throw new Error(`Edge node with id ${updatedEdge.id} does not exist`);
        }
        // Update the edge node location and latency
        existingEdge.x = updatedEdge.x;
        existingEdge.y = updatedEdge.y;
        existingEdge.capacity = updatedEdge.capacity;
        existingEdge.currentLoad = updatedEdge.currentLoad;
        existingEdge.coverage = updatedEdge.coverage;
        existingEdge.coldStartDelay = updatedEdge.coldStartDelay; // Update cold start delay if changed
        // Update the edges associated with the edge node
        this.edges = this.edges.filter(edge => edge.source.id !== existingEdge.id && edge.target.id !== existingEdge.id);
        // Re-add edges to all connected nodes
        const allServerNodes = [...this.centralNodes, ...this.edgeNodes];
        allServerNodes.forEach(node => {
                if (node.id !== existingEdge.id) {
                    this.addNewEdge(existingEdge, node);
                }
            }
        );
    }

    updateCentralNode(updatedCentral) {
        const existingCentral = this.getNodeById(updatedCentral.id);
        if (!existingCentral || existingCentral.type !== 'central') {
            throw new Error(`Central node with id ${updatedCentral.id} does not exist`);
        }
        // Update the central node location and latency
        existingCentral.x = updatedCentral.x;
        existingCentral.y = updatedCentral.y;
        existingCentral.capacity = updatedCentral.capacity;
        existingCentral.currentLoad = updatedCentral.currentLoad;
        existingCentral.coverage = updatedCentral.coverage;
        // Update the edges associated with the central node
        this.edges = this.edges.filter(edge => edge.source.id !== existingCentral.id && edge.target.id !== existingCentral.id);
        // Re-add edges to all connected nodes
        const allServerNodes = [...this.centralNodes, ...this.edgeNodes];
        allServerNodes.forEach(node => {
                if (node.id !== existingCentral.id) {
                    this.addNewEdge(existingCentral, node);
                }
            }
        );
    }

    getNodeById(id) {
        const serverNode = [...this.centralNodes, ...this.edgeNodes, ...this.userNodes].find(node => node.id === id);
        if (!serverNode) {
            throw new Error(`Node with id ${id} does not exist`);
        }
        return serverNode
    }

    getAllNodes() {
        return Array.from(this.nodeMap.values());
    }

    avgerageLatency() {
        if (this.edges.length === 0) {
            return 0; // No edges, return 0 latency
        }
        // only calculate average latency that exist user
        let totalLength = 0;
        let totalLatency = 0;
        this.edges.forEach(edge => {
            if (edge.source.type === 'user' || edge.target.type === 'user') {
                totalLength += 1;
                totalLatency += edge.latency;
            }
        });
        return totalLatency / totalLength; // Average latency across all user edges
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
        super(id, x, y, capacity, currentLoad, coverage);
        this.replicas = replicas;
        this.type = 'edge';
        this.coldStartDelay = Math.random() * (500 - 100) + 100; // Random cold start delay in range [100, 500] ms
    }
}

export class CentralNode extends Node {
    constructor(id, x, y, capacity, coverage, replicas = [], currentLoad = 0) {
        super(id, x, y, capacity, currentLoad, coverage);
        this.replicas = replicas; // Replicas of the central node
        this.type = 'central';
    }
}

export class UserNode extends Node {
    constructor(id, x, y, capacity, userSpeed, assignedNode = null, predictedPath = []) {
        super(id, x, y, capacity, 0, 0);
        this.type = 'user';
        this.userSpeed = userSpeed;
        this.velocity = {
            x: (Math.random() - 0.5) * userSpeed, // Random velocity in x direction
            y: (Math.random() - 0.5) * userSpeed  // Random velocity in y direction
        }
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