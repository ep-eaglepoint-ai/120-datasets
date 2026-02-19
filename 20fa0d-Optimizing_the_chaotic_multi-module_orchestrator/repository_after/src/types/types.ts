/**
 * Type definitions for the refactored ChaoticComponent
 */
import React from 'react';

export interface ThemeContextValue {
  borderColor: string;
  theme: 'light' | 'dark';
}

export interface SyncContextValue {
  syncCounter: number;
  setSyncCounter: (value: number | ((prev: number) => number)) => void;
}

export interface ProcessedDataItem {
  key: string;
  value: any;
  hash: number;
}

export interface CacheManager<T = any> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  clear: () => void;
  has: (key: string) => boolean;
}

export interface AlphaConfig {
  items?: Record<string, { active?: boolean; [key: string]: any }>;
}

export interface AlphaProps {
  data: Record<string, any>;
  onUpdate?: (idx: number, subIdx: number, state: Record<string, any>) => void;
  idx: number;
  parentRef?: React.RefObject<AlphaParentRef>;
  config?: AlphaConfig;
}

export interface AlphaParentRef {
  lastClickTime: number;
  renderCount: number;
  element?: HTMLDivElement | null;
}

export interface TreeItem {
  id?: string | number;
  label?: string;
  name?: string;
  children?: TreeItem[];
  [key: string]: any;
}

export interface BetaProps {
  items: TreeItem[];
  transformer?: (item: TreeItem, index: number) => TreeItem;
  depth: number;
  parentCallback?: (action: string, index: number, depth: number) => void;
  settings?: Record<string, any>;
}

export interface PipelineStage {
  stage: 'filter' | 'map' | 'reduce';
  input: number;
  output?: number;
}

export interface PipelineState {
  stage: number;
  intermediate: any[] | null;
  final: any;
  error: string | null;
}

export interface GammaProps<T = any, R = any> {
  source: T | T[];
  filter?: (item: T, index: number) => boolean;
  mapper?: (item: T, index: number) => any;
  reducer?: (accumulator: R, item: any, index: number) => R;
  initialValue?: R;
  onResult?: (result: R, stages: PipelineStage[]) => void;
}

export interface FieldSchema {
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'group';
  label?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  fields?: Record<string, FieldSchema>;
  [key: string]: any;
}

export interface DeltaAction {
  type: 'SET' | 'DELETE' | 'MERGE' | 'RESET' | 'BATCH';
  path?: string;
  value?: any;
  payload?: any;
  initial?: any;
  actions?: DeltaAction[];
}

export interface HistoryEntry {
  type: string;
  path?: string;
  timestamp: number;
}

export interface DeltaState {
  data: Record<string, any>;
  history: HistoryEntry[];
}

export interface DeltaProps {
  initialData?: Record<string, any>;
  schema?: Record<string, FieldSchema>;
  validators?: Record<string, (value: any, data: Record<string, any>) => boolean | string>;
  onChange?: (data: Record<string, any>, changedPaths: string[], history: HistoryEntry[]) => void;
}

export type ComponentMode = 'alpha' | 'beta' | 'gamma' | 'delta' | 'mixed' | 'full';

export interface ModeConfig {
  showAlpha: boolean;
  showBeta: boolean;
  showGamma: boolean;
  showDelta: boolean;
}

export interface ComponentSettings {
  dark?: boolean;
  borderColor?: string;
  theme?: 'light' | 'dark';
}

export interface InternalState {
  version: number;
  lastUpdate: number | null;
  cache: Record<string, any>;
  flags: Record<string, any>;
}

export interface MainComponentRef {
  lastClickTime: number;
  renderCount: number;
  element?: HTMLDivElement | null;
}

export interface ChaoticComponentProps {
  mode?: ComponentMode;
  data?: any;
  items?: TreeItem[];
  config?: { alpha?: AlphaConfig };
  schema?: Record<string, FieldSchema>;
  validators?: Record<string, (value: any, data: Record<string, any>) => boolean | string>;
  source?: any;
  filter?: (item: any, index: number) => boolean;
  mapper?: (item: any, index: number) => any;
  reducer?: (accumulator: any, item: any, index: number) => any;
  initialValue?: any;
  transformer?: (item: TreeItem, index: number) => TreeItem;
  onUpdate?: (idx: number, subIdx: number, data: any) => void;
  onResult?: (result: any, stages: PipelineStage[]) => void;
  onChange?: (data: Record<string, any>, changedPaths: string[], history: HistoryEntry[]) => void;
  settings?: ComponentSettings;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
