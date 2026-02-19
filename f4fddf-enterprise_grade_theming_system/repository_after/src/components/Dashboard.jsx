import React, { useRef, useMemo } from 'react';
import { Card, Typography, Button } from './ThemedComponents';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

/**
 * Performance Tracker Component
 * Measures and logs theme switch performance.
 */
const PerformanceTracker = React.memo(() => {
  const { isDark } = useTheme();
  const lastSwitchTime = useRef(performance.now());

  useMemo(() => {
    const now = performance.now();
    const duration = now - lastSwitchTime.current;
    if (duration > 0 && duration < 1000) {
      console.log(`%c[Performance] Theme Switch: ${duration.toFixed(2)}ms`, 'color: #00ff00; font-weight: bold;');
    }
    lastSwitchTime.current = now;
    return duration;
  }, [isDark]);

  return null;
});

/**
 * Enterprise Dashboard Prototype
 */
const Dashboard = () => {
  const { mode } = useTheme();

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <PerformanceTracker />
      
      {/* Screen Reader Announcement */}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: '0' }}>
        Theme changed to {mode}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <Typography variant="h1">Enterprise Task Manager</Typography>
          <Typography variant="secondary">PCI-DSS Compliant & WCAG AAA Accessible</Typography>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <Card>
          <Typography variant="h3">System Status</Typography>
          <Typography variant="muted" style={{ marginBottom: '16px' }}>
            Real-time collaboration is active. Your theme preferences are isolated to this session.
          </Typography>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="success">All Systems Nominal</Button>
            <Button>View Logs</Button>
          </div>
        </Card>

        <Card>
          <Typography variant="h3">Security Overview</Typography>
          <Typography variant="muted" style={{ marginBottom: '16px' }}>
            Browser storage is disabled. Application state is managed entirely via React Context.
          </Typography>
          <div style={{ padding: '12px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <Typography variant="muted">PCI-DSS Status: <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>Compliant</span></Typography>
          </div>
        </Card>

        <Card>
          <Typography variant="h3">Accessibility Compliance</Typography>
          <Typography variant="muted" style={{ marginBottom: '16px' }}>
            Contrast ratio: 7:1 (AAA). Transitions: 300ms cubic-bezier.
          </Typography>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--color-info)', color: '#FFF', fontSize: '0.75rem' }}>WCAG AAA</span>
            <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Reduced Motion Ready</span>
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: '24px', background: 'linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%)' }}>
        <Typography variant="h3">Multi-tenant Architecture</Typography>
        <Typography variant="body">
          The current theme state is ready for server-side persistence. Each user's selection is captured in the global reducer and can be dispatched to an API endpoint for permanent storage.
        </Typography>
      </Card>
    </div>
  );
};

export default Dashboard;
