from __future__ import annotations

from .dsl import FeatureSource, PythonTransform, SQLTransform, feature


def example_features():
    users = FeatureSource(name="users", kind="sql", identifier="public.users")

    f_age = feature(
        name="user_age",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=users,
        transform=SQLTransform(sql="SELECT user_id, event_time, age AS user_age FROM users"),
        description="User age at event time",
        owner="ml-platform",
        tags=["demographics"],
        version="v1",
        depends_on=[],
        default_value=None,
    )

    f_is_adult = feature(
        name="user_is_adult",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=users,
        transform=PythonTransform(func=lambda row: int(row["user_age"]) >= 18),
        description="Derived feature: adult flag",
        owner="ml-platform",
        tags=["demographics", "derived"],
        version="v1",
        depends_on=["user_age"],
        default_value=0,
    )

    return [f_age, f_is_adult]
