from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Optional


EARTH_RADIUS_M = 6_371_000.0  # mean Earth radius in meters


def _normalize_degrees_0_360(angle_deg: float) -> float:
    """Normalize an angle to [0, 360)."""
    angle = angle_deg % 360.0
    # Convert -0.0 to 0.0 for cleanliness
    return 0.0 if angle == 0.0 else angle


def _normalize_degrees_minus180_180(angle_deg: float) -> float:
    """Normalize an angle to (-180, 180]."""
    angle = (angle_deg + 180.0) % 360.0 - 180.0
    return 180.0 if angle == -180.0 else angle


@dataclass(frozen=True)
class Waypoint:
    lat_deg: float
    lon_deg: float


@dataclass(frozen=True)
class Wind:
    speed: float
    direction_from_deg: float


@dataclass(frozen=True)
class FlightParameters:
    distance_m: float
    initial_true_course_deg: float
    true_heading_deg: float
    magnetic_heading_deg: float
    ground_speed: float
    wind_correction_angle_deg: float
    drift_angle_deg: float


class NavigationUtils:
    """Great-circle navigation and wind-triangle computations."""

    @staticmethod
    def great_circle_distance_m(start: Waypoint, end: Waypoint, *, radius_m: float = EARTH_RADIUS_M) -> float:
        """Compute great-circle distance between two coordinates using Haversine."""
        lat1 = math.radians(start.lat_deg)
        lon1 = math.radians(start.lon_deg)
        lat2 = math.radians(end.lat_deg)
        lon2 = math.radians(end.lon_deg)

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = (math.sin(dlat / 2.0) ** 2) + math.cos(lat1) * math.cos(lat2) * (math.sin(dlon / 2.0) ** 2)
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return radius_m * c

    @staticmethod
    def initial_true_course_deg(start: Waypoint, end: Waypoint) -> float:
        """Compute the initial true course (bearing) from start to end.

        Uses the standard spherical initial bearing formula with atan2.
        Returned bearing is normalized to [0, 360).
        """
        lat1 = math.radians(start.lat_deg)
        lon1 = math.radians(start.lon_deg)
        lat2 = math.radians(end.lat_deg)
        lon2 = math.radians(end.lon_deg)

        dlon = lon2 - lon1

        x = math.sin(dlon) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)

        bearing_rad = math.atan2(x, y)
        bearing_deg = math.degrees(bearing_rad)
        return _normalize_degrees_0_360(bearing_deg)

    @staticmethod
    def wind_triangle(
        course_deg: float,
        tas: float,
        wind: Wind,
        *,
        magnetic_variation_deg: float = 0.0,
    ) -> tuple[float, float, float]:
        """Solve the wind triangle.

        Args:
            course_deg: Desired ground track (true course) in degrees.
            tas: True airspeed (must be > 0). Units must match wind.speed.
            wind: Wind vector (speed + direction FROM in degrees).
            magnetic_variation_deg: Magnetic variation/declination, degrees.
                Convention used: East is positive, West is negative.

        Returns:
            (true_heading_deg, ground_speed, wind_correction_angle_deg)

        Notes:
            - If wind.speed == 0, heading == course and ground_speed == tas.
            - If wind is too strong to maintain the course (|crosswind| > TAS),
              the WCA is clamped to +/-90 degrees (best-effort).
        """
        if tas <= 0:
            raise ValueError("TAS must be > 0")
        if wind.speed < 0:
            raise ValueError("Wind speed must be >= 0")

        course = _normalize_degrees_0_360(course_deg)
        wind_from = _normalize_degrees_0_360(wind.direction_from_deg)

        if wind.speed == 0:
            return course, tas, 0.0

        rel_rad = math.radians(wind_from - course)

        # Wind correction angle (WCA): positive means steer right of course.
        ratio = (wind.speed / tas) * math.sin(rel_rad)
        ratio = max(-1.0, min(1.0, ratio))
        wca_rad = math.asin(ratio)

        heading = _normalize_degrees_0_360(course + math.degrees(wca_rad))

        # Ground speed along the intended course from vector sum.
        # Standard aviation formula: GS = TAS*cos(WCA) - W*cos(wind_from - course)
        ground_speed = tas * math.cos(wca_rad) - wind.speed * math.cos(rel_rad)

        return heading, ground_speed, math.degrees(wca_rad)

    @staticmethod
    def compute_flight_parameters(
        start: Waypoint,
        end: Waypoint,
        *,
        tas: float,
        wind: Wind,
        magnetic_variation_deg: float = 0.0,
        radius_m: float = EARTH_RADIUS_M,
    ) -> FlightParameters:
        """Compute end-to-end navigation parameters between two waypoints."""
        distance_m = NavigationUtils.great_circle_distance_m(start, end, radius_m=radius_m)
        course_deg = NavigationUtils.initial_true_course_deg(start, end)

        true_heading_deg, ground_speed, wca_deg = NavigationUtils.wind_triangle(
            course_deg,
            tas,
            wind,
            magnetic_variation_deg=magnetic_variation_deg,
        )

        magnetic_heading_deg = _normalize_degrees_0_360(true_heading_deg - magnetic_variation_deg)
        drift_angle_deg = _normalize_degrees_minus180_180(true_heading_deg - course_deg)

        return FlightParameters(
            distance_m=distance_m,
            initial_true_course_deg=course_deg,
            true_heading_deg=true_heading_deg,
            magnetic_heading_deg=magnetic_heading_deg,
            ground_speed=ground_speed,
            wind_correction_angle_deg=wca_deg,
            drift_angle_deg=drift_angle_deg,
        )
