"use client";

import React, { useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'react-flow-renderer';
import { VersionNode } from '@/lib/types';

interface DagGraphProps {
  versions: VersionNode[];
  edges: { source: string; target: string }[];
  onNodeClick: (nodeId: string) => void;
  selectedNodeId?: string;
}

export default function DagGraph({ versions, edges, onNodeClick, selectedNodeId }: DagGraphProps) {
  // Convert API nodes/edges to ReactFlow format
  // We need to layout the graph. Simulating a basic layout by timestamp? or simple layers?
  // Since we don't have dagre installed, we'll do a primitive time-based layout manually.
  
  const sortedVersions = [...versions].sort((a, b) => a.timestamp - b.timestamp);
  
  // Assign layers based on graph depth? Or just simple x = time, y = random/hash to spread?
  // Let's try to infer depth.
  const depthMap = new Map<string, number>();
  
  // Iterate strictly by timestamp to ensure parents usually resolve first
  // However, iterating topologically is safer.
  // 1. Find roots
  // 2. BFS down
  const getParents = (id: string) => versions.find(v => v.id === id)?.parentIds || [];
  
  // Calculate specific positions
  const nodes: Node[] = versions.map((v, index) => {
    // Simple visual placement:
    // X axis: Time/Index
    // Y axis: Branch diversification?
    // This is hard to do perfectly without a layout engine.
    // Random spreading for branches:
    
    // Primitive Approach:
    // X = index * 150
    // Y = (index % 3) * 100 // Just to stagger branches slightly? No, that's messy.
    
    // Better: use Hash of ID for Y to keep stable?
    // Or just simple list if graph is linear.
    // If we have parent, try to align Y with parent?
    
    let yPos = 0;
    const parents = getParents(v.id);
    if (parents.length > 0) {
      // Find parent Y
      // We can't easily find parent node object here without pre-calc.
    }
    
    // Fallback: Just Scatter Plot style based on time.
    return {
      id: v.id,
      position: { x: index * 180, y: (index % 5) * 80 }, // Basic staggering
      data: { label: v.message.slice(0, 15) + (v.id === selectedNodeId ? ' (*)' : '') },
      style: { 
        background: v.id === selectedNodeId ? '#bfdbfe' : '#fff',
        border: v.id === selectedNodeId ? '2px solid #2563eb' : '1px solid #777',
        width: 150,
        fontSize: 12
      },
    };
  });

  const flowEdges: Edge[] = edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

  return (
    <div style={{ height: 300, border: '1px solid #ddd', borderRadius: 8 }}>
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
