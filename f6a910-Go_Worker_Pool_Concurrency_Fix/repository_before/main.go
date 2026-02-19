package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	fmt.Println("=== Worker Pool Test ===")
	
	wp := NewWorkerPool(3)
	ctx := context.Background()
	wp.Start(ctx)
	
	// Submit tasks
	for i := 0; i < 5; i++ {
		taskNum := i
		wp.Submit(func() error {
			fmt.Printf("Task %d running\n", taskNum)
			time.Sleep(100 * time.Millisecond)
			return nil
		})
	}
	
	time.Sleep(500 * time.Millisecond)
	wp.Stop()
	
	fmt.Println("=== Done ===")
}

