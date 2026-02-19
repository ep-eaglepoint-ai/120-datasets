/**
 * Delta Module: Form State Management
 * Design: Indigo borders, focus rings, clean validation errors
 */

import React, { useReducer, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DeltaProps, DeltaState, DeltaAction, FieldSchema } from '..';
import { setNestedValue, deleteNestedValue, getNestedValue } from '../utils/utils';

const VALIDATION_DEBOUNCE = 300;

const deltaReducer = (state: DeltaState, action: DeltaAction): DeltaState => {
  const timestamp = Date.now();
  const newHistory = [...state.history];
  
  switch (action.type) {
    case 'SET': {
      if (!action.path) return state;
      
      const pathArray = action.path.split('.');
      const newData = setNestedValue(state.data, pathArray, action.value);
      
      newHistory.push({ type: 'SET', path: action.path, timestamp });
      return {
        data: newData,
        history: newHistory.slice(-50),
      };
    }
    
    case 'DELETE': {
      if (!action.path) return state;
      
      const pathArray = action.path.split('.');
      const newData = deleteNestedValue(state.data, pathArray);
      
      newHistory.push({ type: 'DELETE', path: action.path, timestamp });
      return {
        data: newData,
        history: newHistory.slice(-50),
      };
    }
    
    case 'RESET': {
      newHistory.push({ type: 'RESET', timestamp });
      return {
        data: action.initial || {},
        history: newHistory.slice(-50),
      };
    }
    
    default:
      return state;
  }
};

export const SubComponentDelta: React.FC<DeltaProps> = ({ 
  initialData, 
  schema, 
  validators, 
  onChange 
}) => {
  const [state, dispatch] = useReducer(deltaReducer, {
    data: initialData || {},
    history: [],
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const validationTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const prevDataRef = useRef<Record<string, any>>(state.data);

  useEffect(() => {
    const changedPaths: string[] = [];
    
    const findChanges = (prev: any, curr: any, path: string = ''): void => {
      const allKeys = new Set([
        ...Object.keys(prev || {}),
        ...Object.keys(curr || {}),
      ]);
      
      for (const key of allKeys) {
        const fullPath = path ? `${path}.${key}` : key;
        const prevVal = prev?.[key];
        const currVal = curr?.[key];
        
        if (prevVal !== currVal) {
          if (
            typeof prevVal === 'object' &&
            typeof currVal === 'object' &&
            prevVal !== null &&
            currVal !== null &&
            !Array.isArray(prevVal) &&
            !Array.isArray(currVal)
          ) {
            findChanges(prevVal, currVal, fullPath);
          } else {
            changedPaths.push(fullPath);
          }
        }
      }
    };
    
    findChanges(prevDataRef.current, state.data);
    prevDataRef.current = state.data;
    
    for (const path of changedPaths) {
      if (validationTimeouts.current[path]) {
        clearTimeout(validationTimeouts.current[path]);
      }
      
      validationTimeouts.current[path] = setTimeout(() => {
        if (validators?.[path]) {
          const value = getNestedValue(state.data, path);
          const result = validators[path](value, state.data);
          
          setErrors(prev => {
            if (result === true || result === null || result === undefined) {
              const { [path]: _, ...rest } = prev;
              return rest;
            }
            return { ...prev, [path]: result as string };
          });
        }
      }, VALIDATION_DEBOUNCE);
    }
    
    if (onChange && changedPaths.length > 0) {
      onChange(state.data, changedPaths, state.history);
    }
    
    return () => {
      Object.values(validationTimeouts.current).forEach(clearTimeout);
    };
  }, [state.data, state.history, validators, onChange]);

  const handleFieldChange = useCallback((path: string, value: any) => {
    dispatch({ type: 'SET', path, value });
    setTouched(prev => ({ ...prev, [path]: true }));
  }, []);

  const handleFieldBlur = useCallback((path: string) => {
    setTouched(prev => ({ ...prev, [path]: true }));
  }, []);

  const renderField = useCallback((
    fieldSchema: FieldSchema, 
    path: string
  ): React.ReactNode => {
    const value = getNestedValue(state.data, path);
    const error = touched[path] ? errors[path] : undefined;
    const fieldType = fieldSchema.type || 'text';
    
    const commonStyle: React.CSSProperties = {
      border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
      padding: '6px 10px',
      margin: '4px 0',
      width: '100%',
      borderRadius: '4px',
      fontSize: '14px',
      boxSizing: 'border-box',
    };
    
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
        return (
          <div key={path} className="delta-field mb-3">
            {fieldSchema.label && (
              <label className="block text-xs font-semibold mb-1 text-gray-600">
                {fieldSchema.label}
              </label>
            )}
            <input
              type={fieldType}
              className="focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
              value={value || ''}
              onChange={(e) => handleFieldChange(
                path,
                fieldType === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
              )}
              onBlur={() => handleFieldBlur(path)}
              placeholder={fieldSchema.placeholder}
              style={commonStyle}
            />
            {error && (
              <div className="delta-error text-red-500 text-[10px] mt-0.5 font-medium">
                {error}
              </div>
            )}
          </div>
        );
      
      case 'group':
        return (
          <div
            key={path}
            className="delta-group mt-2 border-l-2 border-indigo-100 pl-4 py-1"
          >
            {fieldSchema.label && (
              <div className="text-sm font-bold text-indigo-900 mb-2">
                {fieldSchema.label}
              </div>
            )}
            {Object.entries(fieldSchema.fields || {}).map(([subKey, subSchema]) =>
              renderField(subSchema, path ? `${path}.${subKey}` : subKey)
            )}
          </div>
        );
      
      default:
        return null;
    }
  }, [state.data, errors, touched, handleFieldChange, handleFieldBlur]);

  const formElements = useMemo(() => {
    if (!schema) return null;
    return Object.entries(schema).map(([key, fieldSchema]) =>
      renderField(fieldSchema, key)
    );
  }, [schema, renderField]);

  return (
    <div className="sub-delta bg-white p-4 rounded border shadow-sm">
      <div className="delta-form">{formElements}</div>
      <div className="delta-history mt-4 border-t pt-2 flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 tracking-wider">
        <span>Form State Tracker</span>
        <span>{state.history.length} Modifications</span>
      </div>
    </div>
  );
};

SubComponentDelta.displayName = 'SubComponentDelta';
