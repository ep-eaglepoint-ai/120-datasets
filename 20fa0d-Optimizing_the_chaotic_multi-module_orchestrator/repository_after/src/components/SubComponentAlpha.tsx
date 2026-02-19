/**
 * Alpha Module: State Synchronization Component
 * Design: Monospace font, pastel HSL colors, dashed borders
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, memo, useContext } from 'react';
import { ThemeContext, SyncContext } from '../contexts/contexts';
import { AlphaProps, ProcessedDataItem } from '../types/types';
import { stringHash, reverseMap, cloneWithoutPrivateKeys } from '../utils/utils';

const DEBOUNCE_DELAY = 300;

export const SubComponentAlpha = memo<AlphaProps>(({ 
  data, 
  onUpdate, 
  idx, 
  parentRef, 
  config 
}) => {
  const [localState, setLocalState] = useState<Record<string, any>>(() => 
    cloneWithoutPrivateKeys(data || {})
  );
  
  const mountedRef = useRef(true);
  const updateCountRef = useRef(0);
  const themeContext = useContext(ThemeContext);
  const { syncCounter } = useContext(SyncContext);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    
    updateCountRef.current++;
    const filteredData = cloneWithoutPrivateKeys(data || {});
    
    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        setLocalState(prev => {
          const hasChanges = Object.keys(filteredData).some(
            key => prev[key] !== filteredData[key]
          );
          return hasChanges ? { ...prev, ...filteredData } : prev;
        });
      }
    }, DEBOUNCE_DELAY);
    
    return () => clearTimeout(timeoutId);
  }, [data, syncCounter]);

  const processedData = useMemo<ProcessedDataItem[]>(() => {
    const result: ProcessedDataItem[] = [];
    
    for (const key in localState) {
      if (!Object.prototype.hasOwnProperty.call(localState, key)) continue;
      
      const value = localState[key];
      if (value === null || value === undefined || typeof value === 'function') {
        continue;
      }
      
      result.push({
        key,
        value,
        hash: stringHash(String(value)),
      });
    }
    
    return result.sort((a, b) => a.hash - b.hash);
  }, [localState]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    e.preventDefault();
    
    const target = e.currentTarget;
    const dataIdx = target.getAttribute('data-idx');
    
    if (dataIdx !== null) {
      const numIdx = parseInt(dataIdx, 10);
      if (!isNaN(numIdx) && numIdx >= 0) {
        onUpdate?.(idx, numIdx, localState);
      }
    }
    
    if (parentRef?.current) {
      parentRef.current.lastClickTime = Date.now();
    }
  }, [idx, localState, onUpdate, parentRef]);

  const renderItems = useCallback(() => {
    return reverseMap(processedData, (item, i) => {
      const itemConfig = config?.items?.[item.key];
      const isActive = itemConfig?.active !== false;
      
      const styleObj: React.CSSProperties = {
        padding: `${(i % 3) * 2 + 4}px`,
        margin: isActive ? '4px' : '0px',
        borderRadius: '4px',
        backgroundColor: isActive 
          ? `hsl(${Math.abs(item.hash) % 360}, 70%, 90%)` 
          : 'transparent',
        cursor: isActive ? 'pointer' : 'default',
        display: 'inline-block',
        border: themeContext 
          ? `1px solid ${themeContext.borderColor || '#ccc'}` 
          : 'none',
        fontSize: '12px',
        fontFamily: 'monospace',
      };
      
      const displayValue = typeof item.value === 'object' 
        ? JSON.stringify(item.value) 
        : String(item.value);
      
      return (
        <span
          key={`${item.key}-${item.hash}-${i}`}
          data-idx={i}
          onClick={isActive ? handleClick : undefined}
          style={styleObj}
        >
          {displayValue}
        </span>
      );
    });
  }, [processedData, config, themeContext, handleClick]);

  if (!data || Object.keys(data).length === 0) {
    return <div data-empty="true" />;
  }

  return (
    <div
      className="sub-alpha p-2 border border-dashed border-gray-300 rounded mb-2"
      data-idx={idx}
    >
      <div className="text-xs font-bold mb-1 opacity-50">ALPHA NODE {idx}</div>
      {renderItems()}
    </div>
  );
});

SubComponentAlpha.displayName = 'SubComponentAlpha';
