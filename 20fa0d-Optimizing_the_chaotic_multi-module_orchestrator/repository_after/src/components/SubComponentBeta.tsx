/**
 * Beta Module: Recursive Tree Renderer
 * Design: Indented tree structure with hover effects and gray borders
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BetaProps, TreeItem } from '..';

const BATCH_SIZE = 5;
const PROCESS_DELAY = 0;

export const SubComponentBeta: React.FC<BetaProps> = ({ 
  items, 
  transformer, 
  depth, 
  parentCallback, 
  settings 
}) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    (items || []).forEach((_, i) => {
      initial[i] = depth < 1;
    });
    return initial;
  });
  
  const [derived, setDerived] = useState<TreeItem[]>([]);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);
  const queueRef = useRef<TreeItem[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) {
      setDerived([]);
      return;
    }
    
    queueRef.current = [...items];
    
    const processQueue = () => {
      if (!mountedRef.current || processingRef.current) return;
      if (queueRef.current.length === 0) return;
      
      processingRef.current = true;
      const batch = queueRef.current.splice(0, BATCH_SIZE);
      const startIndex = items.length - queueRef.current.length - batch.length;
      
      const transformed = batch.map((item, i) => {
        if (transformer) {
          try {
            return transformer(item, startIndex + i);
          } catch (error) {
            console.error('Transform error:', error);
            return item;
          }
        }
        return item;
      });
      
      setDerived(prev => {
        const next = [...prev, ...transformed];
        return next.slice(-items.length);
      });
      
      processingRef.current = false;
      
      if (queueRef.current.length > 0 && mountedRef.current) {
        setTimeout(processQueue, PROCESS_DELAY);
      }
    };
    
    processQueue();
    
    return () => {
      queueRef.current = [];
      processingRef.current = false;
    };
  }, [items, transformer]);

  const toggleExpand = useCallback((index: number) => {
    setExpanded(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
    parentCallback?.('toggle', index, depth);
  }, [parentCallback, depth]);

  const nestedRenderer = useCallback((item: TreeItem, index: number) => {
    if (!item) return null;
    
    const isExpanded = expanded[index] === true;
    const hasChildren = item.children && item.children.length > 0;
    
    const itemStyle: React.CSSProperties = {
      marginLeft: `${depth * 12}px`,
      paddingTop: '2px',
      paddingBottom: '2px',
      borderLeft: depth > 0 ? '1px solid #ddd' : 'none',
      paddingLeft: depth > 0 ? '12px' : '0px',
    };
    
    const toggleStyle: React.CSSProperties = {
      cursor: hasChildren ? 'pointer' : 'default',
      userSelect: 'none',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    };
    
    const displayText = item.label || item.name || `Item ${index}`;
    
    return (
      <div
        key={`beta-${depth}-${index}-${item.id || index}`}
        style={itemStyle}
      >
        <div
          onClick={hasChildren ? () => toggleExpand(index) : undefined}
          style={toggleStyle}
          className="hover:bg-gray-50 rounded px-1 transition-colors"
        >
          <span className="text-[10px] w-4 text-center">
            {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
          </span>
          <span>{displayText}</span>
        </div>
        {isExpanded && hasChildren && (
          <SubComponentBeta
            items={item.children}
            transformer={transformer}
            depth={depth + 1}
            parentCallback={parentCallback}
            settings={settings}
          />
        )}
      </div>
    );
  }, [expanded, depth, transformer, parentCallback, settings, toggleExpand]);

  if (derived.length === 0 && items && items.length > 0) {
    return <div className="text-xs italic opacity-50">Loading tree...</div>;
  }

  return (
    <div className="sub-beta bg-gray-50/50 p-2 rounded" data-depth={depth}>
      {derived.map((item, i) => nestedRenderer(item, i))}
    </div>
  );
};

SubComponentBeta.displayName = 'SubComponentBeta';
