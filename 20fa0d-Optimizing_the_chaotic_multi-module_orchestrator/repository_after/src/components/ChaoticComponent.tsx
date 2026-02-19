/**
 * ChaoticComponent: Main orchestrator
 * Design: Two-column grid, color-coded sections, monospace footer
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ThemeContext, SyncContext } from '../contexts/contexts';
import { SubComponentAlpha } from './SubComponentAlpha';
import { SubComponentBeta } from './SubComponentBeta';
import { SubComponentGamma } from './SubComponentGamma';
import { SubComponentDelta } from './SubComponentDelta';
import { ChaoticComponentProps, InternalState, ModeConfig, MainComponentRef } from '..';
import { range, createCache } from '../utils/utils';

const SYNC_INTERVAL = 5000;
const globalCache = createCache();

export const ChaoticComponent: React.FC<ChaoticComponentProps> = ({
  mode = 'full',
  data,
  items,
  config,
  schema,
  validators,
  source,
  filter,
  mapper,
  reducer,
  initialValue,
  transformer,
  onUpdate,
  onResult,
  onChange,
  settings,
  className = '',
  style,
  children,
}) => {
  const [internalState, setInternalState] = useState<InternalState>({
    version: 0,
    lastUpdate: null,
    cache: {},
    flags: {},
  });
  
  const [syncCounter, setSyncCounter] = useState(0);
  const mainRef = useRef<MainComponentRef>({ 
    lastClickTime: 0, 
    renderCount: 0 
  });

  const dataRef = useRef(data);
  const itemsRef = useRef(items);
  const configRef = useRef(config);

  useEffect(() => {
    dataRef.current = data;
    itemsRef.current = items;
    configRef.current = config;
  }, [data, items, config]);

  useEffect(() => {
    mainRef.current.renderCount++;
    
    const interval = setInterval(() => {
      setSyncCounter(q => {
        const next = q + 1;
        globalCache.set('lastSyncCounter', next);
        return next;
      });
    }, SYNC_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);

  const handleSubUpdate = useCallback((
    idx: number, 
    subIdx: number, 
    subState: Record<string, any>
  ) => {
    setInternalState(prev => {
      const cacheKey = `${idx}-${subIdx}`;
      return {
        ...prev,
        version: prev.version + 1,
        lastUpdate: Date.now(),
        cache: {
          ...prev.cache,
          [cacheKey]: subState,
        },
      };
    });
    
    onUpdate?.(idx, subIdx, dataRef.current);
  }, [onUpdate]);

  const handleTreeCallback = useCallback((
    action: string, 
    index: number, 
    depth: number
  ) => {
    setInternalState(prev => ({
      ...prev,
      flags: {
        ...prev.flags,
        [`tree-${depth}-${index}`]: action,
      },
    }));
  }, []);

  const handleGammaResult = useCallback((result: any, stages: any[]) => {
    setInternalState(prev => ({
      ...prev,
      cache: {
        ...prev.cache,
        gammaResult: result,
        gammaStages: stages,
      },
    }));
    
    onResult?.(result, stages);
  }, [onResult]);

  const handleDeltaChange = useCallback((
    newData: Record<string, any>, 
    paths: string[], 
    history: any[]
  ) => {
    setInternalState(prev => ({
      ...prev,
      cache: {
        ...prev.cache,
        deltaData: newData,
        deltaPaths: paths,
      },
    }));
    
    onChange?.(newData, paths, history);
  }, [onChange]);

  const modeConfig = useMemo<ModeConfig>(() => {
    const configs: Record<string, ModeConfig> = {
      alpha: { showAlpha: true, showBeta: false, showGamma: false, showDelta: false },
      beta: { showAlpha: false, showBeta: true, showGamma: false, showDelta: false },
      gamma: { showAlpha: false, showBeta: false, showGamma: true, showDelta: false },
      delta: { showAlpha: false, showBeta: false, showGamma: false, showDelta: true },
      mixed: { showAlpha: true, showBeta: true, showGamma: false, showDelta: false },
      full: { showAlpha: true, showBeta: true, showGamma: true, showDelta: true },
    };
    return configs[mode] || configs.full;
  }, [mode]);

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    padding: '20px',
    borderRadius: '12px',
    backgroundColor: settings?.dark ? '#0f172a' : '#f8fafc',
    color: settings?.dark ? '#f1f5f9' : '#1e293b',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    ...style,
  }), [settings?.dark, style]);

  const alphaComponents = useMemo(() => {
    if (!modeConfig.showAlpha || !data) return null;
    
    const dataArray = Array.isArray(data) ? data : [data];
    return range(dataArray.length, (i) => (
      <SubComponentAlpha
        key={`alpha-${i}-${internalState.version}`}
        data={dataArray[i]}
        onUpdate={handleSubUpdate}
        idx={i}
        parentRef={mainRef}
        config={config?.alpha}
      />
    ));
  }, [modeConfig.showAlpha, data, config?.alpha, internalState.version, handleSubUpdate]);

  const betaComponent = useMemo(() => {
    if (!modeConfig.showBeta) return null;
    return (
      <div className="bg-white p-4 rounded border shadow-sm mb-4">
        <div className="text-xs font-bold uppercase text-indigo-500 mb-3 tracking-widest">
          Recursive Hierarchy
        </div>
        <SubComponentBeta
          items={items}
          transformer={transformer}
          depth={0}
          parentCallback={handleTreeCallback}
          settings={settings}
        />
      </div>
    );
  }, [modeConfig.showBeta, items, transformer, handleTreeCallback, settings]);

  const gammaComponent = useMemo(() => {
    if (!modeConfig.showGamma) return null;
    return (
      <div className="bg-white p-4 rounded border shadow-sm mb-4">
        <div className="text-xs font-bold uppercase text-amber-500 mb-3 tracking-widest">
          Async Logic Pipeline
        </div>
        <SubComponentGamma
          source={source}
          filter={filter}
          mapper={mapper}
          reducer={reducer}
          initialValue={initialValue}
          onResult={handleGammaResult}
        />
      </div>
    );
  }, [modeConfig.showGamma, source, filter, mapper, reducer, initialValue, handleGammaResult]);

  const deltaComponent = useMemo(() => {
    if (!modeConfig.showDelta) return null;
    return (
      <div className="mb-4">
        <div className="text-xs font-bold uppercase text-emerald-500 mb-3 tracking-widest pl-1">
          Historical Form State
        </div>
        <SubComponentDelta
          initialData={
            data && typeof data === 'object' && !Array.isArray(data) ? data : {}
          }
          schema={schema}
          validators={validators}
          onChange={handleDeltaChange}
        />
      </div>
    );
  }, [modeConfig.showDelta, data, schema, validators, handleDeltaChange]);

  const themeContextValue = useMemo(() => ({
    borderColor: settings?.borderColor || '#e2e8f0',
    theme: (settings?.theme || 'light') as 'light' | 'dark',
  }), [settings?.borderColor, settings?.theme]);

  const syncContextValue = useMemo(() => ({
    syncCounter,
    setSyncCounter,
  }), [syncCounter]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <SyncContext.Provider value={syncContextValue}>
        <div
          className={`chaotic-component ${className}`}
          style={containerStyle}
          ref={(el) => {
            if (el) mainRef.current.element = el;
          }}
        >
          <header className="flex justify-between items-center border-b pb-4 mb-6 border-slate-200">
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">
                Chaotic Controller
              </h1>
              <p className="text-[10px] font-medium text-slate-400">
                CORE v2.5 // REACT ENGINE
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono px-2 py-1 bg-slate-200 rounded">
                MODE: {mode || 'FULL'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                SIG_Q: {syncCounter}
              </div>
            </div>
          </header>

          <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-4">
              {alphaComponents && (
                <div>
                  <div className="text-xs font-bold uppercase text-rose-500 mb-3 tracking-widest pl-1">
                    Hashed Objects
                  </div>
                  <div className="max-h-[300px] overflow-y-auto pr-2">
                    {alphaComponents}
                  </div>
                </div>
              )}
              {betaComponent}
            </section>

            <section className="space-y-4">
              {deltaComponent}
              {gammaComponent}
            </section>
          </main>

          {children && (
            <div className="mt-8 pt-8 border-t border-slate-200">
              {children}
            </div>
          )}

          <footer className="mt-8 flex gap-4 text-[9px] font-mono text-slate-400 bg-slate-100 p-2 rounded">
            <div>CACHE_OBJS: {Object.keys(internalState.cache).length}</div>
            <div>FLAG_OPS: {Object.keys(internalState.flags).length}</div>
            <div>TICK_COUNT: {mainRef.current.renderCount}</div>
            <div className="ml-auto opacity-50 uppercase">
              Ready Status: Solid
            </div>
          </footer>
        </div>
      </SyncContext.Provider>
    </ThemeContext.Provider>
  );
};

export default ChaoticComponent;
