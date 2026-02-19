import json
import os
from datetime import datetime, timedelta

# Fix 1: Use path relative to script location
script_dir = os.path.dirname(os.path.abspath(__file__))
task_file = os.path.join(script_dir, "task.json")

# Load tasks with error handling
try:
    with open(task_file) as f:
        tasks = json.load(f)
except FileNotFoundError:
    print(f"Error: task.json not found at {task_file}")
    exit(1)
except json.JSONDecodeError as e:
    print(f"Error: Invalid JSON in task.json: {e}")
    exit(1)

def schedule_tasks(tasks):
    """
    Schedule tasks across multiple days respecting all constraints.
    Returns a dict mapping task names to (start, end, day) tuples.
    """
    schedule = {}
    
    # Validate and normalize task data
    for task in tasks:
        # Check required fields
        if "name" not in task:
            print("Error: Task missing 'name' field")
            return None
        if "duration" not in task:
            print(f"Error: Task '{task['name']}' missing 'duration' field")
            return None
            
        # Fix 2: Handle null values properly - use 0/24 for None values
        task["earliest"] = task.get("earliest") if task.get("earliest") is not None else 0
        task["latest"] = task.get("latest") if task.get("latest") is not None else 24
        
        # Validate time constraints
        if task["earliest"] < 0 or task["latest"] > 24:
            print(f"Error: Task '{task['name']}' has invalid time window")
            return None
        if task["earliest"] >= task["latest"]:
            print(f"Error: Task '{task['name']}' earliest >= latest")
            return None
        if task["duration"] > (task["latest"] - task["earliest"]):
            print(f"Error: Task '{task['name']}' duration doesn't fit in time window")
            return None
    
    # Check for circular dependencies
    def has_circular_dependency(task_name, visited=None):
        """Check if a task has circular 'after' dependencies"""
        if visited is None:
            visited = set()
        if task_name in visited:
            return True
        visited.add(task_name)
        
        task = next((t for t in tasks if t["name"] == task_name), None)
        if task and task.get("after"):
            return has_circular_dependency(task["after"], visited)
        return False
    
    for task in tasks:
        if task.get("after") and has_circular_dependency(task["name"]):
            print(f"Error: Circular dependency detected for task '{task['name']}'")
            return None
    
    def find_time_for_task(task, current_day=1, visited_for_recursion=None):
        """
        Find a valid time slot for a task.
        Returns (start, end, day) tuple or None if cannot schedule.
        """
        # Fix 3: Prevent infinite recursion by tracking which constraints we've processed
        if visited_for_recursion is None:
            visited_for_recursion = set()
        
        earliest = task["earliest"]
        latest = task["latest"]
        
        # Handle "after" constraint: task must start after dependency completes
        if task.get("after"):
            if task["after"] not in schedule:
                print(f"  Warning: Dependency '{task['after']}' not yet scheduled for '{task['name']}'")
                return None
            dep_end, dep_end_time, dep_day = schedule[task["after"]]
            
            # If dependency is on same day, start must be after it ends
            if dep_day == current_day:
                earliest = max(earliest, dep_end_time)
            # If dependency is on earlier day, can use original earliest time
            elif dep_day < current_day:
                earliest = task["earliest"]
            # If dependency is on later day, need to move to that day or later
            else:
                current_day = dep_day
                earliest = task["earliest"]
        
        # Fix 3: Handle "not_same_day_as" constraint without infinite recursion
        if task.get("not_same_day_as"):
            if task["not_same_day_as"] in schedule:
                dep_day = schedule[task["not_same_day_as"]][2]
                
                # If we're trying to schedule on same day as the constraint task, move to next day
                if current_day == dep_day:
                    # Track we've moved days to prevent infinite loops (max 100 days)
                    if current_day > 100:
                        print(f"  Error: Could not schedule '{task['name']}' within reasonable timeframe")
                        return None
                    
                    print(f"  Moving '{task['name']}' to day {current_day + 1} (not_same_day_as '{task['not_same_day_as']}')")
                    return find_time_for_task(task, current_day + 1, visited_for_recursion)
        
        # Fix 4: Check if task fits in the time window
        start = earliest
        end = start + task["duration"]
        
        if end > latest:
            # Doesn't fit on current day, try next day
            print(f"  Task '{task['name']}' doesn't fit on day {current_day}, trying day {current_day + 1}")
            return find_time_for_task(task, current_day + 1, visited_for_recursion)
        
        return (start, end, current_day)
    
    # Schedule each task
    print("Scheduling process:")
    for task in tasks:
        print(f"\nScheduling '{task['name']}'...")
        result = find_time_for_task(task)
        
        if result:
            schedule[task["name"]] = result
            print(f"  ✓ Scheduled '{task['name']}' on Day {result[2]}, {result[0]}:00 to {result[1]}:00")
        else:
            print(f"  ✗ Cannot schedule task '{task['name']}' due to constraints.")
    
    return schedule

# Execute scheduling
schedule = schedule_tasks(tasks)

# Display final schedule
if schedule:
    print("\n" + "="*50)
    print("Final Schedule:")
    print("="*50)
    
    # Sort by day then start time
    sorted_schedule = sorted(schedule.items(), key=lambda x: (x[1][2], x[1][0]))
    
    for name, (start, end, day) in sorted_schedule:
        print(f"Day {day}: {name} -> {start}:00 to {end}:00")
else:
    print("\nScheduling failed.")
    exit(1)
