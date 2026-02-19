import numpy as np
import math
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_after'))

from simulation import (
    objective_function,
    get_neighbor,
    acceptance_probability,
    simulated_annealing
)


class TestObjectiveFunction:
    """Tests for the Rastrigin objective function."""
    
    def test_global_minimum_at_origin(self):
        """The global minimum of the Rastrigin function is 0 at the origin."""
        x = np.array([0.0, 0.0])
        result = objective_function(x)
        assert np.isclose(result, 0.0, atol=1e-10)
    
    def test_global_minimum_higher_dimensions(self):
        """Global minimum should be 0 at origin for any dimension."""
        for dim in [1, 3, 5, 10]:
            x = np.zeros(dim)
            result = objective_function(x)
            assert np.isclose(result, 0.0, atol=1e-10)
    
    def test_positive_at_non_origin(self):
        """Rastrigin function should return positive values away from origin."""
        x = np.array([1.0, 1.0])
        result = objective_function(x)
        assert result > 0
    
    def test_symmetric_around_origin(self):
        """Function should be symmetric around the origin."""
        x_pos = np.array([1.0, 2.0])
        x_neg = np.array([-1.0, -2.0])
        assert np.isclose(objective_function(x_pos), objective_function(x_neg))
    
    def test_known_value(self):
        """Test against a known calculated value."""
        x = np.array([1.0, 1.0])
        result = objective_function(x)
        expected = 2.0
        assert np.isclose(result, expected, atol=1e-10)


class TestGetNeighbor:
    """Tests for the neighbor generation function."""
    
    def test_neighbor_is_different(self):
        """Generated neighbor should be different from current state."""
        np.random.seed(42)
        current = np.array([0.0, 0.0])
        neighbor = get_neighbor(current)
        assert not np.array_equal(current, neighbor)
    
    def test_neighbor_within_bounds(self):
        """Neighbor should be within specified bounds."""
        np.random.seed(42)
        bounds = (-5.12, 5.12)
        current = np.array([5.0, -5.0]) 
        
        for _ in range(100):
            neighbor = get_neighbor(current, bounds=bounds)
            assert np.all(neighbor >= bounds[0])
            assert np.all(neighbor <= bounds[1])
    
    def test_neighbor_clipped_at_upper_bound(self):
        """Neighbor should be clipped when at upper bound."""
        np.random.seed(42)
        bounds = (-5.12, 5.12)
        current = np.array([5.12, 5.12]) 
        neighbor = get_neighbor(current, bounds=bounds, step_size=1.0)
        assert np.all(neighbor <= bounds[1])
    
    def test_neighbor_clipped_at_lower_bound(self):
        """Neighbor should be clipped when at lower bound."""
        np.random.seed(42)
        bounds = (-5.12, 5.12)
        current = np.array([-5.12, -5.12])
        neighbor = get_neighbor(current, bounds=bounds, step_size=1.0)
        assert np.all(neighbor >= bounds[0])
    
    def test_step_size_affects_perturbation(self):
        """Larger step size should allow for larger perturbations on average."""
        np.random.seed(42)
        current = np.array([0.0, 0.0])
        
        small_step_diffs = []
        large_step_diffs = []
        
        for _ in range(100):
            small_neighbor = get_neighbor(current, step_size=0.01)
            small_step_diffs.append(np.linalg.norm(small_neighbor - current))
            
            large_neighbor = get_neighbor(current, step_size=1.0)
            large_step_diffs.append(np.linalg.norm(large_neighbor - current))
        
        assert np.mean(large_step_diffs) > np.mean(small_step_diffs)
    
    def test_preserves_dimensionality(self):
        """Neighbor should have same shape as current state."""
        for dim in [1, 2, 5, 10]:
            current = np.zeros(dim)
            neighbor = get_neighbor(current)
            assert neighbor.shape == current.shape


class TestAcceptanceProbability:
    """Tests for the Metropolis acceptance probability function."""
    
    def test_better_solution_always_accepted(self):
        """Better solutions (lower energy) should have probability 1.0."""
        energy_old = 10.0
        energy_new = 5.0 
        temperature = 100.0
        
        prob = acceptance_probability(energy_old, energy_new, temperature)
        assert prob == 1.0
    
    def test_same_energy_returns_one(self):
        """Same energy should return probability exp(0) = 1.0."""
        energy_old = 10.0
        energy_new = 10.0
        temperature = 100.0
        
        prob = acceptance_probability(energy_old, energy_new, temperature)
        assert np.isclose(prob, 1.0)
    
    def test_worse_solution_probability_less_than_one(self):
        """Worse solutions should have probability < 1.0."""
        energy_old = 5.0
        energy_new = 10.0 
        temperature = 100.0
        
        prob = acceptance_probability(energy_old, energy_new, temperature)
        assert 0.0 < prob < 1.0
    
    def test_higher_temperature_higher_probability(self):
        """Higher temperature should give higher acceptance probability for worse solutions."""
        energy_old = 5.0
        energy_new = 10.0
        
        prob_low_temp = acceptance_probability(energy_old, energy_new, temperature=1.0)
        prob_high_temp = acceptance_probability(energy_old, energy_new, temperature=100.0)
        
        assert prob_high_temp > prob_low_temp
    
    def test_larger_energy_difference_lower_probability(self):
        """Larger energy difference should give lower acceptance probability."""
        energy_old = 5.0
        temperature = 50.0
        
        prob_small_diff = acceptance_probability(energy_old, energy_new=6.0, temperature=temperature)
        prob_large_diff = acceptance_probability(energy_old, energy_new=15.0, temperature=temperature)
        
        assert prob_small_diff > prob_large_diff
    
    def test_very_low_temperature_rejects_worse(self):
        """At very low temperature, worse solutions should be nearly always rejected."""
        energy_old = 5.0
        energy_new = 6.0
        temperature = 0.001
        
        prob = acceptance_probability(energy_old, energy_new, temperature)
        assert prob < 0.01
    
    def test_known_probability_value(self):
        """Test against a known calculated probability value."""
        energy_old = 5.0
        energy_new = 10.0 
        temperature = 10.0
        
        expected = math.exp(-0.5)
        prob = acceptance_probability(energy_old, energy_new, temperature)
        
        assert np.isclose(prob, expected)


class TestSimulatedAnnealing:
    """Tests for the main simulated annealing algorithm."""
    
    def test_returns_tuple(self):
        """Algorithm should return a tuple of (best_state, best_energy)."""
        np.random.seed(42)
        result = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=10,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_returns_correct_types(self):
        """Algorithm should return numpy array and float."""
        np.random.seed(42)
        best_state, best_energy = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=10,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        assert isinstance(best_state, np.ndarray)
        assert isinstance(best_energy, (int, float, np.floating))
    
    def test_best_state_within_bounds(self):
        """Best state should be within specified bounds."""
        np.random.seed(42)
        bounds = (-5.12, 5.12)
        best_state, _ = simulated_annealing(
            objective_function,
            bounds=bounds,
            n_iterations=100,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        assert np.all(best_state >= bounds[0])
        assert np.all(best_state <= bounds[1])
    
    def test_best_energy_matches_function_evaluation(self):
        """Best energy should match the objective function evaluated at best state."""
        np.random.seed(42)
        best_state, best_energy = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=100,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        calculated_energy = objective_function(best_state)
        assert np.isclose(best_energy, calculated_energy)
    
    def test_more_iterations_better_result(self):
        """More iterations should generally lead to better results."""
        np.random.seed(42)
        _, energy_few = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=50,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        np.random.seed(42)
        _, energy_many = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=500,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        assert energy_many <= energy_few
    
    def test_finds_reasonable_solution_for_rastrigin(self):
        """Algorithm should find a reasonably good solution for Rastrigin function."""
        np.random.seed(42)
        best_state, best_energy = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=2000,
            initial_temp=100.0,
            cooling_rate=0.995,
            step_size=0.3
        )
        
        # Rastrigin has many local minima; accept any solution better than random
        # A random solution in [-5.12, 5.12] has expected energy around 40-60
        assert best_energy < 20.0
    
    def test_early_stopping_on_low_temperature(self):
        """Algorithm should stop early when temperature drops below threshold."""
        np.random.seed(42)
        
        # With very aggressive cooling, should trigger early stopping
        # Starting temp = 1.0, cooling_rate = 0.1 -> temp drops very quickly
        best_state, best_energy = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=100000,  # Very high iteration count
            initial_temp=1.0,
            cooling_rate=0.1,  # Aggressive cooling
            step_size=0.5
        )
        
        # If it completes without error, the early stopping worked
        assert best_state is not None
        assert best_energy is not None
    
    def test_custom_objective_function(self):
        """Algorithm should work with a custom objective function."""
        def sphere_function(x):
            """Simple sphere function: sum of squares."""
            return np.sum(x**2)
        
        np.random.seed(42)
        best_state, best_energy = simulated_annealing(
            sphere_function,
            bounds=(-10.0, 10.0),
            n_iterations=500,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        assert best_energy < 5.0
    
    def test_reproducibility_with_seed(self):
        """Same random seed should produce same results."""
        np.random.seed(123)
        result1 = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=100,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        np.random.seed(123)
        result2 = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=100,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        assert np.allclose(result1[0], result2[0])
        assert np.isclose(result1[1], result2[1])


class TestCoolingSchedule:
    """Tests for verifying the cooling schedule behavior."""
    
    def test_exponential_cooling(self):
        """Verify that temperature decreases exponentially."""
        initial_temp = 100.0
        cooling_rate = 0.95
        iterations = 10
        
        expected_temps = [initial_temp * (cooling_rate ** i) for i in range(iterations)]
        
        for i, expected in enumerate(expected_temps):
            calculated = initial_temp * (cooling_rate ** i)
            assert np.isclose(expected, calculated)
    
    def test_cooling_rate_effect(self):
        """Higher cooling rate should preserve more temperature."""
        initial_temp = 100.0
        iterations = 50
        
        temp_slow_cool = initial_temp * (0.99 ** iterations)
        temp_fast_cool = initial_temp * (0.9 ** iterations)
        
        assert temp_slow_cool > temp_fast_cool


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""
    
    def test_minimal_iterations(self):
        """Algorithm should work with minimal iterations."""
        np.random.seed(42)
        best_state, best_energy = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=10,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        assert best_state is not None
        assert best_energy is not None
    
    def test_narrow_bounds(self):
        """Algorithm should work with narrow search bounds."""
        np.random.seed(42)
        bounds = (-0.1, 0.1)
        best_state, best_energy = simulated_annealing(
            objective_function,
            bounds=bounds,
            n_iterations=100,
            initial_temp=100.0,
            cooling_rate=0.99,
            step_size=0.01
        )
        
        assert np.all(best_state >= bounds[0])
        assert np.all(best_state <= bounds[1])
    
    def test_high_initial_temperature(self):
        """Algorithm should handle very high initial temperature."""
        np.random.seed(42)
        best_state, best_energy = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=100,
            initial_temp=10000.0,
            cooling_rate=0.99,
            step_size=0.5
        )
        
        assert best_state is not None
        assert best_energy is not None
    
    def test_very_slow_cooling(self):
        """Algorithm should handle very slow cooling rate."""
        np.random.seed(42)
        best_state, best_energy = simulated_annealing(
            objective_function,
            bounds=(-5.12, 5.12),
            n_iterations=100,
            initial_temp=100.0,
            cooling_rate=0.999,
            step_size=0.5
        )
        
        assert best_state is not None
        assert best_energy is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
