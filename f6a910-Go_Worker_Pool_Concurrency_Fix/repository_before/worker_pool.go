package main

import (
	"context"
	"sync"
)

type Task func() error

type WorkerPool struct {
	workers   int
	taskQueue chan Task
	results   map[int]error
	wg        sync.WaitGroup
}

func NewWorkerPool(workers int) *WorkerPool {
	return &WorkerPool{
		workers:   workers,
		taskQueue: make(chan Task),
		results:   make(map[int]error),
	}
}

func (wp *WorkerPool) Start(ctx context.Context) {
	for i := 0; i < wp.workers; i++ {
		wp.wg.Add(1)
		go wp.worker(i, ctx)
	}
}

func (wp *WorkerPool) worker(id int, ctx context.Context) {
	defer wp.wg.Done()

	for task := range wp.taskQueue {
		err := task()
		wp.results[id] = err
	}
}

func (wp *WorkerPool) Submit(task Task) error {
	wp.taskQueue <- task
	return nil
}

func (wp *WorkerPool) Stop() {
	close(wp.taskQueue)
	wp.wg.Wait()
}

func (wp *WorkerPool) GetResults() map[int]error {
	return wp.results
}
