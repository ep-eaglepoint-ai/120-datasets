import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
  createContext,
  useContext,
  useReducer,
} from "react";

// --- ORIGINAL COMPONENT LOGIC START ---

const _0x4f2a = createContext(null);
const _0x7b3c = createContext({ q: 0, w: () => {} });

const _r = (a, b) => {
  const c = [];
  for (let i = 0; i < a; i++) {
    c.push(b(i));
  }
  return c;
};

const _h = (x) => {
  let r = 0;
  for (let i = 0; i < x.length; i++) {
    r = ((r << 5) - r + x.charCodeAt(i)) | 0;
  }
  return r;
};

const _m = (arr, f) => {
  const result = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    result.unshift(f(arr[i], i));
  }
  return result;
};

const _z = (() => {
  let _cache = {};
  return (k, v) => {
    if (v !== undefined) _cache[k] = v;
    return _cache[k];
  };
})();

const SubComponentAlpha = memo(({ data, onUpdate, idx, parentRef, config }) => {
  const [localState, setLocalState] = useState(() => {
    const initial = {};
    Object.keys(data || {}).forEach((k) => {
      initial[k] =
        typeof data[k] === "object"
          ? JSON.parse(JSON.stringify(data[k]))
          : data[k];
    });
    return initial;
  });

  const internalRef = useRef({ mounted: false, updateCount: 0 });
  const timerRef = useRef(null);

  const contextValue = useContext(_0x4f2a);
  const { q: qValue } = useContext(_0x7b3c);

  useEffect(() => {
    internalRef.current.mounted = true;
    return () => {
      internalRef.current.mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!internalRef.current.mounted) return;
    internalRef.current.updateCount++;

    const newState = {};
    Object.keys(data || {}).forEach((k) => {
      if (k.startsWith("_")) return;
      newState[k] = data[k];
    });

    timerRef.current = setTimeout(() => {
      if (internalRef.current.mounted) {
        setLocalState((prev) => {
          const merged = { ...prev };
          Object.keys(newState).forEach((k) => {
            if (merged[k] !== newState[k]) {
              merged[k] = newState[k];
            }
          });
          return merged;
        });
      }
    }, 0);
  }, [data, qValue]);

  const processedData = useMemo(() => {
    const result = [];
    const keys = Object.keys(localState);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = localState[k];
      if (v === null || v === undefined) continue;
      if (typeof v === "function") continue;
      result.push({ key: k, value: v, hash: _h(String(v)) });
    }
    return result.sort((a, b) => a.hash - b.hash);
  }, [localState]);

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();

      const target = e.currentTarget;
      const dataIdx = target.getAttribute("data-idx");

      if (dataIdx !== null) {
        const numIdx = parseInt(dataIdx, 10);
        if (!isNaN(numIdx) && numIdx >= 0) {
          onUpdate && onUpdate(idx, numIdx, localState);
        }
      }

      if (parentRef && parentRef.current) {
        parentRef.current.lastClickTime = Date.now();
      }
    },
    [idx, localState, onUpdate, parentRef]
  );

  const renderItems = useCallback(() => {
    return _m(processedData, (item, i) => {
      const itemConfig = config && config.items ? config.items[item.key] : null;
      const isActive = itemConfig ? itemConfig.active !== false : true;
      const styleObj = {
        padding: (i % 3) * 2 + 4 + "px",
        margin: isActive ? "4px" : "0px",
        borderRadius: "4px",
        backgroundColor: isActive
          ? `hsl(${Math.abs(item.hash) % 360}, 70%, 90%)`
          : "transparent",
        cursor: isActive ? "pointer" : "default",
        display: "inline-block",
        border: contextValue
          ? `1px solid ${contextValue.borderColor || "#ccc"}`
          : "none",
        fontSize: "12px",
        fontFamily: "monospace",
      };

      return (
        <span
          key={`${item.key}-${item.hash}-${i}`}
          data-idx={i}
          onClick={isActive ? handleClick : undefined}
          style={styleObj}
        >
          {typeof item.value === "object"
            ? JSON.stringify(item.value)
            : String(item.value)}
        </span>
      );
    });
  }, [processedData, config, contextValue, handleClick]);

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

const SubComponentBeta = ({
  items,
  transformer,
  depth,
  parentCallback,
  settings,
}) => {
  const [expanded, setExpanded] = useState(() => {
    const initial = {};
    (items || []).forEach((_, i) => {
      initial[i] = depth < 1;
    });
    return initial;
  });

  const [derived, setDerived] = useState([]);
  const processRef = useRef({ queue: [], processing: false });
  const mountedRef = useRef(true);

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

    processRef.current.queue = [...items];

    const processQueue = () => {
      if (!mountedRef.current) return;
      if (processRef.current.processing) return;
      if (processRef.current.queue.length === 0) return;

      processRef.current.processing = true;

      const batch = processRef.current.queue.splice(0, 5);
      const transformed = batch.map((item, i) => {
        if (transformer) {
          try {
            return transformer(
              item,
              i +
                (items.length - processRef.current.queue.length - batch.length)
            );
          } catch (e) {
            return item;
          }
        }
        return item;
      });

      setDerived((prev) => {
        const next = [...prev, ...transformed];
        return next.slice(-items.length);
      });

      processRef.current.processing = false;

      if (processRef.current.queue.length > 0) {
        setTimeout(processQueue, 0);
      }
    };

    processQueue();
  }, [items, transformer]);

  const toggleExpand = useCallback(
    (index) => {
      setExpanded((prev) => {
        const next = { ...prev };
        next[index] = !next[index];
        return next;
      });

      if (parentCallback) {
        parentCallback("toggle", index, depth);
      }
    },
    [parentCallback, depth]
  );

  const nestedRenderer = useCallback(
    (item, index) => {
      if (!item) return null;

      const isExpanded = expanded[index] === true;
      const hasChildren = item && item.children && item.children.length > 0;

      const itemStyle = {
        marginLeft: depth * 12 + "px",
        paddingTop: "2px",
        paddingBottom: "2px",
        borderLeft: depth > 0 ? "1px solid #ddd" : "none",
        paddingLeft: depth > 0 ? "12px" : "0px",
      };

      const toggleStyle = {
        cursor: hasChildren ? "pointer" : "default",
        userSelect: "none",
        fontSize: "13px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      };

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
              {hasChildren ? (isExpanded ? "▼" : "▶") : "•"}
            </span>
            <span>{item.label || item.name || `Item ${index}`}</span>
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
    },
    [expanded, depth, transformer, parentCallback, settings, toggleExpand]
  );

  if (derived.length === 0 && items && items.length > 0) {
    return <div className="text-xs italic opacity-50">Loading tree...</div>;
  }

  return (
    <div className="sub-beta bg-gray-50/50 p-2 rounded" data-depth={depth}>
      {derived.map((item, i) => nestedRenderer(item, i))}
    </div>
  );
};

const SubComponentGamma = memo(
  ({ source, filter, mapper, reducer, initialValue, onResult }) => {
    const [pipeline, setPipeline] = useState({
      stage: 0,
      intermediate: null,
      final: null,
      error: null,
    });

    const stagesRef = useRef([]);
    const abortRef = useRef(null);

    useEffect(() => {
      if (abortRef.current) {
        abortRef.current.aborted = true;
      }

      const controller = { aborted: false };
      abortRef.current = controller;

      if (!source || (Array.isArray(source) && source.length === 0)) {
        setPipeline({
          stage: -1,
          intermediate: null,
          final: initialValue,
          error: null,
        });
        return;
      }

      const runPipeline = async () => {
        try {
          let current = Array.isArray(source) ? [...source] : [source];
          stagesRef.current = [];

          if (controller.aborted) return;
          setPipeline((p) => ({ ...p, stage: 1, error: null }));
          stagesRef.current.push({ stage: "filter", input: current.length });

          // Emulate async processing
          await new Promise((r) => setTimeout(r, 400));

          if (filter) {
            const filtered = [];
            for (let i = 0; i < current.length; i++) {
              if (controller.aborted) return;
              const item = current[i];
              let passes = false;
              try {
                passes = filter(item, i);
              } catch (e) {
                passes = false;
              }
              if (passes) filtered.push(item);
            }
            current = filtered;
          }
          stagesRef.current[0].output = current.length;

          if (controller.aborted) return;
          setPipeline((p) => ({ ...p, stage: 2, intermediate: current }));
          stagesRef.current.push({ stage: "map", input: current.length });

          await new Promise((r) => setTimeout(r, 400));

          if (mapper) {
            const mapped = [];
            for (let i = 0; i < current.length; i++) {
              if (controller.aborted) return;
              const item = current[i];
              try {
                mapped.push(mapper(item, i));
              } catch (e) {
                mapped.push(item);
              }
            }
            current = mapped;
          }
          stagesRef.current[1].output = current.length;

          if (controller.aborted) return;
          setPipeline((p) => ({ ...p, stage: 3 }));
          stagesRef.current.push({ stage: "reduce", input: current.length });

          await new Promise((r) => setTimeout(r, 400));

          let result = initialValue;
          if (reducer) {
            for (let i = 0; i < current.length; i++) {
              if (controller.aborted) return;
              try {
                result = reducer(result, current[i], i);
              } catch (e) {
                // continue
              }
            }
          } else {
            result = current;
          }
          stagesRef.current[2].output = Array.isArray(result)
            ? result.length
            : 1;

          if (controller.aborted) return;
          setPipeline({
            stage: 4,
            intermediate: current,
            final: result,
            error: null,
          });

          if (onResult) {
            onResult(result, stagesRef.current);
          }
        } catch (error) {
          if (!controller.aborted) {
            setPipeline((p) => ({ ...p, error: error.message }));
          }
        }
      };

      runPipeline();

      return () => {
        controller.aborted = true;
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
  }
);

const deltaReducer = (state, action) => {
  const newHistory = [...(state.history || [])];

  switch (action.type) {
    case "SET": {
      const path = action.path.split(".");
      const newData = JSON.parse(JSON.stringify(state.data || {}));
      let current = newData;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = action.value;
      newHistory.push({
        type: "SET",
        path: action.path,
        timestamp: Date.now(),
      });
      return { ...state, data: newData, history: newHistory.slice(-50) };
    }
    case "DELETE": {
      const path = action.path.split(".");
      const newData = JSON.parse(JSON.stringify(state.data || {}));
      let current = newData;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) return state;
        current = current[path[i]];
      }
      delete current[path[path.length - 1]];
      newHistory.push({
        type: "DELETE",
        path: action.path,
        timestamp: Date.now(),
      });
      return { ...state, data: newData, history: newHistory.slice(-50) };
    }
    case "RESET": {
      newHistory.push({ type: "RESET", timestamp: Date.now() });
      return { data: action.initial || {}, history: newHistory.slice(-50) };
    }
    default:
      return state;
  }
};

const SubComponentDelta = ({ initialData, schema, validators, onChange }) => {
  const [state, dispatch] = useReducer(deltaReducer, {
    data: initialData || {},
    history: [],
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validationTimeoutRef = useRef({});
  const prevDataRef = useRef(null);

  useEffect(() => {
    if (prevDataRef.current === null) {
      prevDataRef.current = state.data;
      return;
    }

    const changedPaths = [];
    const findChanges = (prev, curr, path = "") => {
      const allKeys = new Set([
        ...Object.keys(prev || {}),
        ...Object.keys(curr || {}),
      ]);
      for (const key of allKeys) {
        const fullPath = path ? `${path}.${key}` : key;
        const prevVal = prev ? prev[key] : undefined;
        const currVal = curr ? curr[key] : undefined;

        if (prevVal !== currVal) {
          if (
            typeof prevVal === "object" &&
            typeof currVal === "object" &&
            prevVal !== null &&
            currVal !== null
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
      if (validationTimeoutRef.current[path]) {
        clearTimeout(validationTimeoutRef.current[path]);
      }

      validationTimeoutRef.current[path] = setTimeout(() => {
        if (validators && validators[path]) {
          const value = path
            .split(".")
            .reduce((obj, key) => obj && obj[key], state.data);
          const validatorFn = validators[path];
          const result = validatorFn(value, state.data);

          setErrors((prev) => {
            if (result === true || result === null || result === undefined) {
              const next = { ...prev };
              delete next[path];
              return next;
            } else {
              return { ...prev, [path]: result };
            }
          });
        }
      }, 300);
    }

    if (onChange && changedPaths.length > 0) {
      onChange(state.data, changedPaths, state.history);
    }
  }, [state.data, state.history, validators, onChange]);

  const handleFieldChange = useCallback((path, value) => {
    dispatch({ type: "SET", path, value });
    setTouched((prev) => ({ ...prev, [path]: true }));
  }, []);

  const handleFieldBlur = useCallback((path) => {
    setTouched((prev) => ({ ...prev, [path]: true }));
  }, []);

  const renderField = useCallback(
    (fieldSchema, path) => {
      if (!fieldSchema) return null;

      const value = path
        .split(".")
        .reduce((obj, key) => obj && obj[key], state.data);
      const error = touched[path] ? errors[path] : null;
      const fieldType = fieldSchema.type || "text";

      const commonStyle = {
        border: error ? "1px solid #ef4444" : "1px solid #d1d5db",
        padding: "6px 10px",
        margin: "4px 0",
        width: "100%",
        borderRadius: "4px",
        fontSize: "14px",
        boxSizing: "border-box",
      };

      switch (fieldType) {
        case "text":
        case "email":
        case "password":
        case "number":
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
                value={value || ""}
                onChange={(e) =>
                  handleFieldChange(
                    path,
                    fieldType === "number"
                      ? parseFloat(e.target.value) || 0
                      : e.target.value
                  )
                }
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
        case "group":
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
              {Object.entries(fieldSchema.fields || {}).map(
                ([subKey, subSchema]) =>
                  renderField(subSchema, path ? `${path}.${subKey}` : subKey)
              )}
            </div>
          );
        default:
          return null;
      }
    },
    [state.data, errors, touched, handleFieldChange, handleFieldBlur]
  );

  const renderForm = useMemo(() => {
    if (!schema) return null;

    return Object.entries(schema).map(([key, fieldSchema]) =>
      renderField(fieldSchema, key)
    );
  }, [schema, renderField]);

  return (
    <div className="sub-delta bg-white p-4 rounded border shadow-sm">
      <div className="delta-form">{renderForm}</div>
      <div className="delta-history mt-4 border-t pt-2 flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 tracking-wider">
        <span>Form State Tracker</span>
        <span>{state.history.length} Modifications</span>
      </div>
    </div>
  );
};

const ChaoticComponent = ({
  mode,
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
  className,
  style,
  children,
}) => {
  const [internalState, setInternalState] = useState(() => ({
    version: 0,
    lastUpdate: null,
    cache: {},
    flags: {},
  }));

  const mainRef = useRef({ lastClickTime: 0, renderCount: 0 });
  const dataRef = useRef(data);
  const itemsRef = useRef(items);
  const configRef = useRef(config);

  const [contextQ, setContextQ] = useState(0);

  useEffect(() => {
    dataRef.current = data;
    itemsRef.current = items;
    configRef.current = config;
  }, [data, items, config]);

  useEffect(() => {
    mainRef.current.renderCount++;

    const interval = setInterval(() => {
      setContextQ((q) => {
        const next = q + 1;
        _z("lastQ", next);
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSubUpdate = useCallback(
    (idx, subIdx, subState) => {
      setInternalState((prev) => {
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

      if (onUpdate) {
        onUpdate(idx, subIdx, dataRef.current);
      }
    },
    [onUpdate]
  );

  const handleTreeCallback = useCallback((action, index, depth) => {
    setInternalState((prev) => ({
      ...prev,
      flags: {
        ...prev.flags,
        [`tree-${depth}-${index}`]: action,
      },
    }));
  }, []);

  const handleGammaResult = useCallback(
    (result, stages) => {
      setInternalState((prev) => ({
        ...prev,
        cache: {
          ...prev.cache,
          gammaResult: result,
          gammaStages: stages,
        },
      }));

      if (onResult) {
        onResult(result, stages);
      }
    },
    [onResult]
  );

  const handleDeltaChange = useCallback(
    (newData, paths, history) => {
      setInternalState((prev) => ({
        ...prev,
        cache: {
          ...prev.cache,
          deltaData: newData,
          deltaPaths: paths,
        },
      }));

      if (onChange) {
        onChange(newData, paths, history);
      }
    },
    [onChange]
  );

  const modeConfig = useMemo(() => {
    const configs = {
      alpha: {
        showAlpha: true,
        showBeta: false,
        showGamma: false,
        showDelta: false,
      },
      beta: {
        showAlpha: false,
        showBeta: true,
        showGamma: false,
        showDelta: false,
      },
      gamma: {
        showAlpha: false,
        showBeta: false,
        showGamma: true,
        showDelta: false,
      },
      delta: {
        showAlpha: false,
        showBeta: false,
        showGamma: false,
        showDelta: true,
      },
      mixed: {
        showAlpha: true,
        showBeta: true,
        showGamma: false,
        showDelta: false,
      },
      full: {
        showAlpha: true,
        showBeta: true,
        showGamma: true,
        showDelta: true,
      },
    };
    return configs[mode] || configs.full;
  }, [mode]);

  const containerStyle = useMemo(
    () => ({
      padding: "20px",
      borderRadius: "12px",
      backgroundColor: settings?.dark ? "#0f172a" : "#f8fafc",
      color: settings?.dark ? "#f1f5f9" : "#1e293b",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      ...(style || {}),
    }),
    [settings?.dark, style]
  );

  const alphaComponents = useMemo(() => {
    if (!modeConfig.showAlpha || !data) return null;

    const dataArray = Array.isArray(data) ? data : [data];
    return _r(dataArray.length, (i) => (
      <SubComponentAlpha
        key={`alpha-${i}-${internalState.version}`}
        data={dataArray[i]}
        onUpdate={handleSubUpdate}
        idx={i}
        parentRef={mainRef}
        config={config?.alpha}
      />
    ));
  }, [
    modeConfig.showAlpha,
    data,
    config?.alpha,
    internalState.version,
    handleSubUpdate,
  ]);

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
  }, [
    modeConfig.showGamma,
    source,
    filter,
    mapper,
    reducer,
    initialValue,
    handleGammaResult,
  ]);

  const deltaComponent = useMemo(() => {
    if (!modeConfig.showDelta) return null;
    return (
      <div className="mb-4">
        <div className="text-xs font-bold uppercase text-emerald-500 mb-3 tracking-widest pl-1">
          Historical Form State
        </div>
        <SubComponentDelta
          initialData={
            data && typeof data === "object" && !Array.isArray(data) ? data : {}
          }
          schema={schema}
          validators={validators}
          onChange={handleDeltaChange}
        />
      </div>
    );
  }, [modeConfig.showDelta, data, schema, validators, handleDeltaChange]);

  const contextValue = useMemo(
    () => ({
      borderColor: settings?.borderColor || "#e2e8f0",
      theme: settings?.theme || "light",
    }),
    [settings?.borderColor, settings?.theme]
  );

  const qContext = useMemo(
    () => ({
      q: contextQ,
      w: setContextQ,
    }),
    [contextQ]
  );

  return (
    <_0x4f2a.Provider value={contextValue}>
      <_0x7b3c.Provider value={qContext}>
        <div
          className={`chaotic-component ${className || ""}`}
          style={containerStyle}
          ref={(el) => {
            if (el) mainRef.current.el = el;
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
                MODE: {mode || "FULL"}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                SIG_Q: {contextQ}
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
      </_0x7b3c.Provider>
    </_0x4f2a.Provider>
  );
};

export default ChaoticComponent;
export {
  SubComponentAlpha,
  SubComponentBeta,
  SubComponentGamma,
  SubComponentDelta,
};
