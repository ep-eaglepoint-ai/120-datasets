# Trajectory

## Problem Statement

You are provided with a 2D integer array squares, where each element squares[i] = [x_i, y_i, l_i] defines an axis-aligned square with its bottom-left vertex at coordinates (x_i, y_i) and a side length of l_i units. Squares are placed parallel to the coordinate axes and may overlap arbitrarily with one another. Your objective is to determine the smallest possible y-coordinate for a horizontal line such that when the total occupied region (considering overlaps only once, i.e., the union of all squares) is divided by this line, the area of the union that lies strictly above the line is exactly equal to the area of the union that lies strictly below the line. The region directly on the line itself has zero width and therefore does not contribute to either area. You must compute this y-value with a precision tolerance of 10^-5 relative to the true answer. The solution should correctly handle complex overlapping geometries and find the precise splitting line.

## Ground Solution

### Approach
1. Compute total union area of all squares using coordinate compression
2. Find target area = total_area / 2
3. Collect all unique y-coordinates from square boundaries
4. Binary search through y-candidates to find where area_below ≈ target_area
5. For each candidate y, compute union area below by clipping squares at that y-coordinate

### Algorithm
- Use coordinate compression to create grid cells from unique x and y coordinates
- For each grid cell, check if it's covered by any square
- Sum covered cell areas to get total union area
- Binary search on y-coordinates with precision tolerance 10^-5

### Time Complexity
O(n² log n) where n is the number of squares

## Test Cases

### Basic Cases
1. Single square: `[[0, 0, 10]]` → split at y=5.0
2. Two stacked squares: `[[0, 0, 10], [0, 10, 10]]` → split at y=10.0
3. Two side-by-side squares: `[[0, 0, 10], [10, 0, 10]]` → split at y=5.0
4. Empty input: `[]` → returns 0.0

### Overlapping Cases
5. Two overlapping squares: `[[0, 0, 10], [5, 5, 10]]` → split between y=5 and y=10
6. Fully contained square: `[[0, 0, 20], [5, 5, 5]]` → split at y≈10.0
7. Three overlapping squares: `[[0, 0, 10], [5, 0, 10], [2, 5, 10]]` → valid split in range

### Complex Geometries
8. Grid of squares: 3x3 grid → split around middle
9. L-shaped configuration: three squares forming L → valid split
10. Many small squares: 10x10 grid → split around middle

### Edge Cases
11. Single point square: `[[0, 0, 0.001]]` → split at center
12. Very large square: `[[0, 0, 1000]]` → split at y=500.0
13. Negative coordinates: `[[-10, -10, 20]]` → split at y=0.0
14. Precision requirement: `[[0, 0, 100]]` → split at y=50.0 within 10^-5### Functional Correctness
15. Area conservation: split creates equal areas above and below
16. Deterministic output: same input always gives same output
