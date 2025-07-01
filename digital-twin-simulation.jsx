"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Settings } from "lucide-react";
import ControlPanel from "@/components/simulation/ControlPanel";
import MetricsPanel from "@/components/simulation/MetricsPanel";
import SimulationCanvas from "@/components/simulation/SimulationCanvas";
import EditModeDescription from "@/components/simulation/EditModeDescription";
import ControlPanelContent from "@/components/simulation/ControlPanelContent";
import MetricsPanelContent from "@/components/simulation/MetricsPanelContent";
import { calculateDistance, findNearestNode, getAllNodes } from "@/lib/helper";
import { CentralNode, EdgeNode, UserNode } from "./lib/components";

export default function Component() {
  const canvasRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [edgeNodes, setEdgeNodes] = useState([]);

  // Central nodes - main servers/coordinators
  const [centralNodes, setCentralNodes] = useState([]);
  const [graph, setGraph] = useState(new Map()); // adjacency list for graph representation

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState([1]);
  const [predictionEnabled, setPredictionEnabled] = useState(true);
  const [totalLatency, setTotalLatency] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // UI State
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("linear");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [selectedCentral, setSelectedCentral] = useState(null);

  // User settings
  const [userSpeed, setUserSpeed] = useState([2]);
  const [userSize, setUserSize] = useState([8]);
  const [predictionSteps, setPredictionSteps] = useState([10]);

  // Edge settings
  const [edgeCapacity, setEdgeCapacity] = useState([100]);
  const [edgeCoverage, setEdgeCoverage] = useState([0]);

  // Central node settings
  const [centralCapacity, setCentralCapacity] = useState([500]);
  const [centralCoverage, setCentralCoverage] = useState([0]);

  // Zoom and Pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Edit mode states
  const [editMode, setEditMode] = useState("none"); // "none", "nodes", "users", "both"
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [isDraggingUser, setIsDraggingUser] = useState(false);
  const [draggedNode, setDraggedNode] = useState(null);
  const [draggedUser, setDraggedUser] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Manual connection state
  const [manualConnectionMode, setManualConnectionMode] = useState(false);
  const [autoAssignment, setAutoAssignment] = useState(true);

  // Algorithms for user expectancy calculation
  const algorithms = {
    linear: "Linear Prediction",
    // kalman: "Kalman Filter",
    // markov: "Markov Chain",
    // neural: "Neural Network",
    // gravity: "Gravity Model",
  };

  // Calculate distance between two points
  const calculateDistance = (x1, y1, x2, y2) => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  // Find nearest edge node to a user
  const findNearestEdge = (user) => {
    if (edgeNodes.length === 0) return null;
    return edgeNodes.reduce((nearest, edge) => {
      const distanceToEdge = calculateDistance(user.x, user.y, edge.x, edge.y);
      const distanceToNearest = calculateDistance(
        user.x,
        user.y,
        nearest.x,
        nearest.y
      );
      return distanceToEdge < distanceToNearest ? edge : nearest;
    });
  };

  // Find nearest central node to a user
  const findNearestCentral = (user) => {
    if (centralNodes.length === 0) return null;
    return centralNodes.reduce((nearest, central) => {
      const distanceToCentral = calculateDistance(
        user.x,
        user.y,
        central.x,
        central.y
      );
      const distanceToNearest = nearest
        ? calculateDistance(user.x, user.y, nearest.x, nearest.y)
        : Number.POSITIVE_INFINITY;
      return distanceToCentral < distanceToNearest ? central : nearest;
    });
  };

  // Get all available nodes for connection
  const getAllNodes = () => {
    return [
      ...edgeNodes.map((node) => ({ ...node, type: "edge" })),
      ...centralNodes.map((node) => ({ ...node, type: "central" })),
    ];
  };

  // Calculate latency based on connection using experimental formula
  const calculateLatency = (user, nodeId, nodeType) => {
    let targetNode = null;
    if (nodeType === "edge") {
      targetNode = edgeNodes.find((edge) => edge.id === nodeId);
    } else if (nodeType === "central") {
      targetNode = centralNodes.find((central) => central.id === nodeId);
    }

    if (!targetNode) return 120; // FIXED fallback latency

    // REALISTIC - Random data size for different requests
    const dataSize = 100 + Math.random() * 400; // 100-500 MB random
    
    // Calculate PHYSICAL DISTANCE between user and target node
    const physicalDistance = calculateDistance(user.x, user.y, targetNode.x, targetNode.y);
    
    // Determine if it's Cold Start or Warm Start
    const isWarmStart = targetNode.isWarm || false; // I_{u,v,t}
    const coldStartIndicator = isWarmStart ? 1 : 0;
    
    // Calculate Communication Delay: d_com = distance × baseRate × dataSize
    let baseTransmissionRate; // Base rate per pixel distance (ms/MB/pixel)
    if (nodeType === "edge") {
      // Edge nodes: Lower base rate (shorter network path)
      baseTransmissionRate = 0.002; // 0.002 ms/MB/pixel
    } else {
      // Central nodes: Higher base rate (longer network path to cloud)
      baseTransmissionRate = 0.008; // 0.008 ms/MB/pixel (4x higher)
    }
    
    // Total transmission delay = distance × baseRate × dataSize
    const communicationDelay = physicalDistance * baseTransmissionRate * dataSize;
    
    // Calculate Processing Delay: d_proc = (1 - I_{u,v,t}) × d_cold + s(u,t) × ρ_{u,v}
    
    // FIXED cold start delay (independent of distance)
    const coldStartDelay = 200; // Fixed 200ms cold start penalty
    
    // Unit processing time ρ_{u,v} (ms/MB) - EQUAL PROCESSING POWER
    let unitProcessingTime;
    if (nodeType === "edge") {
      // Edge: Equal processing power
      unitProcessingTime = 0.5; // 0.5 ms/MB
    } else {
      // Central: Equal processing power (no longer more powerful)
      unitProcessingTime = 0.5; // 0.5 ms/MB (same as edge)
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
        physicalDistance: Math.round(physicalDistance),
        communicationDelay: Math.round(communicationDelay),
        processingDelay: Math.round(processingDelay),
        isWarmStart: isWarmStart,
        baseTransmissionRate: baseTransmissionRate.toFixed(3),
        unitProcessingTime: unitProcessingTime.toFixed(2)
      };
    }
    
    return Math.round(totalLatency);
  };

  // Manually connect user to a specific node
  const connectUserToNode = (userId, nodeId, nodeType) => {
    const allNodes = getAllNodes(edgeNodes, centralNodes);
    setUsers((prevUsers) =>
      prevUsers.map((user) => {
        if (user.id === userId) {
          const latency = calculateLatency(user, nodeId, allNodes);
          return {
            ...user,
            assignedEdge: nodeType === "edge" ? nodeId : null,
            assignedCentral: nodeType === "central" ? nodeId : null,
            manualConnection: true,
            latency,
          };
        }
        return user;
      })
    );
  };

  // Disconnect user from all nodes
  const disconnectUser = (userId) => {
    setUsers((prevUsers) => {
      const newUsers = [];
      for (let i = 0; i < prevUsers.length; i++) {
        const user = prevUsers[i];
        if (user.id === userId) {
          newUsers.push({
            ...user,
            assignedEdge: null,
            assignedCentral: null,
            manualConnection: false,
            latency: 500, // FIXED high latency when disconnected
          });
        } else {
          newUsers.push(user);
        }
      }
      return newUsers;
    });
  };

  // Reset all manual connections
  const resetAllConnections = () => {
    setUsers((prevUsers) => {
      const newUsers = [];
      for (let i = 0; i < prevUsers.length; i++) {
        newUsers.push({ ...prevUsers[i], manualConnection: false });
      }
      return newUsers;
    });
  };

  // Update selected user properties
  const updateSelectedUser = (updates) => {
    if (!selectedUser) return;
    setUsers((prevUsers) => {
      const newUsers = [];
      for (let i = 0; i < prevUsers.length; i++) {
        const user = prevUsers[i];
        if (user.id === selectedUser.id) {
          newUsers.push({ ...user, ...updates });
        } else {
          newUsers.push(user);
        }
      }
      return newUsers;
    });
    setSelectedUser((prev) => ({ ...prev, ...updates }));
  };

  // Delete selected user
  const deleteSelectedUser = () => {
    if (!selectedUser) return;
    setUsers((prevUsers) => {
      const newUsers = [];
      for (let i = 0; i < prevUsers.length; i++) {
        if (prevUsers[i].id !== selectedUser.id) {
          newUsers.push(prevUsers[i]);
        }
      }
      return newUsers;
    });
    setSelectedUser(null);
  };

  // Different prediction algorithms
  const predictUserMobility = (user) => {
    const predictions = [];
    let currentX = user.x;
    let currentY = user.y;

    switch (selectedAlgorithm) {
      case "linear":
        for (let i = 1; i <= predictionSteps[0]; i++) {
          currentX += user.vx * i * 2;
          currentY += user.vy * i * 2;
          currentX = Math.max(10, Math.min(window.innerWidth - 10, currentX));
          currentY = Math.max(10, Math.min(window.innerHeight - 10, currentY));
          predictions.push({ x: currentX, y: currentY });
        }
        break;

      case "kalman":
        // STABLE Kalman Filter - no random noise for single digital twin
        for (let i = 1; i <= predictionSteps[0]; i++) {
          currentX += user.vx * i * 2; // Remove random noise component
          currentY += user.vy * i * 2; // Remove random noise component
          currentX = Math.max(10, Math.min(window.innerWidth - 10, currentX));
          currentY = Math.max(10, Math.min(window.innerHeight - 10, currentY));
          predictions.push({ x: currentX, y: currentY });
        }
        break;

      case "markov":
        // STABLE Markov Chain - deterministic for single digital twin
        for (let i = 1; i <= predictionSteps[0]; i++) {
          // Use deterministic pattern instead of random state changes
          const stateChange = (i % 3 === 0) ? 0.8 : 0.6; // Predictable pattern
          if (stateChange < 0.7) {
            currentX += user.vx * 2;
            currentY += user.vy * 2;
          } else {
            // Use small deterministic offset instead of random
            currentX += user.vx * 0.5;
            currentY += user.vy * 0.5;
          }
          currentX = Math.max(10, Math.min(window.innerWidth - 10, currentX));
          currentY = Math.max(10, Math.min(window.innerHeight - 10, currentY));
          predictions.push({ x: currentX, y: currentY });
        }
        break;

      case "neural":
        for (let i = 1; i <= predictionSteps[0]; i++) {
          const weight1 = 0.8,
            weight2 = 0.6,
            bias = 0.1;
          currentX += (user.vx * weight1 + user.vy * weight2 + bias) * 2;
          currentY += (user.vy * weight1 + user.vx * weight2 + bias) * 2;
          currentX = Math.max(10, Math.min(window.innerWidth - 10, currentX));
          currentY = Math.max(10, Math.min(window.innerHeight - 10, currentY));
          predictions.push({ x: currentX, y: currentY });
        }
        break;

      case "gravity":
        for (let i = 1; i <= predictionSteps[0]; i++) {
          let forceX = 0,
            forceY = 0;
          // Attraction to edge nodes
          edgeNodes.forEach((edge) => {
            const distance = calculateDistance(
              currentX,
              currentY,
              edge.x,
              edge.y
            );
            const force = 100 / (distance + 1);
            forceX += (edge.x - currentX) * force * 0.001;
            forceY += (edge.y - currentY) * force * 0.001;
          });
          // Stronger attraction to central nodes
          centralNodes.forEach((central) => {
            const distance = calculateDistance(
              currentX,
              currentY,
              central.x,
              central.y
            );
            const force = 200 / (distance + 1);
            forceX += (central.x - currentX) * force * 0.001;
            forceY += (central.y - currentY) * force * 0.001;
          });
          currentX += user.vx * 2 + forceX;
          currentY += user.vy * 2 + forceY;
          currentX = Math.max(10, Math.min(window.innerWidth - 10, currentX));
          currentY = Math.max(10, Math.min(window.innerHeight - 10, currentY));
          predictions.push({ x: currentX, y: currentY });
        }
        break;

      default:
        return predictions;
    }

    return predictions;
  };

  // Optimize replica placement based on predictions
  const optimizeReplicaPlacement = useCallback(() => {
    if (!predictionEnabled) return;

    const updatedUsers = users.map((user) => {
      const predictedPath = predictUserMobility(user);

      // Skip automatic assignment if user has manual connection
      if (user.manualConnection || !autoAssignment) {
        return {
          ...user,
          predictedPath,
        };
      }

      // Get ALL nodes and calculate distance-weighted scores
      const allCandidates = [];
      
             // Add edge node candidates
       edgeNodes.forEach(edge => {
                  const distance = calculateDistance(user.x, user.y, edge.x, edge.y);
         const latency = calculateLatency(user, edge.id, "edge");
         const stabilityBonus = (user.assignedEdge === edge.id) ? 100 : 0; // Increased from 20 to 100
         
          // Since distance is now built into latency calculation, reduce additional penalty
          const distancePenalty = distance * 0.5;
          
          // Smaller proximity bonus since distance is already factored in
          const proximityBonus = distance < 100 ? (100 - distance) * 1 : 0;
          
          const totalScore = latency + distancePenalty - stabilityBonus - proximityBonus;
         
         allCandidates.push({
           id: edge.id,
           type: "edge",
           distance: distance,
           latency: latency,
           totalScore: totalScore,
           node: edge
         });
       });
       
       // Add central node candidates  
       centralNodes.forEach(central => {
                  const distance = calculateDistance(user.x, user.y, central.x, central.y);
         const latency = calculateLatency(user, central.id, "central");
         const stabilityBonus = (user.assignedCentral === central.id) ? 100 : 0; // Increased from 20 to 100
         
          // Since distance is now built into latency calculation, reduce additional penalty
          const distancePenalty = distance * 0.5;
          
          // Smaller proximity bonus since distance is already factored in
          const proximityBonus = distance < 150 ? (150 - distance) * 2 : 0;
          
          const totalScore = latency + distancePenalty - stabilityBonus - proximityBonus;
         
         allCandidates.push({
           id: central.id,
           type: "central", 
           distance: distance,
           latency: latency,
           totalScore: totalScore,
           node: central
         });
       });

      // Find best candidate based on total score (latency + distance penalty)
      let bestCandidate = null;
      let bestScore = Number.POSITIVE_INFINITY;
      let currentCandidate = null;
      
      // Find current connection
      allCandidates.forEach(candidate => {
        if ((candidate.type === "edge" && user.assignedEdge === candidate.id) ||
            (candidate.type === "central" && user.assignedCentral === candidate.id)) {
          currentCandidate = candidate;
        }
      });
      
      allCandidates.forEach(candidate => {
        if (candidate.totalScore < bestScore) {
          bestScore = candidate.totalScore;
          bestCandidate = candidate;
        }
      });
      
      // SWITCHING THRESHOLD: Only switch if new candidate is significantly better
      const switchingThreshold = 50; // 50ms improvement required to switch
      if (currentCandidate && bestCandidate && 
          (currentCandidate.totalScore - bestCandidate.totalScore) < switchingThreshold) {
        // Current connection is "good enough", don't switch
        bestCandidate = currentCandidate;
        bestScore = currentCandidate.totalScore;
      }

      let assignedEdge = null;
      let assignedCentral = null;
      let bestLatency = Number.POSITIVE_INFINITY;
      
      if (bestCandidate) {
        if (bestCandidate.type === "edge") {
          assignedEdge = bestCandidate.id;
          assignedCentral = null;
        } else {
          assignedEdge = null;
          assignedCentral = bestCandidate.id;
        }
        bestLatency = bestCandidate.latency;
      }

      // If no nodes available, set FIXED high latency
      const latency = bestLatency === Number.POSITIVE_INFINITY
        ? 500 // FIXED high latency when no nodes available
        : bestLatency;

      return {
        ...user,
        predictedPath,
        assignedEdge,
        assignedCentral,
        latency,
      };
    });

    setUsers(updatedUsers);

    const avgLatency =
      updatedUsers.reduce((sum, user) => sum + user.latency, 0) /
        updatedUsers.length || 0;
    setTotalLatency(Math.round(avgLatency));

    // Update edge node loads
    const updatedEdges = edgeNodes.map((edge) => {
      const assignedUsers = updatedUsers.filter(
        (user) => user.assignedEdge === edge.id
      );
      const load = (assignedUsers.length / (edge.capacity / 10)) * 100;
      return { ...edge, currentLoad: Math.min(100, load) };
    });
    setEdgeNodes(updatedEdges);

    // Update central node loads
    const updatedCentrals = centralNodes.map((central) => {
      const assignedUsers = updatedUsers.filter(
        (user) => user.assignedCentral === central.id
      );
      const load = (assignedUsers.length / (central.capacity / 10)) * 100;
      return { ...central, currentLoad: Math.min(100, load) };
    });
    setCentralNodes(updatedCentrals);
  }, [
    users,
    edgeNodes,
    centralNodes,
    predictionEnabled,
    selectedAlgorithm,
    predictionSteps,
    autoAssignment,
  ]);

  // Create refs for state to avoid re-render loops
  const stateRef = useRef();
  stateRef.current = {
    users,
    edgeNodes,
    centralNodes,
    selectedUser,
    selectedEdge,
    selectedCentral,
    predictionEnabled,
    userSize: userSize[0],
    zoomLevel,
    panOffset
  };

  // Canvas drawing function with minimal dependencies - moved before animation useEffect
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Apply transformations
    ctx.save();
    ctx.translate(state.panOffset.x, state.panOffset.y);
    ctx.scale(state.zoomLevel, state.zoomLevel);

    // Clear canvas
    ctx.clearRect(-state.panOffset.x / state.zoomLevel, -state.panOffset.y / state.zoomLevel, 
                  canvas.width / state.zoomLevel, canvas.height / state.zoomLevel);

    // Draw grid background
    const gridSize = 50; // Size of each grid cell
    const startX = Math.floor(-state.panOffset.x / state.zoomLevel / gridSize) * gridSize;
    const startY = Math.floor(-state.panOffset.y / state.zoomLevel / gridSize) * gridSize;
    const endX = startX + (canvas.width / state.zoomLevel) + gridSize;
    const endY = startY + (canvas.height / state.zoomLevel) + gridSize;

    ctx.strokeStyle = "#e5e7eb"; // Light gray grid lines
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;

    // Draw vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1; // Reset opacity

    // Draw connections first (behind everything)
    state.users.forEach((user) => {
      if (user.assignedEdge) {
        const edgeNode = state.edgeNodes.find(edge => edge.id === user.assignedEdge);
        if (edgeNode) {
      ctx.beginPath();
          ctx.moveTo(user.x, user.y);
          ctx.lineTo(edgeNode.x, edgeNode.y);
          ctx.strokeStyle = user.manualConnection ? "#f97316" : "#3b82f6";
          ctx.lineWidth = 2;
      ctx.stroke();
    }
      }
      if (user.assignedCentral) {
        const centralNode = state.centralNodes.find(central => central.id === user.assignedCentral);
        if (centralNode) {
        ctx.beginPath();
          ctx.moveTo(user.x, user.y);
          ctx.lineTo(centralNode.x, centralNode.y);
          ctx.strokeStyle = user.manualConnection ? "#f97316" : "#6b7280";
          ctx.lineWidth = 2;
        ctx.stroke();
        }
      }
    });

    // Draw predicted paths
    if (state.predictionEnabled) {
      state.users.forEach((user) => {
        if (user.predictedPath && user.predictedPath.length > 0) {
        ctx.beginPath();
          ctx.moveTo(user.x, user.y);
          user.predictedPath.forEach((point, index) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.strokeStyle = "#a855f7";
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      });
    }

    // Draw edge nodes
    state.edgeNodes.forEach((edge) => {
      const isSelected = state.selectedEdge && state.selectedEdge.id === edge.id;
      
      // Node circle
      ctx.beginPath();
      ctx.arc(edge.x, edge.y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? "#16a34a" : "#22c55e";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#15803d" : "#16a34a";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Warm indicator
      if (edge.isWarm) {
      ctx.beginPath();
        ctx.arc(edge.x + 10, edge.y - 10, 3, 0, 2 * Math.PI);
        ctx.fillStyle = "#10b981";
      ctx.fill();
      }

      // Label
      ctx.fillStyle = "#000";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(edge.id, edge.x, edge.y - 20);
    });

    // Draw central nodes
    state.centralNodes.forEach((central) => {
      const isSelected = state.selectedCentral && state.selectedCentral.id === central.id;
      
      // Node square
      ctx.fillStyle = isSelected ? "#2563eb" : "#3b82f6";
      ctx.fillRect(central.x - 12, central.y - 12, 24, 24);
      ctx.strokeStyle = isSelected ? "#1d4ed8" : "#2563eb";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(central.x - 12, central.y - 12, 24, 24);

      // Warm indicator
      if (central.isWarm) {
      ctx.beginPath();
        ctx.arc(central.x + 10, central.y - 10, 3, 0, 2 * Math.PI);
        ctx.fillStyle = "#10b981";
      ctx.fill();
      }

      // Label
      ctx.fillStyle = "#000";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(central.id, central.x, central.y - 20);
    });

    // Draw users
    state.users.forEach((user) => {
      const isSelected = state.selectedUser && state.selectedUser.id === user.id;
      
      // User circle
        ctx.beginPath();
      ctx.arc(user.x, user.y, state.userSize, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? "#dc2626" : user.manualConnection ? "#f97316" : "#ef4444";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#b91c1c" : "#dc2626";
      ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();

      // Label
      ctx.fillStyle = "#000";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(user.id, user.x, user.y + state.userSize + 12);
    });

    ctx.restore();
  }, []); // Empty dependency array to prevent re-creation

  // Animation loop - Fixed to prevent continuous restarts
  useEffect(() => {
    const interval = setInterval(() => {
      // Call functions directly to get latest state
      if (isSimulating) {
    setUsers((prevUsers) =>
      prevUsers.map((user) => {
        let newX = user.x + user.vx * simulationSpeed[0];
        let newY = user.y + user.vy * simulationSpeed[0];
        let newVx = user.vx;
        let newVy = user.vy;

        if (newX <= 10 || newX >= window.innerWidth - 10) {
          newVx = -newVx;
          newX = Math.max(10, Math.min(window.innerWidth - 10, newX));
        }
        if (newY <= 10 || newY >= window.innerHeight - 10) {
          newVy = -newVy;
          newY = Math.max(10, Math.min(window.innerHeight - 10, newY));
        }

        return { ...user, x: newX, y: newY, vx: newVx, vy: newVy };
      })
    );
        
        // Trigger optimization during simulation
        setTimeout(() => optimizeReplicaPlacement(), 10);
      }
      
      // Trigger canvas redraw
      draw();
    }, 100);

    return () => clearInterval(interval);
  }, [isSimulating, simulationSpeed, draw, optimizeReplicaPlacement]);



  // Container timeout management - reset warm state after 30 seconds of inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const timeoutDuration = 30000; // 30 seconds

      // Reset warm state for edge nodes
      setEdgeNodes(prev => prev.map(edge => {
        if (edge.isWarm && edge.lastAccessTime && 
            (currentTime - edge.lastAccessTime) > timeoutDuration) {
          return { ...edge, isWarm: false, lastAccessTime: null };
        }
        return edge;
      }));

      // Reset warm state for central nodes
      setCentralNodes(prev => prev.map(central => {
        if (central.isWarm && central.lastAccessTime && 
            (currentTime - central.lastAccessTime) > timeoutDuration) {
          return { ...central, isWarm: false, lastAccessTime: null };
        }
        return central;
      }));
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);



  // Find nearest node helper function
  const findNearestNode = (nodes, user) => {
    if (nodes.length === 0) return null;
    return nodes.reduce((nearest, node) => {
      const distanceToNode = calculateDistance(user.x, user.y, node.x, node.y);
      const distanceToNearest = nearest
        ? calculateDistance(user.x, user.y, nearest.x, nearest.y)
        : Number.POSITIVE_INFINITY;
      return distanceToNode < distanceToNearest ? node : nearest;
    });
  };

  // Zoom functions
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(3, prev + 0.2));
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(0.5, prev - 0.2));
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // useEffect hooks for drawing - placed after draw function definition
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  // Trigger draw when state changes
  useEffect(() => {
    draw();
  }, [users, edgeNodes, centralNodes, selectedUser, selectedEdge, selectedCentral, 
      predictionEnabled, userSize, zoomLevel, panOffset, draw]);



  // Canvas event handlers
  const handleCanvasClick = (e) => {
    if (isDraggingNode || isDraggingUser || isPanning) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoomLevel;
    const y = (e.clientY - rect.top - panOffset.y) / zoomLevel;

    // Check if clicking on existing elements first
    let clickedSomething = false;

    // Check users
    for (const user of users) {
      const distance = calculateDistance(x, y, user.x, user.y);
      if (distance <= userSize[0]) {
        setSelectedUser(selectedUser && selectedUser.id === user.id ? null : user);
        setSelectedEdge(null);
        setSelectedCentral(null);
        clickedSomething = true;
        break;
      }
    }

    // Check edge nodes
    if (!clickedSomething) {
      for (const edge of edgeNodes) {
        const distance = calculateDistance(x, y, edge.x, edge.y);
        if (distance <= 15) {
          setSelectedEdge(selectedEdge && selectedEdge.id === edge.id ? null : edge);
          setSelectedUser(null);
          setSelectedCentral(null);
          clickedSomething = true;
          break;
        }
      }
    }

    // Check central nodes
    if (!clickedSomething) {
      for (const central of centralNodes) {
        if (x >= central.x - 12 && x <= central.x + 12 && 
            y >= central.y - 12 && y <= central.y + 12) {
          setSelectedCentral(selectedCentral && selectedCentral.id === central.id ? null : central);
          setSelectedUser(null);
          setSelectedEdge(null);
          clickedSomething = true;
          break;
        }
      }
    }

    // If nothing was clicked and we're not in edit mode, add a new user
    if (!clickedSomething && editMode === "none") {
      const newUser = {
        id: `user-${users.length + 1}`,
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * userSpeed[0],
        vy: (Math.random() - 0.5) * userSpeed[0],
        assignedEdge: null,
        assignedCentral: null,
        manualConnection: false,
        latency: 500, // FIXED initial latency for new users
        predictedPath: [],
      };
      setUsers(prev => [...prev, newUser]);
    }

    // Clear selections if clicking empty space
    if (!clickedSomething && editMode !== "none") {
      setSelectedUser(null);
      setSelectedEdge(null);
      setSelectedCentral(null);
    }
  };

  const handleMouseDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoomLevel;
    const y = (e.clientY - rect.top - panOffset.y) / zoomLevel;

    // Check for draggable elements
    if (editMode === "users" || editMode === "both") {
      for (const user of users) {
        const distance = calculateDistance(x, y, user.x, user.y);
        if (distance <= userSize[0]) {
          setIsDraggingUser(true);
          setDraggedUser(user);
          setDragOffset({ x: x - user.x, y: y - user.y });
          return;
        }
      }
    }

    if (editMode === "nodes" || editMode === "both") {
      // Check edge nodes
      for (const edge of edgeNodes) {
        const distance = calculateDistance(x, y, edge.x, edge.y);
        if (distance <= 15) {
          setIsDraggingNode(true);
          setDraggedNode({ ...edge, type: "edge" });
          setDragOffset({ x: x - edge.x, y: y - edge.y });
          return;
        }
      }

      // Check central nodes
      for (const central of centralNodes) {
        if (x >= central.x - 12 && x <= central.x + 12 && 
            y >= central.y - 12 && y <= central.y + 12) {
          setIsDraggingNode(true);
          setDraggedNode({ ...central, type: "central" });
          setDragOffset({ x: x - central.x, y: y - central.y });
          return;
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setPanOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoomLevel;
    const y = (e.clientY - rect.top - panOffset.y) / zoomLevel;

    if (isDraggingUser && draggedUser) {
      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;
      
      setUsers(prev => prev.map(user => 
        user.id === draggedUser.id 
          ? { ...user, x: Math.max(10, Math.min(window.innerWidth - 10, newX)), 
                       y: Math.max(10, Math.min(window.innerHeight - 10, newY)) }
          : user
      ));
    }

    if (isDraggingNode && draggedNode) {
      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;
      
      if (draggedNode.type === "edge") {
        setEdgeNodes(prev => prev.map(edge => 
          edge.id === draggedNode.id 
            ? { ...edge, x: Math.max(10, Math.min(window.innerWidth - 10, newX)), 
                         y: Math.max(10, Math.min(window.innerHeight - 10, newY)) }
            : edge
        ));
      } else if (draggedNode.type === "central") {
        setCentralNodes(prev => prev.map(central => 
          central.id === draggedNode.id 
            ? { ...central, x: Math.max(10, Math.min(window.innerWidth - 10, newX)), 
                           y: Math.max(10, Math.min(window.innerHeight - 10, newY)) }
            : central
        ));
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingUser(false);
    setIsDraggingNode(false);
    setDraggedUser(null);
    setDraggedNode(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // Simulation step function
  const simulationStep = () => {
    if (isSimulating) {
      optimizeReplicaPlacement();
    }
  };

  const resetSimulation = () => {
    clearEverything();
  };

  const addEdgeNode = () => {
    const newEdge = {
      id: `edge-${edgeNodes.length + 1}`,
      x: Math.random() * (window.innerWidth - 200) + 100,
      y: Math.random() * (window.innerHeight - 200) + 100,
      capacity: edgeCapacity[0],
      currentLoad: 0,
      replicas: [],
      coverage: edgeCoverage[0],
      isWarm: false,
      lastAccessTime: null,
      lastMetrics: null,
      type: "cloudlet"
    };
    setEdgeNodes((prev) => [...prev, newEdge]);
  };

  const removeEdgeNode = () => {
    if (edgeNodes.length > 0) {
      const nodeToRemove = edgeNodes[edgeNodes.length - 1];
      setEdgeNodes((prev) => prev.slice(0, -1));
      if (selectedEdge && selectedEdge.id === nodeToRemove.id) {
        setSelectedEdge(null);
      }
    }
  };

  const addCentralNode = () => {
    const newCentral = {
      id: `central-${centralNodes.length + 1}`,
      x: Math.random() * (window.innerWidth - 400) + 200,
      y: Math.random() * (window.innerHeight - 400) + 200,
      capacity: centralCapacity[0],
      currentLoad: 0,
      coverage: centralCoverage[0],
      type: "main",
      isWarm: false,
      lastAccessTime: null,
      lastMetrics: null,
      nodeType: "cloud"
    };
    setCentralNodes((prev) => [...prev, newCentral]);
  };

  const removeCentralNode = () => {
    if (centralNodes.length > 0) {
      setCentralNodes((prev) => prev.slice(0, -1));
      if (
        selectedCentral &&
        selectedCentral.id === `central-${centralNodes.length}`
      ) {
        setSelectedCentral(null);
      }
    }
  };

  const deleteSelectedNode = () => {
    if (selectedEdge) {
      setEdgeNodes((prev) =>
        prev.filter((edge) => edge.id !== selectedEdge.id)
      );
      setSelectedEdge(null);
    }
    if (selectedCentral) {
      setCentralNodes((prev) =>
        prev.filter((central) => central.id !== selectedCentral.id)
      );
      setSelectedCentral(null);
    }
  };

  const clearAllUsers = () => {
    setUsers([]);
    setSelectedUser(null);
  };

  const clearAllEdgeNodes = () => {
    setEdgeNodes([]);
    setSelectedEdge(null);
  };

  const clearAllCentralNodes = () => {
    setCentralNodes([]);
    setSelectedCentral(null);
  };

  const clearEverything = () => {
    setUsers([]);
    setEdgeNodes([]);
    setCentralNodes([]);
    setSelectedUser(null);
    setSelectedEdge(null);
    setSelectedCentral(null);
    setIsSimulating(false);
    setTotalLatency(0);
  };

  const getEditModeDescription = () => {
    switch (editMode) {
      case "nodes":
        return "Node Edit: Drag nodes to move • Click to select";
      case "users":
        return "User Edit: Drag users to move • Click to select";
      case "both":
        return "Full Edit: Drag nodes and users • Click to select";
      default:
        return "Click to add users • Mouse wheel to zoom • Ctrl+drag to pan the map";
    }
  };

  const getCursorStyle = () => {
    if (isPanning) return "grabbing";
    if (isDraggingNode || isDraggingUser) return "grabbing";
    if (editMode !== "none") return "move";
    return "crosshair";
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50">
      {/* Full Screen Canvas */}
      <SimulationCanvas
        canvasRef={canvasRef}
        handleCanvasClick={handleCanvasClick}
        handleMouseDown={handleMouseDown}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        handleWheel={handleWheel}
        getCursorStyle={getCursorStyle}
      />

      {/* Left Control Panel */}
      <ControlPanel leftPanelOpen={leftPanelOpen}>
        <ControlPanelContent
          users={users}
          setUsers={setUsers}
          edgeNodes={edgeNodes}
          setEdgeNodes={setEdgeNodes}
          centralNodes={centralNodes}
          setCentralNodes={setCentralNodes}
          isSimulating={isSimulating}
          setIsSimulating={setIsSimulating}
          simulationSpeed={simulationSpeed}
          setSimulationSpeed={setSimulationSpeed}
          predictionEnabled={predictionEnabled}
          setPredictionEnabled={setPredictionEnabled}
          totalLatency={totalLatency}
          setTotalLatency={setTotalLatency}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          leftPanelOpen={leftPanelOpen}
          setLeftPanelOpen={setLeftPanelOpen}
          rightPanelOpen={rightPanelOpen}
          setRightPanelOpen={setRightPanelOpen}
          selectedAlgorithm={selectedAlgorithm}
          setSelectedAlgorithm={setSelectedAlgorithm}
          selectedUser={selectedUser}
          setSelectedUser={setSelectedUser}
          selectedEdge={selectedEdge}
          setSelectedEdge={setSelectedEdge}
          selectedCentral={selectedCentral}
          setSelectedCentral={setSelectedCentral}
          userSpeed={userSpeed}
          setUserSpeed={setUserSpeed}
          userSize={userSize}
          setUserSize={setUserSize}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          resetZoom={resetZoom}
          predictionSteps={predictionSteps}
          setPredictionSteps={setPredictionSteps}
          edgeCapacity={edgeCapacity}
          setEdgeCapacity={setEdgeCapacity}
          edgeCoverage={edgeCoverage}
          setEdgeCoverage={setEdgeCoverage}
          centralCapacity={centralCapacity}
          setCentralCapacity={setCentralCapacity}
          centralCoverage={centralCoverage}
          setCentralCoverage={setCentralCoverage}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          panOffset={panOffset}
          setPanOffset={setPanOffset}
          isPanning={isPanning}
          setIsPanning={setIsPanning}
          lastPanPoint={lastPanPoint}
          setLastPanPoint={setLastPanPoint}
          editMode={editMode}
          setEditMode={setEditMode}
          isDraggingNode={isDraggingNode}
          setIsDraggingNode={setIsDraggingNode}
          isDraggingUser={isDraggingUser}
          setIsDraggingUser={setIsDraggingUser}
          draggedNode={draggedNode}
          setDraggedNode={setDraggedNode}
          draggedUser={draggedUser}
          setDraggedUser={setDraggedUser}
          dragOffset={dragOffset}
          setDragOffset={setDragOffset}
          manualConnectionMode={manualConnectionMode}
          setManualConnectionMode={setManualConnectionMode}
          autoAssignment={autoAssignment}
          setAutoAssignment={setAutoAssignment}
          algorithms={algorithms}
          calculateDistance={calculateDistance}
          connectUserToNode={connectUserToNode}
          disconnectUser={disconnectUser}
          resetAllConnections={resetAllConnections}
          updateSelectedUser={updateSelectedUser}
          deleteSelectedUser={deleteSelectedUser}
          predictUserMobility={predictUserMobility}
          optimizeReplicaPlacement={optimizeReplicaPlacement}
          simulationStep={simulationStep}
          handleCanvasClick={handleCanvasClick}
          handleMouseDown={handleMouseDown}
          handleMouseMove={handleMouseMove}
          handleMouseUp={handleMouseUp}
          handleWheel={handleWheel}
          draw={draw}
          resetSimulation={resetSimulation}
          addEdgeNode={addEdgeNode}
          removeEdgeNode={removeEdgeNode}
          addCentralNode={addCentralNode}
          removeCentralNode={removeCentralNode}
          deleteSelectedNode={deleteSelectedNode}
          clearAllUsers={clearAllUsers}
          clearAllEdgeNodes={clearAllEdgeNodes}
          clearAllCentralNodes={clearAllCentralNodes}
          clearEverything={clearEverything}
          getEditModeDescription={getEditModeDescription}
          getCursorStyle={getCursorStyle}
        />
      </ControlPanel>

      {/* Right Metrics Panel */}
      <MetricsPanel rightPanelOpen={rightPanelOpen}>
        <MetricsPanelContent
          users={users}
          edgeNodes={edgeNodes}
          centralNodes={centralNodes}
          totalLatency={totalLatency}
          selectedUser={selectedUser}
          setSelectedUser={setSelectedUser}
          selectedEdge={selectedEdge}
          setSelectedEdge={setSelectedEdge}
          selectedCentral={selectedCentral}
          setSelectedCentral={setSelectedCentral}
          algorithms={algorithms}
          selectedAlgorithm={selectedAlgorithm}
          rightPanelOpen={rightPanelOpen}
          setRightPanelOpen={setRightPanelOpen}
        />
      </MetricsPanel>

      {/* Toggle Buttons for Panels */}
      {!leftPanelOpen && (
        <Button
          className="absolute left-4 top-4 z-20"
          size="sm"
          onClick={() => setLeftPanelOpen(true)}
        >
          <Settings className="w-4 h-4" />
        </Button>
      )}
      {!rightPanelOpen && (
        <Button
          className="absolute right-4 top-4 z-20"
          size="sm"
          onClick={() => setRightPanelOpen(true)}
        >
          <MapPin className="w-4 h-4" />
        </Button>
      )}

      {/* Instructions */}
      <EditModeDescription description={getEditModeDescription()} />
    </div>
  );
}
