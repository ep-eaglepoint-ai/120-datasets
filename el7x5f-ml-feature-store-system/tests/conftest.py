from __future__ import annotations

import warnings

"""Reduce noise from third-party dependency warnings.

Important: these filters must be applied at import time (during test
collection) because some of the warnings are emitted while importing MLflow/GE.
"""

# mlflow: pkg_resources deprecation
warnings.filterwarnings(
    "ignore",
    message=r".*pkg_resources is deprecated as an API.*",
    category=DeprecationWarning,
)

# mlflow: pydantic v1 validator deprecations (emitted inside mlflow)
try:
    from pydantic.warnings import PydanticDeprecatedSince20  # type: ignore

    warnings.filterwarnings(
        "ignore",
        category=PydanticDeprecatedSince20,
        module=r"mlflow\..*",
    )
except Exception:
    pass

# great_expectations: pyparsing deprecations
try:
    from pyparsing.exceptions import PyparsingDeprecationWarning  # type: ignore

    warnings.filterwarnings(
        "ignore",
        category=PyparsingDeprecationWarning,
        module=r"great_expectations\..*",
    )
except Exception:
    pass

# great_expectations: marshmallow 4 transition warnings
try:
    from marshmallow.warnings import ChangedInMarshmallow4Warning  # type: ignore

    warnings.filterwarnings(
        "ignore",
        category=ChangedInMarshmallow4Warning,
        module=r"great_expectations\..*",
    )
except Exception:
    pass
