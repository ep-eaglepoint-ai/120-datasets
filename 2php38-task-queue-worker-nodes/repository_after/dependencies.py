"""Dependency management system with topological sorting and cycle detection."""
from __future__ import annotations

from collections import defaultdict, deque
from typing import Dict, List, Optional, Set, Tuple

from .models import Job, JobStatus


class CircularDependencyError(Exception):
    """Raised when circular dependencies are detected."""
    def __init__(self, cycle: List[str]):
        self.cycle = cycle
        super().__init__(f"Circular dependency detected: {' -> '.join(cycle)}")


class DependencyGraph:
    """Graph-based dependency management for jobs."""
    
    def __init__(self):
        self._dependencies: Dict[str, Set[str]] = defaultdict(set)
        self._dependents: Dict[str, Set[str]] = defaultdict(set)
        self._job_status: Dict[str, JobStatus] = {}
        self._jobs: Dict[str, Job] = {}
    
    def add_job(self, job: Job) -> None:
        """Add a job and its dependencies to the graph."""
        self._jobs[job.id] = job
        self._job_status[job.id] = job.status
        
        for dep_id in job.depends_on:
            self._dependencies[job.id].add(dep_id)
            self._dependents[dep_id].add(job.id)
    
    def remove_job(self, job_id: str) -> None:
        """Remove a job from the graph."""
        for dep_id in self._dependencies.get(job_id, set()):
            self._dependents[dep_id].discard(job_id)
        
        for dependent_id in self._dependents.get(job_id, set()):
            self._dependencies[dependent_id].discard(job_id)
        
        self._dependencies.pop(job_id, None)
        self._dependents.pop(job_id, None)
        self._job_status.pop(job_id, None)
        self._jobs.pop(job_id, None)
    
    def get_dependencies(self, job_id: str) -> Set[str]:
        """Get all jobs that this job depends on."""
        return self._dependencies.get(job_id, set()).copy()
    
    def get_dependents(self, job_id: str) -> Set[str]:
        """Get all jobs that depend on this job."""
        return self._dependents.get(job_id, set()).copy()
    
    def has_unmet_dependencies(self, job_id: str) -> bool:
        """Check if job has any incomplete dependencies."""
        for dep_id in self._dependencies.get(job_id, set()):
            status = self._job_status.get(dep_id)
            if status != JobStatus.COMPLETED:
                return True
        return False
    
    def get_unmet_dependencies(self, job_id: str) -> Set[str]:
        """Get IDs of incomplete dependencies."""
        unmet = set()
        for dep_id in self._dependencies.get(job_id, set()):
            status = self._job_status.get(dep_id)
            if status != JobStatus.COMPLETED:
                unmet.add(dep_id)
        return unmet
    
    def mark_completed(self, job_id: str) -> List[str]:
        """Mark job as completed and return newly runnable dependent jobs."""
        self._job_status[job_id] = JobStatus.COMPLETED
        
        runnable = []
        for dependent_id in self._dependents.get(job_id, set()):
            if not self.has_unmet_dependencies(dependent_id):
                runnable.append(dependent_id)
        
        return runnable
    
    def mark_failed(self, job_id: str) -> List[str]:
        """Mark job as failed and return affected dependent jobs."""
        self._job_status[job_id] = JobStatus.FAILED
        return list(self._dependents.get(job_id, set()))
    
    def update_status(self, job_id: str, status: JobStatus) -> None:
        """Update job status."""
        self._job_status[job_id] = status
    
    def detect_cycle(self, job_id: str, new_dependencies: List[str]) -> Optional[List[str]]:
        """Detect if adding dependencies would create a cycle."""
        temp_deps = self._dependencies.copy()
        temp_deps[job_id] = set(new_dependencies)
        
        visited = set()
        rec_stack = set()
        path = []
        
        def dfs(node: str) -> Optional[List[str]]:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in temp_deps.get(node, set()):
                if neighbor not in visited:
                    result = dfs(neighbor)
                    if result:
                        return result
                elif neighbor in rec_stack:
                    cycle_start = path.index(neighbor)
                    return path[cycle_start:] + [neighbor]
            
            path.pop()
            rec_stack.remove(node)
            return None
        
        for node in list(temp_deps.keys()):
            if node not in visited:
                cycle = dfs(node)
                if cycle:
                    return cycle
        
        return None
    
    def validate_dependencies(self, job: Job) -> None:
        """Validate job dependencies, raising error if invalid."""
        if not job.depends_on:
            return
        
        cycle = self.detect_cycle(job.id, job.depends_on)
        if cycle:
            raise CircularDependencyError(cycle)
    
    def topological_sort(self) -> List[str]:
        """Return jobs in topological order (dependencies first)."""
        in_degree = defaultdict(int)
        
        for job_id in self._jobs:
            if job_id not in in_degree:
                in_degree[job_id] = 0
            for dep_id in self._dependencies.get(job_id, set()):
                in_degree[job_id] += 1
        
        queue = deque([job_id for job_id, degree in in_degree.items() if degree == 0])
        result = []
        
        while queue:
            job_id = queue.popleft()
            result.append(job_id)
            
            for dependent_id in self._dependents.get(job_id, set()):
                in_degree[dependent_id] -= 1
                if in_degree[dependent_id] == 0:
                    queue.append(dependent_id)
        
        if len(result) != len(self._jobs):
            raise CircularDependencyError(["cycle detected in graph"])
        
        return result
    
    def get_ready_jobs(self) -> List[str]:
        """Get all jobs that are ready to run (no unmet dependencies)."""
        ready = []
        for job_id, status in self._job_status.items():
            if status == JobStatus.PENDING and not self.has_unmet_dependencies(job_id):
                ready.append(job_id)
        return ready
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID."""
        return self._jobs.get(job_id)
    
    def get_all_jobs(self) -> List[Job]:
        """Get all jobs in the graph."""
        return list(self._jobs.values())
    
    def clear(self) -> None:
        """Clear all jobs from the graph."""
        self._dependencies.clear()
        self._dependents.clear()
        self._job_status.clear()
        self._jobs.clear()


class DependencyResolver:
    """High-level dependency resolution with batch operations."""
    
    def __init__(self, graph: Optional[DependencyGraph] = None):
        self._graph = graph or DependencyGraph()
    
    @property
    def graph(self) -> DependencyGraph:
        return self._graph
    
    def submit_job(self, job: Job) -> Tuple[bool, Optional[str]]:
        """Submit a job with dependency validation."""
        try:
            self._graph.validate_dependencies(job)
            self._graph.add_job(job)
            return True, None
        except CircularDependencyError as e:
            return False, str(e)
    
    def submit_batch(self, jobs: List[Job]) -> Tuple[List[str], List[Tuple[str, str]]]:
        """Submit multiple jobs, returning (successful_ids, failed_pairs)."""
        temp_graph = DependencyGraph()
        
        for job in jobs:
            temp_graph.add_job(job)
        
        try:
            temp_graph.topological_sort()
        except CircularDependencyError as e:
            return [], [(j.id, str(e)) for j in jobs]
        
        successful = []
        failed = []
        
        for job in jobs:
            success, error = self.submit_job(job)
            if success:
                successful.append(job.id)
            else:
                failed.append((job.id, error))
        
        return successful, failed
    
    def complete_job(self, job_id: str) -> List[Job]:
        """Mark job completed and return newly runnable jobs."""
        runnable_ids = self._graph.mark_completed(job_id)
        return [self._graph.get_job(jid) for jid in runnable_ids if self._graph.get_job(jid)]
    
    def fail_job(self, job_id: str) -> List[Job]:
        """Mark job failed and return affected dependent jobs."""
        affected_ids = self._graph.mark_failed(job_id)
        return [self._graph.get_job(jid) for jid in affected_ids if self._graph.get_job(jid)]
    
    def get_execution_order(self) -> List[Job]:
        """Get jobs in dependency-respecting execution order."""
        order = self._graph.topological_sort()
        return [self._graph.get_job(jid) for jid in order if self._graph.get_job(jid)]
    
    def is_ready(self, job_id: str) -> bool:
        """Check if job is ready to execute."""
        return not self._graph.has_unmet_dependencies(job_id)
    
    def get_ready_jobs(self) -> List[Job]:
        """Get all jobs ready for execution."""
        ready_ids = self._graph.get_ready_jobs()
        return [self._graph.get_job(jid) for jid in ready_ids if self._graph.get_job(jid)]
