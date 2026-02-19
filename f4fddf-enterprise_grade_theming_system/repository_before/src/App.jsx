import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const themes = {
  light: {
    name: 'light',
    primary: '#007bff',
    secondary: '#6c757d',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#212529',
    textSecondary: '#6c757d',
    border: '#dee2e6',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    chartColors: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8']
  },
  dark: {
    name: 'dark',
    primary: '#0d6efd',
    secondary: '#6c757d',
    background: '#1a1a1a',
    surface: '#2d2d2d',
    text: '#f8f9fa',
    textSecondary: '#adb5bd',
    border: '#495057',
    success: '#198754',
    warning: '#ffc107',
    danger: '#dc3545',
    chartColors: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0']
  },
  highContrast: {
    name: 'highContrast',
    primary: '#0000ff',
    secondary: '#000000',
    background: '#ffffff',
    surface: '#f0f0f0',
    text: '#000000',
    textSecondary: '#333333',
    border: '#000000',
    success: '#008000',
    warning: '#ffff00',
    danger: '#ff0000',
    chartColors: ['#0000ff', '#008000', '#ffff00', '#ff0000', '#00ffff']
  }
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('light');
  const [fontSize, setFontSize] = useState(14);
  const [colorBlindMode, setColorBlindMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  const value = {
    theme: themes[currentTheme],
    currentTheme,
    setCurrentTheme,
    fontSize,
    setFontSize,
    colorBlindMode,
    setColorBlindMode,
    animationsEnabled,
    setAnimationsEnabled,
    getColor: (colorKey) => themes[currentTheme][colorKey],
    applyTheme: (element) => {
      if (element) {
        element.style.background = themes[currentTheme].background;
        element.style.color = themes[currentTheme].text;
      }
    }
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};


const PerformanceChart = () => {
  const { theme } = useTheme(); 
  const renderCount = useRef(0);
  renderCount.current++;

  const generateChartData = () => {
    const start = performance.now();
    const data = [];
    for (let i = 0; i < 1000; i++) {
      const value = Math.sin(i / 10) * 50 + Math.random() * 20;
      data.push({ x: i, y: value });
    }
    while (performance.now() - start < 100) {}
    return data;
  };

  const chartData = generateChartData();
  
  const points = chartData
    .filter((_, i) => i % 10 === 0)
    .map(d => `${d.x * 0.5},${150 - d.y}`)
    .join(' ');

  return (
    <div className="chart-container" style={{ background: theme.surface }}>
      <div className="chart-header">
        <h3 style={{ color: theme.text }}>Performance Metrics</h3>
        <span className="render-badge critical">Renders: {renderCount.current}</span>
      </div>
      <svg width="500" height="200" style={{ background: theme.background }}>
        <polyline
          points={points}
          fill="none"
          stroke={theme.chartColors[0]}
          strokeWidth="2"
        />
        {chartData.filter((_, i) => i % 50 === 0).map((d, i) => (
          <circle
            key={i}
            cx={d.x * 0.5}
            cy={150 - d.y}
            r="3"
            fill={theme.chartColors[1]}
          />
        ))}
      </svg>
    </div>
  );
};

const CodeEditor = () => {
  const { theme, fontSize } = useTheme(); 
  const renderCount = useRef(0);
  renderCount.current++;

  const highlightCode = (code) => {
    const start = performance.now();
    const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else'];
    let highlighted = code;
    
    for (let i = 0; i < 100; i++) {
      keywords.forEach(keyword => {
        highlighted = highlighted.replace(
          new RegExp(`\\b${keyword}\\b`, 'g'),
          `<span class="keyword">${keyword}</span>`
        );
      });
    }
    
    while (performance.now() - start < 80) {}
    return highlighted;
  };

  const sampleCode = `const myFunction = () => {
  const data = fetchData();
  if (data) {
    return processData(data);
  }
  return null;
};`;

  highlightCode(sampleCode);

  return (
    <div className="editor-container" style={{ background: theme.surface }}>
      <div className="editor-header">
        <h3 style={{ color: theme.text }}>Code Editor</h3>
        <span className="render-badge critical">Renders: {renderCount.current}</span>
      </div>
      <div 
        className="code-content"
        style={{ 
          background: theme.background,
          color: theme.text,
          fontSize: `${fontSize}px`,
          border: `1px solid ${theme.border}`
        }}
      >
        <pre>{sampleCode}</pre>
      </div>
    </div>
  );
};

const DataTable = () => {
  const { theme } = useTheme();
  const renderCount = useRef(0);
  renderCount.current++;

  const generateData = () => {
    const start = performance.now();
    const data = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      status: i % 3 === 0 ? 'active' : 'inactive',
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
    }));
    
    while (performance.now() - start < 50) {}
    return data;
  };

  const data = generateData();

  return (
    <div className="table-container" style={{ background: theme.surface }}>
      <div className="table-header">
        <h3 style={{ color: theme.text }}>User Data</h3>
        <span className="render-badge critical">Renders: {renderCount.current}</span>
      </div>
      <table style={{ background: theme.background, borderColor: theme.border }}>
        <thead style={{ background: theme.surface }}>
          <tr>
            <th style={{ color: theme.text, borderColor: theme.border }}>ID</th>
            <th style={{ color: theme.text, borderColor: theme.border }}>Name</th>
            <th style={{ color: theme.text, borderColor: theme.border }}>Email</th>
            <th style={{ color: theme.text, borderColor: theme.border }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map(row => (
            <tr key={row.id}>
              <td style={{ color: theme.text, borderColor: theme.border }}>{row.id}</td>
              <td style={{ color: theme.text, borderColor: theme.border }}>{row.name}</td>
              <td style={{ color: theme.textSecondary, borderColor: theme.border }}>{row.email}</td>
              <td style={{ borderColor: theme.border }}>
                <span style={{ 
                  color: row.status === 'active' ? theme.success : theme.textSecondary 
                }}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ThemeToggle = () => {
  const { currentTheme, setCurrentTheme, theme } = useTheme();
  const renderCount = useRef(0);
  renderCount.current++;

  return (
    <div className="theme-toggle" style={{ background: theme.surface, borderColor: theme.border }}>
      <h3 style={{ color: theme.text }}>Theme Settings</h3>
      <span className="render-badge good">Renders: {renderCount.current}</span>
      
      <div className="button-group">
        <button
          onClick={() => setCurrentTheme('light')}
          className={currentTheme === 'light' ? 'active' : ''}
          style={{
            background: currentTheme === 'light' ? theme.primary : theme.background,
            color: currentTheme === 'light' ? '#fff' : theme.text,
            borderColor: theme.border
          }}
        >
          ☀️ Light
        </button>
        <button
          onClick={() => setCurrentTheme('dark')}
          className={currentTheme === 'dark' ? 'active' : ''}
          style={{
            background: currentTheme === 'dark' ? theme.primary : theme.background,
            color: currentTheme === 'dark' ? '#fff' : theme.text,
            borderColor: theme.border
          }}
        >
          🌙 Dark
        </button>
        <button
          onClick={() => setCurrentTheme('highContrast')}
          className={currentTheme === 'highContrast' ? 'active' : ''}
          style={{
            background: currentTheme === 'highContrast' ? theme.primary : theme.background,
            color: currentTheme === 'highContrast' ? '#fff' : theme.text,
            borderColor: theme.border
          }}
        >
          ⚡ High Contrast
        </button>
      </div>
    </div>
  );
};


const Dashboard = () => {
  const { theme } = useTheme();
  const [totalRerenders, setTotalRerenders] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTotalRerenders(prev => prev + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard" style={{ background: theme.background, color: theme.text }}>
      <div className="dashboard-grid">
        <div className="col-1">
          <ThemeToggle />
        </div>
        <div className="col-2">
          <PerformanceChart />
          <CodeEditor />
        </div>
        <div className="col-3">
          <DataTable />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <div className="app">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .app {
          min-height: 100vh;
          padding: 20px;
        }
        
        .warning-banner {
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
          color: white;
          padding: 24px;
          border-radius: 8px;
          margin-bottom: 24px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .warning-banner h2 {
          margin-bottom: 12px;
          font-size: 20px;
        }
        
        .warning-banner p {
          margin-bottom: 8px;
          line-height: 1.6;
        }
        
        .warning-banner ul {
          margin: 12px 0 12px 24px;
        }
        
        .warning-banner li {
          margin-bottom: 6px;
        }
        
        .warning-banner strong {
          background: rgba(0,0,0,0.2);
          padding: 2px 8px;
          border-radius: 4px;
        }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: 300px 1fr 400px;
          gap: 20px;
        }
        
        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .chart-container, .editor-container, .table-container, .theme-toggle {
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        
        .chart-header, .editor-header, .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .chart-header h3, .editor-header h3, .table-header h3, .theme-toggle h3 {
          font-size: 16px;
          margin: 0;
        }
        
        .render-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
        }
        
        .render-badge.critical {
          background: #dc3545;
          color: white;
          animation: pulse 1s infinite;
        }
        
        .render-badge.good {
          background: #28a745;
          color: white;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        
        svg {
          border-radius: 4px;
        }
        
        .code-content {
          padding: 16px;
          border-radius: 4px;
          overflow-x: auto;
        }
        
        .code-content pre {
          margin: 0;
          font-family: 'Monaco', 'Courier New', monospace;
          line-height: 1.5;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          border-radius: 4px;
          overflow: hidden;
        }
        
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid;
        }
        
        th {
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        td {
          font-size: 14px;
        }
        
        .button-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 16px;
        }
        
        .button-group button {
          padding: 12px 20px;
          border: 2px solid;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        .button-group button:hover {
          transform: translateX(4px);
        }
      `}</style>
      
      <ThemeProvider>
        <Dashboard />
      </ThemeProvider>
    </div>
  );
}