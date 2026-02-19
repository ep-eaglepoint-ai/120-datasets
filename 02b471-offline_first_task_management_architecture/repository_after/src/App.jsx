import { useState, useMemo } from 'react';
import { useOfflineStore } from './hooks/useOfflineStore.js';
import { useNetworkStatus } from './hooks/useNetworkStatus.js';
import { SyncStatusIndicator } from './components/SyncStatusIndicator.jsx';
import { NetworkStatusBanner } from './components/NetworkStatusBanner.jsx';
import { TaskForm } from './components/TaskForm.jsx';
import { TaskList } from './components/TaskList.jsx';
import './index.css';

// Filter options
const FILTERS = ['all', 'active', 'completed'];

function App() {
  const [filter, setFilter] = useState('all');
  
  // Offline-first store
  const {
    tasks,
    isLoading,
    isInitialized,
    syncState,
    pendingCount,
    failedCount,
    lastSyncTime,
    addTask,
    toggleTask,
    deleteTask,
    updateTask,
    retryFailedOps,
    hasPendingChanges
  } = useOfflineStore();

  // Network status
  const { isOnline } = useNetworkStatus();

  // Compute stats
  const stats = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length
  }), [tasks]);

  // Get pending task IDs for visual indicator
  const pendingTaskIds = useMemo(() => {
    return new Set(tasks.filter(t => t.id.startsWith('local_')).map(t => t.id));
  }, [tasks]);

  // Handle task creation
  const handleAddTask = async (title, priority) => {
    await addTask(title, priority);
  };

  // Loading state
  if (!isInitialized && isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading your tasks...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Network status banner */}
      <NetworkStatusBanner isOnline={isOnline} />

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">
              <span className="title-icon">✓</span>
              Task Manager Pro
            </h1>
            <p className="app-subtitle">
              {isOnline ? 'Online' : 'Offline'} — Your tasks sync automatically
            </p>
          </div>
          
          <div className="header-right">
            {/* Active tasks badge */}
            <div className="stat-badge">
              <span className="stat-count">{stats.active}</span>
              <span className="stat-label">active</span>
            </div>
            
            {/* Sync status */}
            <SyncStatusIndicator
              syncState={syncState}
              pendingCount={pendingCount}
              failedCount={failedCount}
              lastSyncTime={lastSyncTime}
              onRetry={retryFailedOps}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="app-main">
        <div className="container">
          {/* Filter tabs */}
          <div className="filter-bar">
            <div className="filter-tabs">
              {FILTERS.map(f => (
                <button
                  key={f}
                  className={`filter-tab ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                  {f === 'active' && stats.active > 0 && (
                    <span className="filter-count">{stats.active}</span>
                  )}
                  {f === 'completed' && stats.completed > 0 && (
                    <span className="filter-count">{stats.completed}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Task form */}
          <TaskForm 
            onSubmit={handleAddTask}
            disabled={isLoading}
          />

          {/* Task list */}
          <div className="task-list-container">
            <TaskList
              tasks={tasks}
              filter={filter}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onUpdate={updateTask}
              pendingTaskIds={pendingTaskIds}
            />
          </div>

          {/* Stats footer */}
          <footer className="stats-footer">
            <div className="stat-item">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-name">total</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">{stats.completed}</span>
              <span className="stat-name">completed</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">{stats.active}</span>
              <span className="stat-name">remaining</span>
            </div>
            {hasPendingChanges && (
              <>
                <div className="stat-divider"></div>
                <div className="stat-item pending">
                  <span className="stat-value">{pendingCount}</span>
                  <span className="stat-name">pending sync</span>
                </div>
              </>
            )}
          </footer>
        </div>
      </main>

      {/* Offline indicator (fixed) */}
      {!isOnline && (
        <div className="offline-indicator">
          <span className="offline-dot"></span>
          Working Offline
        </div>
      )}
    </div>
  );
}

export default App;
