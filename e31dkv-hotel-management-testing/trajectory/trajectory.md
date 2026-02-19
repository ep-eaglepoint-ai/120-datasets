# Trajectory - Hotel Management Testing

## Objective
Create comprehensive test suite for Java Swing Hotel Management System covering Login, Rooms, and Bookings modules.

## Analysis Phase

### Code Review
- Examined Login.java, Rooms.java, and Bookings.java
- Identified database operations using MySQL JDBC with PreparedStatements
- Found GUI components using Java Swing (JFrame, JTable, JComboBox, JTextField)
- Noted navigation patterns between Login → Rooms → Bookings windows
- Identified critical methods: connect(), Load_room(), Load_bookings(), checkout()

### Database Schema
- Single table: `rooms` with columns: id, roomnumber, floor, room_type, price, booked
- MySQL database named `hotelmanagement`
- Credentials: username="keti", password="password"
- Sample data includes 4 room types and 3 floor options

## Primary Test Creation (Requirements 1-22)

### Test File Structure
- **Location**: `repository_after/test/hotelmanagement/HotelManagementTest.java`
- **Lines of Code**: 490+
- **Test Count**: 23 tests
- **Framework**: JUnit 5.10.0 with @DisplayName annotations
- **Mocking**: Mockito 5.5.0 with MockitoExtension
- **Database**: H2 2.2.224 in-memory (MySQL compatibility mode)

### Test Coverage by Category

#### Database Tests (Req 1-4)
- **Req1**: Connection success with valid credentials
- **Req2**: Connection failure handling with SQLException
- **Req3**: Load all rooms with correct data validation
- **Req4**: Filter booked rooms using WHERE clause

#### CRUD Operations (Req 5-8)
- **Req5**: Add room with default booked=false
- **Req6**: Handle empty room number input
- **Req7**: Invalid price format exception handling
- **Req8**: SQL injection prevention using PreparedStatement

#### Checkout Operations (Req 9-11)
- **Req9**: Successful checkout sets booked=false
- **Req10**: No selection returns -1
- **Req11**: Nonexistent room affects 0 rows

#### Navigation Tests (Req 12-15)
- **Req12**: Login button creates Rooms window
- **Req13**: Rooms to Bookings navigation
- **Req14**: Bookings to Rooms navigation
- **Req15**: Logout navigation to Login

#### GUI Component Tests (Req 16-20)
- **Req16a**: Rooms table has 6 columns (ID, Room Number, Floor, Type, Price, Status)
- **Req16b**: Bookings table has 5 columns (Room ID, Room Number, Type, Floor, Price)
- **Req17**: All table cells are non-editable
- **Req18**: Room type dropdown has 4 options
- **Req19**: Floor dropdown has 3 options
- **Req20**: Form fields clear after successful add

#### Advanced Tests (Req 21-22)
- **Req21**: Concurrent database access with thread safety
- **Req22**: Performance test with 1000 rooms under 10 seconds

### Test Implementation Details
- **Database Isolation**: @BeforeEach clears database and resets auto-increment
- **Setup**: @BeforeAll creates H2 connection with MySQL mode
- **Teardown**: @AfterAll closes database connection
- **Helper Methods**: insertTestRoom() for test data setup
- **Assertions**: Uses assertEquals, assertTrue, assertFalse, assertNotNull, assertThrows, assertDoesNotThrow
- **Timeouts**: @Timeout annotation for performance tests

## Meta-Test Creation (Requirements 23-30)

### Meta-Test File Structure
- **Location**: `tests/MetaTest.java`
- **Test Count**: 14 meta-tests
- **Purpose**: Validate test quality and coverage

### Meta-Test Coverage

#### Test Quality (Req 24-29)
- **Req24**: All test methods contain assertions
- **Req25**: No trivial assertions (assertTrue(true), etc.)
- **Req26**: Test classes end with "Test" suffix
- **Req27**: Test methods follow naming conventions
- **Req28**: Database isolation with @BeforeEach cleanup
- **Req29**: Mockito imports present for mocking

#### Coverage Validation (Req 30)
- **Req30a**: Critical methods tested (connect, Load_room, checkout)
- **Req30b**: Database operations tested (INSERT, SELECT, UPDATE)
- **Req30c**: Edge cases tested (empty input, invalid input, SQL injection, concurrency)
- **Req30d**: GUI components tested (JTable, JComboBox)

#### Additional Meta-Tests
- Primary test file discoverable and not empty
- Minimum 15 test methods present
- No @Disabled or @Ignore annotations

### Meta-Test Implementation
- Uses regex patterns to analyze test file content
- Validates file structure and naming conventions
- Checks for proper test isolation setup
- Verifies comprehensive coverage of requirements

## Technical Stack

- **Testing Framework**: JUnit 5.10.0
- **Mocking**: Mockito 5.5.0 (mockito-core, mockito-junit-jupiter)
- **Database**: H2 2.2.224 (MySQL compatibility mode)
- **JDBC**: MySQL Connector/J 8.1.0
- **Build Tool**: Maven 3.9
- **Java Version**: 17 (eclipse-temurin:17-jdk)
- **Container**: Docker with separate /build directories
- **Test Reporter**: maven-surefire-junit5-tree-reporter 1.2.1

## Key Architectural Decisions

1. **Separate Build Directories**: Tests built in `/build/primary-tests` and `/build/meta-tests` to avoid modifying `repository_after`
2. **H2 Database**: Used in-memory H2 with MySQL mode instead of actual MySQL for:
   - Test isolation and speed
   - No external dependencies
   - Consistent test environment
3. **@DisplayName Annotations**: Added descriptive names for clear test output showing requirement numbers
4. **Maven Surefire Tree Reporter**: Configured to show individual test names during execution
5. **Docker Volume Mounting**: `/app` contains source, `/build` contains compiled tests
6. **Database Cleanup**: @BeforeEach ensures each test starts with clean state
7. **PreparedStatements**: Demonstrated SQL injection prevention in tests

## Test Execution Flow

1. **Docker Build**: Creates container with Java 17, Maven, Python
2. **Test Structure Setup**: Copies test files to Maven-compatible structure
3. **Dependency Resolution**: Pre-downloads Maven dependencies during build
4. **Primary Tests**: Run via `mvn test -f /build/primary-tests/pom.xml`
5. **Meta-Tests**: Run via `mvn test -f /build/meta-tests/pom.xml`
6. **Evaluation**: Python script aggregates results and generates JSON report

## Files Created

### Test Files
- `repository_after/test/hotelmanagement/HotelManagementTest.java` - 23 primary tests (490+ lines)
- `tests/MetaTest.java` - 14 meta-tests for test quality validation

### Build Configuration
- `Dockerfile` - Multi-stage build with Java 17, Maven, Python
- `docker-compose.yml` - Service orchestration with volume mounts
- Maven pom.xml files created dynamically in Docker for both test suites

### Evaluation System
- `evaluation/evaluation.py` - Test execution and JSON report generation
- Outputs formatted results to console and saves to `evaluation/reports/`

### Documentation
- `README.md` - Docker commands for running tests
- `patches/diff.patch` - Summary of test additions
- `trajectory/trajectory.md` - This testing approach document

## Test Results

All 23 primary tests: **PASSED** 
All 14 meta-tests: **PASSED** 

**Total Coverage**: 30 requirements (22 primary + 8 meta-test requirements)
