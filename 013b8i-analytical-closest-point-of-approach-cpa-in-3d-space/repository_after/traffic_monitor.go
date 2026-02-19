package cpa

import (
	"math"
)

type Vector3D struct {
	X, Y, Z float64
}

type AircraftState struct {
	Position Vector3D
	Velocity Vector3D
}

type ThreatLevel struct {
	IsThreat              bool
	TimeToClosestApproach float64
	MinimumSeparation     float64
	ResolutionVector      Vector3D
}

type TrafficMonitor struct {
	SafetySeparationRadius float64
}

func NewTrafficMonitor(safetySeparationRadius float64) *TrafficMonitor {
	return &TrafficMonitor{
		SafetySeparationRadius: safetySeparationRadius,
	}
}

func dotProduct(v1, v2 Vector3D) float64 {
	return v1.X*v2.X + v1.Y*v2.Y + v1.Z*v2.Z
}

func magnitude(v Vector3D) float64 {
	return math.Sqrt(v.X*v.X + v.Y*v.Y + v.Z*v.Z)
}

func subtract(v1, v2 Vector3D) Vector3D {
	return Vector3D{
		X: v1.X - v2.X,
		Y: v1.Y - v2.Y,
		Z: v1.Z - v2.Z,
	}
}

func add(v1, v2 Vector3D) Vector3D {
	return Vector3D{
		X: v1.X + v2.X,
		Y: v1.Y + v2.Y,
		Z: v1.Z + v2.Z,
	}
}

func scalarMultiply(v Vector3D, scalar float64) Vector3D {
	return Vector3D{
		X: v.X * scalar,
		Y: v.Y * scalar,
		Z: v.Z * scalar,
	}
}

func distance(v1, v2 Vector3D) float64 {
	diff := subtract(v1, v2)
	return magnitude(diff)
}

func (tm *TrafficMonitor) AssessThreat(ownAircraft, intruderAircraft AircraftState, lookaheadHorizon float64) ThreatLevel {
	relativePosition := subtract(intruderAircraft.Position, ownAircraft.Position)
	relativeVelocity := subtract(intruderAircraft.Velocity, ownAircraft.Velocity)

	relativeVelocitySquared := dotProduct(relativeVelocity, relativeVelocity)

	const epsilon = 1e-10

	var timeToClosestApproach float64

	if relativeVelocitySquared < epsilon {
		timeToClosestApproach = 0.0
	} else {
		dotProdPosVel := dotProduct(relativePosition, relativeVelocity)
		timeToClosestApproach = -dotProdPosVel / relativeVelocitySquared

		if timeToClosestApproach < 0 {
			timeToClosestApproach = 0.0
		}
	}

	ownPositionAtCPA := add(ownAircraft.Position, scalarMultiply(ownAircraft.Velocity, timeToClosestApproach))
	intruderPositionAtCPA := add(intruderAircraft.Position, scalarMultiply(intruderAircraft.Velocity, timeToClosestApproach))

	minimumSeparation := distance(ownPositionAtCPA, intruderPositionAtCPA)

	isThreat := false
	var resolutionVector Vector3D

	if minimumSeparation < tm.SafetySeparationRadius && timeToClosestApproach <= lookaheadHorizon {
		isThreat = true

		resolutionVector = subtract(ownPositionAtCPA, intruderPositionAtCPA)

		resolutionMagnitude := magnitude(resolutionVector)
		if resolutionMagnitude > epsilon {
			requiredSeparation := tm.SafetySeparationRadius - minimumSeparation
			scaleFactor := requiredSeparation / resolutionMagnitude
			resolutionVector = scalarMultiply(resolutionVector, scaleFactor)
		}
	}

	return ThreatLevel{
		IsThreat:              isThreat,
		TimeToClosestApproach: timeToClosestApproach,
		MinimumSeparation:     minimumSeparation,
		ResolutionVector:      resolutionVector,
	}
}
