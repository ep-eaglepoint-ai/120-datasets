/**
 * TaskList - Container for displaying filtered task items.
 */

import TaskItem from './TaskItem.jsx';

export function TaskList({ 
  tasks, 
  filter,
  onToggle, 
  onDelete, 
  onUpdate,
  pendingTaskIds = new Set()
}) {
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true; // 'all'
  });

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // Then by priority
    const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    if (priorityDiff !== 0) return priorityDiff;
    // Then by creation date (newest first)
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  if (sortedTasks.length === 0) {
    return (
      <div className="task-list-empty">
        <div className="empty-icon">
          {filter === 'completed' ? '🎉' : filter === 'active' ? '✨' : '📋'}
        </div>
        <div className="empty-title">
          {filter === 'all' && 'No tasks yet'}
          {filter === 'active' && 'All caught up!'}
          {filter === 'completed' && 'No completed tasks'}
        </div>
        <div className="empty-subtitle">
          {filter === 'all' && 'Add a task to get started'}
          {filter === 'active' && 'Time to add more tasks'}
          {filter === 'completed' && 'Complete some tasks to see them here'}
        </div>
      </div>
    );
  }

  return (
    <div className="task-list">
      {sortedTasks.map((task, index) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          isPending={pendingTaskIds.has(task.id) || task.id.startsWith('local_')}
          style={{ '--item-index': index }}
        />
      ))}
    </div>
  );
}

export default TaskList;
