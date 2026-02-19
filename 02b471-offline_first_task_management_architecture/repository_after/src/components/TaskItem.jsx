import { useState } from 'react';

const PRIORITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#2563eb',
  low: '#059669'
};

export function TaskItem({ 
  task, 
  onToggle, 
  onDelete, 
  onUpdate,
  isPending = false 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [isDeleting, setIsDeleting] = useState(false);

  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

  const handleToggle = () => {
    onToggle(task.id);
  };

  const handleDelete = () => {
    if (isDeleting) {
      onDelete(task.id);
    } else {
      setIsDeleting(true);
      setTimeout(() => setIsDeleting(false), 3000);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditTitle(task.title);
  };

  const handleEditSave = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate(task.id, { title: trimmed });
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditTitle(task.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditSave();
    }
    if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  return (
    <div 
      className={`task-item ${task.completed ? 'completed' : ''} ${isPending ? 'pending' : ''}`}
    >
      {/* Checkbox */}
      <label className="checkbox-wrapper">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={handleToggle}
          className="task-checkbox"
        />
        <span className="checkbox-custom">
          {task.completed && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
      </label>

      {/* Task content */}
      <div className="task-content">
        {isEditing ? (
          <input
            type="text"
            className="edit-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleEditSave}
            autoFocus
          />
        ) : (
          <span 
            className="task-title" 
            onDoubleClick={handleEdit}
            title="Double-click to edit"
          >
            {task.title}
          </span>
        )}
        
        {/* Priority badge */}
        <span 
          className="priority-badge"
          style={{ 
            '--priority-color': priorityColor,
            backgroundColor: `${priorityColor}15`,
            color: priorityColor
          }}
        >
          {task.priority}
        </span>

        {/* Pending indicator */}
        {isPending && (
          <span className="pending-indicator" title="Pending sync">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        className={`delete-btn ${isDeleting ? 'confirm' : ''}`}
        onClick={handleDelete}
        title={isDeleting ? 'Click again to confirm' : 'Delete task'}
      >
        {isDeleting ? (
          <span className="delete-confirm">Confirm?</span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default TaskItem;
