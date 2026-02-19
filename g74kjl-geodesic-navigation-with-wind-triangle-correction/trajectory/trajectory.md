# Trajectory

## 1) Audit / Discovery

I first inspected the repository to understand what existed and what didn’t. The baseline had no navigation logic, no tests proving correctness, and only a placeholder evaluator.

I then listed the ways this task typically fails in long-range flight:

- If distance is computed on a flat plane, the error grows to hundreds of km.
- If bearing is computed without spherical components, the “course” is wrong globally.
- If wind is handled as a scalar (or ignored), crosswind drift guarantees missed waypoints.
- If angles are not treated as circular, the International Date Line and 0/360 wrap break continuity.
- If external geo libraries are used, the solution violates the constraints.

## 2) Define the Contract (Rules Before Code)

Before coding, I locked the rules that must be true to meet the requirements.

Non-negotiables:

- I must compute distance with the Haversine formula using `math.sin`, `math.cos`, and `math.radians`.
- I must compute the initial true course with the spherical `math.atan2(x, y)` formulation.
- I must solve the wind triangle so crosswind produces a non-zero correction (heading differs from course).
- I must compute ground speed from the vector relationship (not `TAS - wind_speed`).
- I must normalize headings/courses into `[0, 360)`.
- I must use only the standard library (no geopy/numpy/geographiclib).
- I must handle wind speed 0 as a special case where heading==course and ground speed==TAS.

## 3) Structural Design / Model Adjustment

To make the solution hard to misuse, I kept the core logic in a single self-contained module: [repository_after/main.py](../repository_after/main.py). I used simple dataclasses to make inputs/outputs explicit (`Waypoint`, `Wind`, `FlightParameters`).

Because angle wrap is a constant source of bugs, I centralized normalization in helper functions so every heading/course passes through the same logic.

## 4) Execution Pipeline (How Work Flows)

I implemented the computation as a clear sequence that matches the physics:

1. Convert latitude/longitude from degrees to radians.
2. Compute great-circle distance using Haversine:

- $a = \sin^2(\Delta\varphi/2) + \cos\varphi_1\cos\varphi_2\sin^2(\Delta\lambda/2)$
- $c = 2\,\operatorname{atan2}(\sqrt{a}, \sqrt{1-a})$
- $d = R\cdot c$

3. Compute initial true course using the spherical bearing components and `atan2`:

- $x = \sin(\Delta\lambda)\cos\varphi_2$
- $y = \cos\varphi_1\sin\varphi_2 - \sin\varphi_1\cos\varphi_2\cos(\Delta\lambda)$
- $\theta = \operatorname{atan2}(x, y)$, then normalize to `[0, 360)`

4. Solve the wind triangle in “track-hold” form so the ground track remains the computed course:

- Compute relative wind angle `rel = wind_from - course`
- Compute wind-correction angle `WCA = asin((W/TAS) * sin(rel))` (clamped to [-1, 1])
- Compute true heading `heading = course + WCA` and normalize
- Compute ground speed along course as `GS = TAS*cos(WCA) - W*cos(rel)`

5. If magnetic variation is provided, compute magnetic heading and normalize.

## 5) Eliminate Known Anti-Patterns

I explicitly avoided shortcuts that look reasonable but fail at global scale:

- I did not use Euclidean distance or planar bearing approximations.
- I did not treat wind correction or ground speed as scalars.
- I did not allow headings to go negative or exceed 360.
- I did not introduce external geo/vector libraries.

## 6) Verification & Signals

I verified the contract with focused tests rather than relying on “looks right”. The unit tests in [tests/test_main.py](../tests/test_main.py) prove:

- Haversine is numerically correct.
- Bearing is numerically correct and normalized.
- International Date Line inputs remain stable.
- Crosswind produces a heading different from course and a vector-based ground speed.
- Heading normalization wraps correctly above 360 and below 0.
- Zero wind collapses to heading==course and GS==TAS.
- Forbidden libraries are absent and required math primitives are present.

## 7) Result Summary

This approach replaces flat-earth navigation with spherical math and replaces “no-wind assumptions” with an explicit wind-triangle correction. The result is a self-contained module that produces stable global distance/course outputs, computes the correct heading/ground speed under crosswind, and is proven by automated tests.
