from typing import List, Tuple
from dataclasses import dataclass
from enum import Enum


class EventType(Enum):
    ENTER = 1
    EXIT = 2


@dataclass
class Event:
    """Sweep line event representing vertical boundary of a square."""
    x: float
    event_type: EventType
    y_start: float
    y_end: float
    
    def __lt__(self, other):
        if self.x != other.x:
            return self.x < other.x
        return self.event_type.value > other.event_type.value


class IntervalSet:
    """Efficiently manage and merge overlapping y-intervals."""
    
    def __init__(self):
        self.intervals: List[Tuple[float, float]] = []
    
    def merge_intervals(self) -> List[Tuple[float, float]]:
        """Merge overlapping intervals and return sorted list."""
        if not self.intervals:
            return []
        
        sorted_intervals = sorted(self.intervals)
        merged = [sorted_intervals[0]]
        
        for current_start, current_end in sorted_intervals[1:]:
            last_start, last_end = merged[-1]
            
            if current_start <= last_end:
                merged[-1] = (last_start, max(last_end, current_end))
            else:
                merged.append((current_start, current_end))
        
        return merged


class SweepLineSolver:
    """Sweep line algorithm for computing union area efficiently."""
    
    def __init__(self, squares: List[List[int]], clip_y: float = None):
        self.squares = squares
        self.clip_y = clip_y
        self.events = self._build_events()
    
    def _build_events(self) -> List[Event]:
        """Build sorted event list from squares - O(n log n) preprocessing."""
        events = []
        
        for x, y, side in self.squares:
            y_bottom = y
            y_top = y + side
            
            if self.clip_y is not None:
                if y_bottom >= self.clip_y:
                    continue
                y_top = min(y_top, self.clip_y)
            
            if y_bottom >= y_top:
                continue
            
            x_left = x
            x_right = x + side
            
            events.append(Event(x_left, EventType.ENTER, y_bottom, y_top))
            events.append(Event(x_right, EventType.EXIT, y_bottom, y_top))
        
        return sorted(events)
    
    def compute_area(self) -> float:
        """Compute total union area using sweep line - O(n log n)."""
        if not self.events:
            return 0.0
        
        total_area = 0.0
        active_intervals: List[Tuple[float, float]] = []
        prev_x = self.events[0].x
        
        for event in self.events:
            current_x = event.x
            
            if current_x > prev_x and active_intervals:
                width = current_x - prev_x
                height = self._compute_merged_height(active_intervals)
                total_area += width * height
            
            if event.event_type == EventType.ENTER:
                active_intervals.append((event.y_start, event.y_end))
            else:
                try:
                    active_intervals.remove((event.y_start, event.y_end))
                except ValueError:
                    pass
            
            prev_x = current_x
        
        return total_area
    
    def _compute_merged_height(self, intervals: List[Tuple[float, float]]) -> float:
        """Compute total height of merged overlapping intervals."""
        if not intervals:
            return 0.0
        
        sorted_intervals = sorted(intervals)
        merged = [sorted_intervals[0]]
        
        for start, end in sorted_intervals[1:]:
            last_start, last_end = merged[-1]
            if start <= last_end:
                merged[-1] = (last_start, max(last_end, end))
            else:
                merged.append((start, end))
        
        return sum(end - start for start, end in merged)


def find_split_line(squares: List[List[int]]) -> float:
    """Find horizontal line that splits union of squares into equal areas using sweep line algorithm."""
    if not squares:
        return 0.0
    
    if not all(isinstance(sq, list) and len(sq) == 3 for sq in squares):
        raise ValueError("Each square must be a list of 3 values: [x, y, side_length]")
    
    if len(squares) == 1:
        x, y, side = squares[0]
        return y + side / 2.0
    
    solver = SweepLineSolver(squares)
    total_area = solver.compute_area()
    
    if total_area == 0:
        return 0.0
    
    target_area = total_area / 2.0
    
    y_min = min(y for x, y, side in squares)
    y_max = max(y + side for x, y, side in squares)
    
    tolerance = 1e-5
    left, right = y_min, y_max
    best_y = (left + right) / 2.0
    
    max_iterations = 100
    
    for iteration in range(max_iterations):
        mid = (left + right) / 2.0
        
        area_below = compute_area_below_line(squares, mid)
        diff = abs(area_below - target_area)
        
        if diff < tolerance * total_area:
            best_y = mid
            break
        
        if area_below < target_area:
            left = mid
        else:
            right = mid
        
        best_y = mid
        
        if right - left < tolerance:
            break
    
    return best_y


def compute_area_below_line(squares: List[List[int]], split_y: float) -> float:
    """Compute union area of squares below given y-coordinate using clipped sweep line."""
    solver = SweepLineSolver(squares, clip_y=split_y)
    return solver.compute_area()
