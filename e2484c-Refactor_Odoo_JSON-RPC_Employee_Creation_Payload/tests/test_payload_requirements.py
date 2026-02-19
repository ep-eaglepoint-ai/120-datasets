import json
import os
import re
from pathlib import Path


def _get_repo_path() -> Path:
    repo_path = os.environ.get("TEST_REPO_PATH")
    if not repo_path:
        raise AssertionError("TEST_REPO_PATH environment variable is required")
    return Path(repo_path)


def _load_payload(repo_path: Path) -> dict:
    payload_path = repo_path / "rpc-payload.json"
    if not payload_path.exists():
        raise AssertionError(f"{payload_path} not found")
    return json.loads(payload_path.read_text(encoding="utf-8"))


def test_jsonrpc_top_level_structure():
    payload = _load_payload(_get_repo_path())

    assert payload.get("jsonrpc") == "2.0"
    assert isinstance(payload.get("method"), str)
    assert payload.get("method") == "call"
    assert "params" in payload and isinstance(payload["params"], dict)
    assert "id" in payload

    params = payload["params"]
    assert params.get("service") == "object"
    assert params.get("method") == "execute"
    assert "args" in params and isinstance(params["args"], list)


def test_odoo_execute_args_order():
    """
    Odoo `object.execute` positional signature:
      execute(db, uid, password, model, method, *args)

    For hr.employee.create with one dict:
      [db, uid, password, "hr.employee", "create", employee_dict]
    """
    payload = _load_payload(_get_repo_path())
    args = payload["params"]["args"]

    assert len(args) >= 6
    db, uid, password, model, method, employee = args[:6]

    assert isinstance(db, str) and db
    assert isinstance(uid, int)
    assert isinstance(password, str)
    assert model == "hr.employee"
    assert method == "create"
    assert isinstance(employee, dict)


def test_employee_payload_minimum_fields_present():
    payload = _load_payload(_get_repo_path())
    employee = payload["params"]["args"][5]

    # Minimum fields used by this task instance (preserve existing values)
    assert employee.get("name") == "Solomon"
    assert employee.get("job_title") == "Engineer"
    assert employee.get("work_phone") == "905"
    assert employee.get("company_id") == 3
    assert employee.get("work_email") == "solomon@example.com"
    assert "mobile_phone" in employee


def test_mobile_phone_is_international_format():
    payload = _load_payload(_get_repo_path())
    employee = payload["params"]["args"][5]
    mobile_phone = employee["mobile_phone"]

    assert isinstance(mobile_phone, str)
    # E.164-like: + followed by 7..15 digits
    assert re.fullmatch(r"^\+\d{7,15}$", mobile_phone), f"invalid international format: {mobile_phone!r}"

