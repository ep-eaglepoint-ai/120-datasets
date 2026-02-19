import React, { useState } from 'react';

export default function TaskManagerApp() {
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Review pull requests', completed: false, priority: 'high' },
    { id: 2, title: 'Update documentation', completed: true, priority: 'low' },
    { id: 3, title: 'Fix bug in payment module', completed: false, priority: 'critical' }
  ]);
  const [newTask, setNewTask] = useState('');
  const [filter, setFilter] = useState('all');

  const addTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, { 
        id: Date.now(), 
        title: newTask, 
        completed: false,
        priority: 'medium'
      }]);
      setNewTask('');
    }
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#2563eb',
      low: '#059669'
    };
    return colors[priority] || colors.medium;
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      {/* Header with gradient */}
      <header style={{
        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
        padding: '24px 40px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            color: '#ffffff',
            fontWeight: '700',
            letterSpacing: '-0.5px'
          }}>
            Task Manager Pro
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.8)'
          }}>
            Manage your tasks efficiently
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <div style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            color: '#ffffff',
            fontSize: '13px',
            backdropFilter: 'blur(10px)'
          }}>
            {tasks.filter(t => !t.completed).length} active
          </div>
          <div style={{
            padding: '8px 16px',
            background: 'rgba(0,0,0,0.1)',
            borderRadius: '4px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '13px'
          }}>
            Theme toggle needed here
          </div>
        </div>
      </header>

      {/* Filters */}
      <div style={{
        maxWidth: '800px',
        margin: '24px auto 0',
        padding: '0 20px'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          background: '#ffffff',
          padding: '8px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          width: 'fit-content'
        }}>
          {['all', 'active', 'completed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 20px',
                fontSize: '14px',
                fontWeight: '600',
                background: filter === f 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : 'transparent',
                color: filter === f ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main style={{
        maxWidth: '800px',
        margin: '24px auto',
        padding: '0 20px'
      }}>
        {/* Add Task Form */}
        <div style={{
          background: '#ffffff',
          padding: '28px',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          marginBottom: '24px',
          border: '1px solid rgba(0,0,0,0.05)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b'
          }}>
            Add New Task
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTask()}
              placeholder="What needs to be done?"
              style={{
                flex: 1,
                padding: '14px 18px',
                fontSize: '15px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                outline: 'none',
                color: '#1e293b',
                background: '#f8fafc',
                transition: 'all 0.2s'
              }}
            />
            <button
              onClick={addTask}
              style={{
                padding: '14px 28px',
                fontSize: '15px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              Add Task
            </button>
          </div>
        </div>

        {/* Task List */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.05)'
        }}>
          {filteredTasks.length === 0 ? (
            <div style={{
              padding: '64px 32px',
              textAlign: 'center',
              color: '#94a3b8'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <div style={{ fontSize: '16px', fontWeight: '500' }}>
                {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
              </div>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>
                {filter === 'all' ? 'Add one to get started!' : 'Try a different filter'}
              </div>
            </div>
          ) : (
            filteredTasks.map((task, index) => (
              <div
                key={task.id}
                style={{
                  padding: '20px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  borderBottom: index < filteredTasks.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: task.completed ? '#f8fafc' : '#ffffff',
                  transition: 'all 0.2s'
                }}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  style={{
                    width: '22px',
                    height: '22px',
                    cursor: 'pointer',
                    accentColor: '#667eea'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '15px',
                    color: task.completed ? '#94a3b8' : '#1e293b',
                    textDecoration: task.completed ? 'line-through' : 'none',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    {task.title}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '12px',
                    background: `${getPriorityColor(task.priority)}15`,
                    color: getPriorityColor(task.priority),
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {task.priority}
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        {/* Stats Footer */}
        <div style={{
          marginTop: '24px',
          padding: '20px 28px',
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '14px',
          color: '#64748b',
          border: '1px solid rgba(255,255,255,0.5)'
        }}>
          <div>
            <strong>{tasks.length}</strong> total tasks
          </div>
          <div>
            <strong>{tasks.filter(t => t.completed).length}</strong> completed
          </div>
          <div>
            <strong>{tasks.filter(t => !t.completed).length}</strong> remaining
          </div>
        </div>
      </main>
    </div>
  );
}