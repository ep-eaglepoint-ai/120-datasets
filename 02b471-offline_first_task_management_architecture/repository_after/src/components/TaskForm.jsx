import { useState } from 'react';

const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#059669' },
  { value: 'medium', label: 'Medium', color: '#2563eb' },
  { value: 'high', label: 'High', color: '#ea580c' },
  { value: 'critical', label: 'Critical', color: '#dc2626' }
];

export function TaskForm({ onSubmit, disabled = false }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e) => {
    e?.preventDefault();
    
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    
    onSubmit(trimmedTitle, priority);
    setTitle('');
    setPriority('medium');
    setIsExpanded(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setTitle('');
      setIsExpanded(false);
    }
  };

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h3 className="form-title">Add New Task</h3>
      </div>
      
      <div className="form-body">
        {/* Title input */}
        <div className="input-row">
          <input
            type="text"
            className="task-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value && !isExpanded) setIsExpanded(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="What needs to be done?"
            disabled={disabled}
            autoComplete="off"
          />
          <button
            type="submit"
            className="submit-btn"
            disabled={disabled || !title.trim()}
          >
            <span className="btn-text">Add Task</span>
            <span className="btn-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
          </button>
        </div>

        {/* Priority selector (expanded) */}
        <div className={`priority-row ${isExpanded ? 'expanded' : ''}`}>
          <span className="priority-label">Priority:</span>
          <div className="priority-options">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                type="button"
                className={`priority-option ${priority === p.value ? 'selected' : ''}`}
                onClick={() => setPriority(p.value)}
                style={{ '--priority-color': p.color }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}

export default TaskForm;
