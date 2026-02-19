import pytest
from repository_after.error_handling_lib.validators.input_validator import InputValidator
from repository_after.error_handling_lib.errors.specific_errors import ValidationError

# Requirement 4: ALL required validators must exist and work correctly

# Test validator existence - will fail if any method is missing
def test_all_required_validators_exist():
    """Test that ALL required validator methods exist"""
    # This will fail if any method is missing
    assert hasattr(InputValidator, 'type_check'), "type validator missing"
    assert hasattr(InputValidator, 'not_none'), "not_none validator missing"
    assert hasattr(InputValidator, 'not_empty'), "not_empty validator missing"
    assert hasattr(InputValidator, 'range'), "range validator missing"
    assert hasattr(InputValidator, 'length'), "length validator missing"
    assert hasattr(InputValidator, 'email'), "email validator missing"
    assert hasattr(InputValidator, 'url'), "url validator missing"
    assert hasattr(InputValidator, 'phone'), "phone validator missing"
    assert hasattr(InputValidator, 'in_choices'), "in_choices validator missing"
    assert hasattr(InputValidator, 'positive'), "positive validator missing"
    assert hasattr(InputValidator, 'alphanumeric'), "alphanumeric validator missing"

# MANDATORY Email Test Cases (from requirements)
def test_email_valid_cases():
    """Test email validator with valid inputs"""
    valid_emails = [
        "user@example.com",
        "test.email@domain.org",
        "user123@test-domain.co.uk"
    ]
    
    for email in valid_emails:
        # Should not raise any exception
        InputValidator.email(email, "Email")

def test_email_invalid_cases():
    """Test email validator with invalid inputs - MUST FAIL"""
    invalid_emails = [
        "invalid-email",  # Required test case
        "@domain.com",
        "user@",
        "user.domain.com",
        ""
    ]
    
    for email in invalid_emails:
        with pytest.raises(ValidationError) as exc_info:
            InputValidator.email(email, "Email")
        
        # Must raise ValidationError with correct category and severity
        error = exc_info.value
        assert "must be a valid email" in str(error)
        assert error.category.value == "VALIDATION"
        assert error.severity.value == "MEDIUM"

# MANDATORY Range Test Cases (from requirements)
def test_range_valid_cases():
    """Test range validator with valid inputs"""
    # Required test case: 25 in [0, 120] should PASS
    InputValidator.range(25, 0, 120, "Age")
    
    # Additional valid cases
    InputValidator.range(0, 0, 120, "Age")    # boundary
    InputValidator.range(120, 0, 120, "Age")  # boundary
    InputValidator.range(50.5, 0, 120, "Age") # float

def test_range_invalid_cases():
    """Test range validator with invalid inputs - MUST FAIL"""
    # Required test case: 150 in [0, 120] should FAIL
    with pytest.raises(ValidationError) as exc_info:
        InputValidator.range(150, 0, 120, "Age")
    
    error = exc_info.value
    assert "must be between 0 and 120" in str(error)
    assert error.category.value == "VALIDATION"
    
    # Additional invalid cases
    with pytest.raises(ValidationError):
        InputValidator.range(-5, 0, 120, "Age")
    
    with pytest.raises(ValidationError):
        InputValidator.range(121, 0, 120, "Age")

# MANDATORY Length Test Cases (from requirements)
def test_length_valid_cases():
    """Test length validator with valid inputs"""
    # Required test case: "password123" with min=8 should PASS
    InputValidator.length("password123", 8, None, "Password")
    
    # Additional valid cases
    InputValidator.length("exactly8", 8, 10, "Password")
    InputValidator.length("12345678", 8, None, "Password")

def test_length_invalid_cases():
    """Test length validator with invalid inputs - MUST FAIL"""
    # Required test case: "short" with min=8 should FAIL
    with pytest.raises(ValidationError) as exc_info:
        InputValidator.length("short", 8, None, "Password")
    
    error = exc_info.value
    assert "must have at least 8 characters" in str(error)
    assert error.category.value == "VALIDATION"
    
    # Test max length violation
    with pytest.raises(ValidationError) as exc_info:
        InputValidator.length("toolongpassword", 5, 10, "Password")
    
    assert "must have at most 10 characters" in str(exc_info.value)

# Test all other required validators
def test_type_validator():
    """Test type validator"""
    # Valid case
    InputValidator.type_check("hello", str, "Name")
    InputValidator.type_check(123, int, "Age")
    
    # Invalid case
    with pytest.raises(ValidationError) as exc_info:
        InputValidator.type_check("123", int, "Age")
    
    assert "must be of type int" in str(exc_info.value)

def test_not_none_validator():
    """Test not_none validator"""
    # Valid case
    InputValidator.not_none("value", "Field")
    InputValidator.not_none(0, "Field")  # 0 is not None
    
    # Invalid case
    with pytest.raises(ValidationError) as exc_info:
        InputValidator.not_none(None, "Field")
    
    assert "cannot be None" in str(exc_info.value)

def test_not_empty_validator():
    """Test not_empty validator"""
    # Valid cases
    InputValidator.not_empty("value", "Field")
    InputValidator.not_empty([1, 2, 3], "List")
    
    # Invalid cases
    with pytest.raises(ValidationError):
        InputValidator.not_empty("", "Field")
    
    with pytest.raises(ValidationError):
        InputValidator.not_empty([], "List")

def test_positive_validator():
    """Test positive validator"""
    # Valid cases
    InputValidator.positive(1, "Value")
    InputValidator.positive(0.1, "Value")
    InputValidator.positive(100, "Value")
    
    # Invalid cases
    with pytest.raises(ValidationError) as exc_info:
        InputValidator.positive(-1, "Value")
    
    assert "must be positive" in str(exc_info.value)
    
    with pytest.raises(ValidationError):
        InputValidator.positive(0, "Value")

def test_in_choices_validator():
    """Test in_choices validator"""
    choices = ["A", "B", "C"]
    
    # Valid cases
    InputValidator.in_choices("A", choices, "Choice")
    InputValidator.in_choices("B", choices, "Choice")
    
    # Invalid case
    with pytest.raises(ValidationError) as exc_info:
        InputValidator.in_choices("D", choices, "Choice")
    
    assert "must be one of" in str(exc_info.value)

def test_url_validator():
    """Test URL validator"""
    # Valid cases
    InputValidator.url("http://example.com", "URL")
    InputValidator.url("https://test.org/path", "URL")
    
    # Invalid cases
    with pytest.raises(ValidationError):
        InputValidator.url("not-a-url", "URL")
    
    with pytest.raises(ValidationError):
        InputValidator.url("ftp://example.com", "URL")

def test_phone_validator():
    """Test phone validator"""
    # Valid cases
    InputValidator.phone("+1234567890", "Phone")
    InputValidator.phone("123-456-7890", "Phone")
    InputValidator.phone("123 456 7890", "Phone")
    
    # Invalid cases
    with pytest.raises(ValidationError):
        InputValidator.phone("abc123", "Phone")
    
    with pytest.raises(ValidationError):
        InputValidator.phone("123", "Phone")  # Too short

def test_alphanumeric_validator():
    """Test alphanumeric validator"""
    # Valid cases
    InputValidator.alphanumeric("abc123", "Code")
    InputValidator.alphanumeric("ABC", "Code")
    InputValidator.alphanumeric("123", "Code")
    
    # Invalid cases
    with pytest.raises(ValidationError):
        InputValidator.alphanumeric("abc-123", "Code")
    
    with pytest.raises(ValidationError):
        InputValidator.alphanumeric("abc 123", "Code")

def test_validation_error_details():
    """Test that validators include proper details in ValidationError"""
    with pytest.raises(ValidationError) as exc_info:
        InputValidator.range(150, 0, 120, "Age")
    
    error = exc_info.value
    assert error.details["name"] == "Age"
    assert error.details["value"] == 150
    assert error.details["min"] == 0
    assert error.details["max"] == 120
