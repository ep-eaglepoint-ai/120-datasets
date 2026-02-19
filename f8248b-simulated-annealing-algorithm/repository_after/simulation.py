import numpy as np
import math

def objective_function(x):
    """
    The Rastrigin function.
    Global minimum is 0 at x = [0, 0, ..., 0].
    Search domain usually: [-5.12, 5.12]
    """
    A = 10
    n = len(x)
    return A * n + np.sum(x**2 - A * np.cos(2 * np.pi * x))

def get_neighbor(current_state, bounds=(-5.12, 5.12), step_size=0.1):
    """
    Generates a neighbor by adding random Gaussian noise to the current state.
    Includes clipping to ensure the solution stays within valid bounds.
    """
    # Create a random perturbation
    perturbation = np.random.uniform(-step_size, step_size, size=current_state.shape)
    new_state = current_state + perturbation
    
    # Clip to ensure we stay within the defined search space
    new_state = np.clip(new_state, bounds[0], bounds[1])
    return new_state

def acceptance_probability(energy_old, energy_new, temperature):
    """
    Calculates acceptance probability using the Metropolis criterion.
    """
    # If new solution is better, probability is 1.0 (always accept)
    if energy_new < energy_old:
        return 1.0
    
    # If new solution is worse, calculate probability based on Temp and Energy difference
    # P = exp(-(E_new - E_old) / T)
    return math.exp(-(energy_new - energy_old) / temperature)

def simulated_annealing(func, bounds, n_iterations, initial_temp, cooling_rate, step_size):
    """
    Main Simulated Annealing loop.
    """
    # Start at a random location within bounds
    dim = 2
    current_state = np.random.uniform(bounds[0], bounds[1], size=dim)
    current_energy = func(current_state)
    
    # Track the best solution found so far
    best_state = np.copy(current_state)
    best_energy = current_energy
    
    temperature = initial_temp
    
    print(f"Starting SA: Initial Energy = {current_energy:.4f}, Initial Temp = {temperature}")
    print("-" * 60)

    for i in range(n_iterations):
        # Generate neighbor
        neighbor = get_neighbor(current_state, bounds, step_size)
        neighbor_energy = func(neighbor)
        
        # Calculate acceptance probability
        prob = acceptance_probability(current_energy, neighbor_energy, temperature)
        
        # Decide whether to move to the neighbor
        if prob > np.random.rand():
            current_state = neighbor
            current_energy = neighbor_energy
            
            # Check if this is the new global best
            if current_energy < best_energy:
                best_state = np.copy(current_state)
                best_energy = current_energy
        
        temperature = temperature * cooling_rate
        
        if i % (n_iterations // 10) == 0:
            print(f"Iter {i:4d} | Temp: {temperature:.4f} | Best Energy: {best_energy:.6f} | Curr Energy: {current_energy:.6f}")

        if temperature < 1e-8:
            print("Temperature dropped below threshold. Stopping early.")
            break

    return best_state, best_energy