import math
from pathlib import Path

import pytest

from repository_after.main import NavigationUtils, Waypoint, Wind, _normalize_degrees_0_360


REPO_ROOT = Path(__file__).resolve().parents[1]
MAIN_PY = REPO_ROOT / "repository_after" / "main.py"


def approx_equal(a: float, b: float, tol: float) -> bool:
    return abs(a - b) <= tol


def test_source_uses_required_math_and_no_forbidden_libs():
    src = MAIN_PY.read_text(encoding="utf-8")

    # Requirement 6: prohibited libraries
    forbidden = ["geopy", "numpy", "geographiclib"]
    for name in forbidden:
        assert name not in src, f"Forbidden dependency imported/used: {name}"

    # Requirement 1: haversine formula should involve sin/cos/radians
    # (we assert presence; numeric tests below validate correctness)
    for token in ["math.sin", "math.cos", "math.radians"]:
        assert token in src

    # Requirement 2: bearing calculation must use atan2
    assert "math.atan2" in src


def test_haversine_distance_equator_one_degree_lon():
    # Requirement 1: must be Haversine, not Euclidean.
    start = Waypoint(0.0, 0.0)
    end = Waypoint(0.0, 1.0)

    d_m = NavigationUtils.great_circle_distance_m(start, end)

    # With Earth radius 6_371_000 m, 1 degree at equator ~ 111_194.926 m.
    assert approx_equal(d_m, 111_194.926, tol=25.0)


def test_initial_bearing_uses_spherical_components_and_normalized():
    # Requirement 2 & 5
    start = Waypoint(0.0, 0.0)
    end = Waypoint(0.0, 1.0)

    brg = NavigationUtils.initial_true_course_deg(start, end)
    assert 0.0 <= brg < 360.0
    assert approx_equal(brg, 90.0, tol=1e-6)


def test_international_date_line_handling_distance_and_course():
    # Must not blow up across +179 to -179, and should choose the short arc.
    start = Waypoint(10.0, 179.0)
    end = Waypoint(10.0, -179.0)

    d_m = NavigationUtils.great_circle_distance_m(start, end)
    course = NavigationUtils.initial_true_course_deg(start, end)

    # Roughly 2 degrees of longitude at latitude 10 deg
    # distance ~= 2 * 111_195m * cos(10deg) ~= 219_000m
    assert 150_000.0 < d_m < 300_000.0

    # Should be approximately eastbound.
    assert 0.0 <= course < 360.0
    assert course == pytest.approx(90.0, abs=5.0)


def test_wind_triangle_crosswind_changes_heading_and_vector_groundspeed():
    # Requirements 3, 4, 5
    course = 90.0
    tas = 100.0

    # Wind FROM North (0), i.e. blowing to the South: pure crosswind for eastbound.
    wind = Wind(speed=20.0, direction_from_deg=0.0)

    heading, gs, wca = NavigationUtils.wind_triangle(course, tas, wind)

    # Requirement 3: crosswind => heading != course
    assert heading != pytest.approx(course, abs=1e-9)

    # Heading should be crabbed into the wind (north of east => < 90)
    assert heading < course

    # Requirement 5: normalized
    assert 0.0 <= heading < 360.0

    # Requirement 4: vector-based GS, not TAS - wind_speed
    assert gs != pytest.approx(tas - wind.speed, abs=1e-9)

    # With 20kt crosswind and 100kt TAS, WCA ~= asin(0.2) ~= 11.536 degrees
    assert wca == pytest.approx(-11.536, abs=0.05)

    # GS should be TAS*cos(|WCA|) ~= 98.0
    assert gs == pytest.approx(98.0, abs=0.2)


def test_heading_normalization_wraps_above_360():
    # Requirement 5: normalize to 0-360
    course = 350.0
    tas = 100.0
    wind = Wind(speed=20.0, direction_from_deg=80.0)  # yields positive WCA (~+11.5)

    heading, gs, wca = NavigationUtils.wind_triangle(course, tas, wind)

    assert 0.0 <= heading < 360.0
    assert heading == pytest.approx(1.536, abs=0.1)

    # Also sanity-check the helper directly
    assert _normalize_degrees_0_360(370.0) == pytest.approx(10.0)
    assert _normalize_degrees_0_360(-10.0) == pytest.approx(350.0)


def test_zero_wind_heading_equals_course_and_gs_equals_tas():
    # Requirement 7
    course = 123.0
    tas = 87.0
    wind = Wind(speed=0.0, direction_from_deg=200.0)

    heading, gs, wca = NavigationUtils.wind_triangle(course, tas, wind)

    assert heading == pytest.approx(_normalize_degrees_0_360(course), abs=1e-12)
    assert gs == pytest.approx(tas, abs=1e-12)
    assert wca == pytest.approx(0.0, abs=1e-12)


def test_magnetic_heading_applies_variation_and_normalizes():
    # Exercises magnetic_heading_deg and non-zero magnetic_variation_deg.
    # Convention documented in code: East positive, West negative.
    start = Waypoint(0.0, 0.0)
    end = Waypoint(1.0, 0.0)  # due north => true course ~ 0 deg

    wind = Wind(speed=0.0, direction_from_deg=123.0)  # ignored when speed=0

    fp_east = NavigationUtils.compute_flight_parameters(
        start,
        end,
        tas=100.0,
        wind=wind,
        magnetic_variation_deg=15.0,
    )

    assert fp_east.initial_true_course_deg == pytest.approx(0.0, abs=1e-6)
    assert fp_east.true_heading_deg == pytest.approx(0.0, abs=1e-6)
    # Magnetic heading = True - variation, normalized
    assert fp_east.magnetic_heading_deg == pytest.approx(345.0, abs=1e-6)

    fp_west = NavigationUtils.compute_flight_parameters(
        start,
        end,
        tas=100.0,
        wind=wind,
        magnetic_variation_deg=-15.0,
    )
    assert fp_west.magnetic_heading_deg == pytest.approx(15.0, abs=1e-6)


def test_drift_angle_matches_wind_correction_angle_sign_and_value():
    # Exercises drift_angle_deg and sign convention between WCA and drift.
    start = Waypoint(0.0, 0.0)
    end = Waypoint(0.0, 1.0)  # due east => course ~ 90 deg

    wind = Wind(speed=20.0, direction_from_deg=0.0)  # crosswind for eastbound
    fp = NavigationUtils.compute_flight_parameters(
        start,
        end,
        tas=100.0,
        wind=wind,
        magnetic_variation_deg=0.0,
    )

    assert fp.initial_true_course_deg == pytest.approx(90.0, abs=1e-6)
    assert fp.true_heading_deg < fp.initial_true_course_deg

    # For this implementation: heading = course + WCA, so drift == WCA.
    assert fp.wind_correction_angle_deg == pytest.approx(-11.536, abs=0.05)
    assert fp.drift_angle_deg == pytest.approx(fp.wind_correction_angle_deg, abs=1e-9)


def test_extreme_crosswind_saturates_wind_correction_angle():
    # Edge condition: crosswind > TAS, WCA clamps to +/- 90 degrees.
    course = 90.0
    tas = 50.0
    wind = Wind(speed=200.0, direction_from_deg=0.0)  # strong crosswind

    heading, gs, wca = NavigationUtils.wind_triangle(course, tas, wind)

    assert wca == pytest.approx(-90.0, abs=1e-9)
    assert heading == pytest.approx(0.0, abs=1e-9)
    assert 0.0 <= heading < 360.0
    # With WCA at 90deg, along-track ground speed collapses to ~0.
    assert gs == pytest.approx(0.0, abs=1e-9)
