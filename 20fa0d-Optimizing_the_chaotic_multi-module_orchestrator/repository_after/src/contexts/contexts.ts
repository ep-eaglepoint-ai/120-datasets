import React from 'react';
import { ThemeContextValue, SyncContextValue } from '../types/types';

export const ThemeContext = React.createContext<ThemeContextValue>({
  borderColor: '#e2e8f0',
  theme: 'light',
});

export const SyncContext = React.createContext<SyncContextValue>({
  syncCounter: 0,
  setSyncCounter: () => {},
});
