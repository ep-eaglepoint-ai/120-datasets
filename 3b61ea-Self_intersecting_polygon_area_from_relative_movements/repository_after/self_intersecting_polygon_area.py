def expand_movements(movements):
    steps = []
    for direction, distance in movements:
        for _ in range(distance):
            steps.append(direction)
    return steps


def steps_to_vertices(steps):
    x, y = 0, 0
    vertices = [(x, y)]

    for step in steps:
        if step == "UP":
            y += 1
        elif step == "DOWN":
            y -= 1
        elif step == "LEFT":
            x -= 1
        elif step == "RIGHT":
            x += 1
        else:
            raise ValueError(f"Invalid direction: {step}")
        vertices.append((x, y))

    return vertices


def shoelace_area(vertices):
    area = 0
    n = len(vertices)
    for i in range(n):
        x1, y1 = vertices[i]
        x2, y2 = vertices[(i + 1) % n]
        area += x1 * y2 - y1 * x2
    return abs(area) / 2


def segments_intersect_proper(s1, s2):
    (x1, y1), (x2, y2) = s1
    (x3, y3), (x4, y4) = s2

    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if denom == 0:
        return None  # Parallel or collinear

    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

    # Proper intersection: strictly between endpoints (not at endpoints)
    if 0 < t < 1 and 0 < u < 1:
        px = x1 + t * (x2 - x1)
        py = y1 + t * (y2 - y1)
        return (px, py)

    return None


def find_all_loops(vertices):
    if len(vertices) < 4:
        return []

    loops = []
    origin = (0, 0)
    current_loop_start = 0

    # Find all returns to origin
    for i in range(1, len(vertices)):
        if vertices[i] == origin:
            # Found a return to origin - extract this closed loop
            loop = vertices[current_loop_start:i]  # Exclude the duplicate origin

            if len(loop) >= 3:
                # For self-intersecting loops within this segment,
                # we need to handle them specially
                sub_loops = extract_sub_loops(loop)
                loops.extend(sub_loops)

            current_loop_start = i  # Next loop starts from this origin

    return loops


def extract_sub_loops(loop_vertices):
    if len(loop_vertices) < 3:
        return []

    loops = []
    position_to_index = {}
    current_path = []

    for vertex in loop_vertices:
        if vertex in position_to_index:
            # Found a self-intersection - extract the inner loop
            loop_start_idx = position_to_index[vertex]
            inner_loop = current_path[loop_start_idx:]

            if len(inner_loop) >= 3:
                loops.append(inner_loop)

            # Remove inner loop vertices from tracking
            for i in range(loop_start_idx + 1, len(current_path)):
                pos = current_path[i]
                if pos in position_to_index:
                    del position_to_index[pos]

            current_path = current_path[:loop_start_idx + 1]
        else:
            position_to_index[vertex] = len(current_path)
            current_path.append(vertex)

    # The remaining path forms the outer loop
    if len(current_path) >= 3:
        loops.append(current_path)

    return loops


def total_enclosed_area(movements):
    if not movements:
        return 0

    steps = expand_movements(movements)
    vertices = steps_to_vertices(steps)

    # Find all closed loops in the path
    loops = find_all_loops(vertices)

    # Sum up areas of all closed loops
    total = 0
    for loop in loops:
        if len(loop) >= 3:
            total += shoelace_area(loop)

    return total
