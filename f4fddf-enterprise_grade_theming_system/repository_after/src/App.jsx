import React from 'react';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div 
      style={{ 
        minHeight: '100vh', 
        backgroundColor: 'var(--bg-primary)', 
        color: 'var(--text-primary)',
        transition: 'background-color var(--transition-speed) var(--transition-bezier)'
      }}
    >
      <Dashboard />
    </div>
  );
}

export default App;
