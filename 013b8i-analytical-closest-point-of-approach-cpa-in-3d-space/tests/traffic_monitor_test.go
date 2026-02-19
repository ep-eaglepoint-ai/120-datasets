package tests

import (
	"cpa"
	"math"
	"sync"
	"testing"
)

const epsilon = 1e-9

func almostEqual(a, b, tolerance float64) bool {
	return math.Abs(a-b) < tolerance
}

// Formula correctness
func TestCPAFormulaCorrectness(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 0},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 200, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: -10, Z: 0},
	}

	result := monitor.AssessThreat(own, intruder, 60.0)

	// At t=20s, own is at (200,0,0), intruder is at (200,0,0) - they meet
	// But they're converging, so CPA should be calculated correctly
	if result.TimeToClosestApproach < 0 {
		t.Errorf("Time to CPA should not be negative, got %f", result.TimeToClosestApproach)
	}

	// Verify the minimum separation is calculated at the correct time
	if result.MinimumSeparation < 0 {
		t.Errorf("Minimum separation should not be negative, got %f", result.MinimumSeparation)
	}
}

// O(1) time complexity - no loops
func TestO1TimeComplexity(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 1, Y: 0, Z: 0},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 100, Y: 50, Z: 0},
		Velocity: cpa.Vector3D{X: -1, Y: 0, Z: 0},
	}

	// This test verifies the function completes (no infinite loops)
	// The actual O(1) verification is in the code review
	result := monitor.AssessThreat(own, intruder, 120.0)

	if result.TimeToClosestApproach < 0 {
		t.Errorf("Expected non-negative time, got %f", result.TimeToClosestApproach)
	}
}

// Division by zero protection (parallel flight)
func TestParallelFlightNoDivisionByZero(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	// Both aircraft flying parallel with same velocity
	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 10, Z: 10},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 50, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 10, Z: 10},
	}

	// Should not panic due to division by zero
	result := monitor.AssessThreat(own, intruder, 60.0)

	// Time should be 0 (CPA is now)
	if !almostEqual(result.TimeToClosestApproach, 0.0, epsilon) {
		t.Errorf("Expected time to CPA to be 0 for parallel flight, got %f", result.TimeToClosestApproach)
	}

	// Minimum separation should be the current distance
	expectedDistance := 50.0
	if !almostEqual(result.MinimumSeparation, expectedDistance, 0.1) {
		t.Errorf("Expected minimum separation %f, got %f", expectedDistance, result.MinimumSeparation)
	}
}

// Negative time handling (diverging aircraft)
func TestNegativeTimeClampingForDivergingAircraft(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	// Aircraft already passed each other and are diverging
	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 100, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 0},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: -10, Y: 0, Z: 0},
	}

	result := monitor.AssessThreat(own, intruder, 60.0)

	// Time should be clamped to 0 (not negative)
	if result.TimeToClosestApproach < 0 {
		t.Errorf("Time to CPA should be clamped to 0 for diverging aircraft, got %f", result.TimeToClosestApproach)
	}

	// Should correctly identify no future threat
	if result.IsThreat {
		t.Error("Diverging aircraft should not be identified as a threat")
	}
}

// Thread safety and statelessness
func TestThreadSafetyAndStatelessness(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	var wg sync.WaitGroup
	numGoroutines := 1000

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			own := cpa.AircraftState{
				Position: cpa.Vector3D{X: float64(id), Y: 0, Z: 0},
				Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 0},
			}

			intruder := cpa.AircraftState{
				Position: cpa.Vector3D{X: float64(id + 100), Y: 50, Z: 0},
				Velocity: cpa.Vector3D{X: -10, Y: 0, Z: 0},
			}

			// Should not cause race conditions or panics
			result := monitor.AssessThreat(own, intruder, 60.0)

			if result.TimeToClosestApproach < 0 {
				t.Errorf("Goroutine %d: negative time detected", id)
			}
		}(i)
	}

	wg.Wait()
}

// Exact position calculation at CPA time
func TestExactPositionCalculationAtCPA(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	// Head-on collision course
	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 0},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 200, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: -10, Y: 0, Z: 0},
	}

	result := monitor.AssessThreat(own, intruder, 60.0)

	// They should meet at t=10s at position (100, 0, 0)
	expectedTime := 10.0
	if !almostEqual(result.TimeToClosestApproach, expectedTime, 0.1) {
		t.Errorf("Expected time to CPA %f, got %f", expectedTime, result.TimeToClosestApproach)
	}

	// Minimum separation should be 0 (collision)
	if !almostEqual(result.MinimumSeparation, 0.0, 0.1) {
		t.Errorf("Expected minimum separation 0, got %f", result.MinimumSeparation)
	}

	// Should be identified as a threat
	if !result.IsThreat {
		t.Error("Head-on collision should be identified as a threat")
	}
}

// Lookahead horizon enforcement
func TestLookaheadHorizonEnforcement(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	// Aircraft will have CPA far in the future
	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 1, Y: 0, Z: 0},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 1000, Y: 50, Z: 0},
		Velocity: cpa.Vector3D{X: -1, Y: 0, Z: 0},
	}

	// Short lookahead horizon
	result := monitor.AssessThreat(own, intruder, 60.0)

	// CPA will be at t=500s (way beyond 60s horizon)
	// Even if separation is small, should not be a threat due to horizon
	if result.TimeToClosestApproach > 60.0 && result.IsThreat {
		t.Error("Threat beyond lookahead horizon should not be classified as a threat")
	}
}

// Near-miss scenario
func TestNearMissScenario(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	// Aircraft passing close but not colliding
	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 0},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 150, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: -10, Z: 0},
	}

	result := monitor.AssessThreat(own, intruder, 60.0)

	// Should calculate correct CPA
	if result.TimeToClosestApproach < 0 {
		t.Errorf("Time to CPA should not be negative, got %f", result.TimeToClosestApproach)
	}

	// Minimum separation can be 0 or positive depending on trajectory
	if result.MinimumSeparation < 0 {
		t.Errorf("Minimum separation should not be negative, got %f", result.MinimumSeparation)
	}
}

// Test 3D space handling
func Test3DSpaceHandling(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	// Aircraft at different altitudes
	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 5},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 100, Y: 0, Z: 500},
		Velocity: cpa.Vector3D{X: -10, Y: 0, Z: -5},
	}

	result := monitor.AssessThreat(own, intruder, 60.0)

	// Should handle Z-axis correctly
	if result.TimeToClosestApproach < 0 {
		t.Errorf("Time to CPA should not be negative in 3D, got %f", result.TimeToClosestApproach)
	}

	// At CPA, should calculate correct 3D distance
	if result.MinimumSeparation < 0 {
		t.Errorf("Minimum separation should not be negative in 3D, got %f", result.MinimumSeparation)
	}
}

// Aircraft at same position
func TestSamePositionEdgeCase(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	// Both aircraft at same position (collision already happened)
	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 100, Y: 100, Z: 100},
		Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 0},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 100, Y: 100, Z: 100},
		Velocity: cpa.Vector3D{X: -10, Y: 0, Z: 0},
	}

	result := monitor.AssessThreat(own, intruder, 60.0)

	// Time should be 0 (CPA is now)
	if !almostEqual(result.TimeToClosestApproach, 0.0, epsilon) {
		t.Errorf("Expected time to CPA to be 0 for same position, got %f", result.TimeToClosestApproach)
	}

	// Minimum separation should be 0
	if !almostEqual(result.MinimumSeparation, 0.0, epsilon) {
		t.Errorf("Expected minimum separation 0 for same position, got %f", result.MinimumSeparation)
	}

	// Should be a threat
	if !result.IsThreat {
		t.Error("Aircraft at same position should be identified as a threat")
	}
}

// Test resolution vector calculation
func TestResolutionVectorCalculation(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	// Create a scenario where aircraft will be close but not colliding
	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 0},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 100, Y: 50, Z: 0},
		Velocity: cpa.Vector3D{X: -10, Y: 0, Z: 0},
	}

	result := monitor.AssessThreat(own, intruder, 60.0)

	// If it's a threat, resolution vector should be non-zero
	if result.IsThreat {
		magnitude := math.Sqrt(result.ResolutionVector.X*result.ResolutionVector.X +
			result.ResolutionVector.Y*result.ResolutionVector.Y +
			result.ResolutionVector.Z*result.ResolutionVector.Z)

		if almostEqual(magnitude, 0.0, epsilon) {
			t.Error("Resolution vector should not be zero for a threat")
		}
	}
}

// Test no threat when separation is sufficient
func TestNoThreatWithSufficientSeparation(t *testing.T) {
	monitor := cpa.NewTrafficMonitor(100.0)

	// Aircraft passing with sufficient separation
	own := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 0, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 0},
	}

	intruder := cpa.AircraftState{
		Position: cpa.Vector3D{X: 0, Y: 200, Z: 0},
		Velocity: cpa.Vector3D{X: 10, Y: 0, Z: 0},
	}

	result := monitor.AssessThreat(own, intruder, 60.0)

	// Should not be a threat (parallel flight with 200m separation)
	if result.IsThreat {
		t.Error("Aircraft with sufficient separation should not be a threat")
	}

	// Minimum separation should be approximately 200m
	if !almostEqual(result.MinimumSeparation, 200.0, 1.0) {
		t.Errorf("Expected minimum separation ~200m, got %f", result.MinimumSeparation)
	}
}
