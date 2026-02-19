package main

import (
	"fmt"
	"runtime"
	"repository_after/telemetry"
	"time"
)

func main() {
	const numPackets = 1_000_000
	buffer := telemetry.NewIngestionBuffer(numPackets)

	packet := telemetry.TelemetryPacket{
		ID:    1,
		Value: 99.9,
	}

	fmt.Println("=== Optimized Telemetry Ingestion Test ===")

	var m1, m2 runtime.MemStats
	runtime.GC()           
	runtime.ReadMemStats(&m1)

	start := time.Now()

	for i := 0; i < numPackets; i++ {
		buffer.Push(packet)

		if i%10000 == 0 && i > 0 {
			_ = buffer.Flush()
		}
	}

	duration := time.Since(start)
	runtime.ReadMemStats(&m2)

	fmt.Printf("\n--- Performance Metrics ---\n")
	fmt.Printf("Time taken: %v\n", duration)
	fmt.Printf("Total allocations (Mallocs): %d\n", m2.Mallocs-m1.Mallocs)
	fmt.Printf("Total heap allocated (HeapAlloc): %d MB\n", (m2.TotalAlloc-m1.TotalAlloc)/1024/1024)
	fmt.Printf("Number of GC cycles: %d\n", m2.NumGC-m1.NumGC)

	if m2.NumGC-m1.NumGC > 5 {
		fmt.Println("\n❌ BUG DETECTED: High GC pressure!")
	} else {
		fmt.Println("\n✅ Memory management is efficient.")
	}

	finalBatch := buffer.Flush()
	fmt.Printf("Flushed %d packets\n", len(finalBatch))
}
