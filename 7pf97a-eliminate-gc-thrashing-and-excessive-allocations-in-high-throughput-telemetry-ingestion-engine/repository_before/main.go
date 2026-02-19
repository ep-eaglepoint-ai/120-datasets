package main

import (
	"fmt"
	"runtime"
	"scenario-008-go-slice-realloc/telemetry"
	"time"
)

func main() {
	buffer := telemetry.NewIngestionBuffer()

	packet := telemetry.TelemetryPacket{
		ID:    1,
		Value: 99.9,
	}

	fmt.Println("=== Bug Scenario 008: GC Thrashing Test ===")

	var m1, m2 runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&m1)

	start := time.Now()
	iterations := 1000000 // 1 Million packets

	fmt.Printf("Processing %d packets...\n", iterations)

	for i := 0; i < iterations; i++ {
		buffer.Push(packet)

		// Flush every 10,000 packets to simulate batch processing
		if i%10000 == 0 {
			buffer.Flush()
		}
	}

	duration := time.Since(start)
	runtime.ReadMemStats(&m2)

	fmt.Printf("\n--- Performance Metrics ---\n")
	fmt.Printf("Time taken: %v\n", duration)
	fmt.Printf("Total allocations (Mallocs): %d\n", m2.Mallocs-m1.Mallocs)
	fmt.Printf("Total bytes allocated (HeapAlloc): %d MB\n", (m2.TotalAlloc-m1.TotalAlloc)/1024/1024)
	fmt.Printf("Number of GC cycles: %d\n", m2.NumGC-m1.NumGC)

	// A well-tuned buffer should have very few heap allocations and GC cycles.
	// In the buggy version, we'll see thousands of mallocs and high TotalAlloc.
	if m2.NumGC-m1.NumGC > 5 {
		fmt.Printf("\n❌ BUG DETECTED: High GC pressure and allocation count!\n")
		fmt.Printf("   Resizing slices and creating new objects frequently causes GC thrashing.\n")
	} else {
		fmt.Println("\n✅ Memory management is efficient.")
	}
}
