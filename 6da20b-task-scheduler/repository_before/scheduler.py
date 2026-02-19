import json
from datetime import datetime, timedelta


with open("task.json") as f:
    tasks = json.load(f)


schedule = {}
day = 1  

def find_time_for_task(task):
    
    earliest = task.get("earliest", 0)
    latest = task.get("latest", 24)
    
    
    if task.get("after") and task["after"] in schedule:
        dep_end = schedule[task["after"]][1]
        earliest = max(earliest, dep_end)
    
    
    if task.get("not_same_day_as") and task["not_same_day_as"] in schedule:
        dep_day = schedule[task["not_same_day_as"]][2]
        return find_time_for_task({**task, "earliest": earliest, "latest": latest, "day": dep_day + 1})
    
    
    start = earliest
    end = start + task["duration"]
    if end > latest:
        return None  # cannot fit in window
    return (start, end, task.get("day", day))


for task in tasks:
    result = find_time_for_task(task)
    if result:
        schedule[task["name"]] = result
    else:
        print(f"Cannot schedule task {task['name']} due to constraints.")


print("\nFinal Schedule:")
for name, (start, end, day) in schedule.items():
    print(f"{name} -> Day {day}, {start}:00 to {end}:00")
