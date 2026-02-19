/**
 * Gamma Module: Asynchronous Data Pipeline
 * Design: Animated spinner, stage-based loading, clean result display
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { GammaProps, PipelineState, PipelineStage } from '..';

export const SubComponentGamma = memo<GammaProps>(({ 
  source, 
  filter, 
  mapper, 
  reducer, 
  initialValue, 
  onResult 
}) => {
  const [pipeline, setPipeline] = useState<PipelineState>({
    stage: 0,
    intermediate: null,
    final: null,
    error: null,
  });
  
  const stagesRef = useRef<PipelineStage[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    if (!source || (Array.isArray(source) && source.length === 0)) {
      setPipeline({
        stage: -1,
        intermediate: null,
        final: initialValue ?? null,
        error: null,
      });
      return;
    }
    
    const runPipeline = async () => {
      try {
        let current = Array.isArray(source) ? [...source] : [source];
        stagesRef.current = [];
        
        // Stage 1: Filter
        if (abortController.signal.aborted) return;
        setPipeline(p => ({ ...p, stage: 1, error: null }));
        stagesRef.current.push({ stage: 'filter', input: current.length });
        
        // Emulate async processing
        await new Promise(r => setTimeout(r, 400));
        
        if (filter) {
          const filtered: any[] = [];
          for (let i = 0; i < current.length; i++) {
            if (abortController.signal.aborted) return;
            
            try {
              if (filter(current[i], i)) {
                filtered.push(current[i]);
              }
            } catch (error) {
              console.error('Filter error:', error);
            }
          }
          current = filtered;
        }
        stagesRef.current[0].output = current.length;
        
        // Stage 2: Map
        if (abortController.signal.aborted) return;
        setPipeline(p => ({ ...p, stage: 2, intermediate: current }));
        stagesRef.current.push({ stage: 'map', input: current.length });
        
        await new Promise(r => setTimeout(r, 400));
        
        if (mapper) {
          const mapped: any[] = [];
          for (let i = 0; i < current.length; i++) {
            if (abortController.signal.aborted) return;
            
            try {
              mapped.push(mapper(current[i], i));
            } catch (error) {
              console.error('Mapper error:', error);
              mapped.push(current[i]);
            }
          }
          current = mapped;
        }
        stagesRef.current[1].output = current.length;
        
        // Stage 3: Reduce
        if (abortController.signal.aborted) return;
        setPipeline(p => ({ ...p, stage: 3 }));
        stagesRef.current.push({ stage: 'reduce', input: current.length });
        
        await new Promise(r => setTimeout(r, 400));
        
        let result: any = initialValue;
        if (reducer) {
          for (let i = 0; i < current.length; i++) {
            if (abortController.signal.aborted) return;
            
            try {
              result = reducer(result, current[i], i);
            } catch (error) {
              console.error('Reducer error:', error);
            }
          }
        } else {
          result = current;
        }
        stagesRef.current[2].output = Array.isArray(result) ? result.length : 1;
        
        // Stage 4: Complete
        if (abortController.signal.aborted) return;
        setPipeline({
          stage: 4,
          intermediate: current,
          final: result,
          error: null,
        });
        
        onResult?.(result, stagesRef.current);
      } catch (error) {
        if (!abortController.signal.aborted) {
          setPipeline(p => ({ 
            ...p, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }));
        }
      }
    };
    
    runPipeline();
    
    return () => {
      abortController.abort();
    };
  }, [source, filter, mapper, reducer, initialValue, onResult]);

  const renderStage = useCallback(() => {
    const { stage, final, error } = pipeline;
    
    if (error) {
      return (
        <div className="gamma-error text-red-500 text-sm p-2 bg-red-50 rounded">
          Error: {error}
        </div>
      );
    }
    
    if (stage < 4) {
      return (
        <div className="gamma-loading flex items-center gap-2 text-sm text-blue-600 font-medium p-4">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Processing stage {stage}/4...
        </div>
      );
    }
    
    if (final === null || final === undefined) {
      return (
        <div className="gamma-empty text-sm italic opacity-40">
          No pipeline results.
        </div>
      );
    }
    
    return (
      <div className="gamma-result bg-white p-3 border rounded shadow-sm">
        <div className="text-xs font-bold uppercase text-gray-400 mb-2">
          Final Output
        </div>
        <pre className="text-xs overflow-auto max-h-40">
          {JSON.stringify(final, null, 2)}
        </pre>
      </div>
    );
  }, [pipeline]);

  return (
    <div className="sub-gamma mt-4" data-stage={pipeline.stage}>
      {renderStage()}
    </div>
  );
});

SubComponentGamma.displayName = 'SubComponentGamma';
