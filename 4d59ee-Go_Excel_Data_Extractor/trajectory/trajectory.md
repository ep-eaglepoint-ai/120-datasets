# Development Trajectory: Go Excel to JSON Extractor

## Overview
This document outlines the systematic thought process an AI model should follow when creating a complete Go application from scratch that reads Excel files and converts them to JSON using the excelize library.

---

## Phase 1: Understanding the Context

### Step 1.1: Read the Problem Statement
**Action**: Carefully read the requirements and understand the task.

**Key Questions to Ask**:
- What is the primary goal? (Create a CLI tool that converts Excel to JSON)
- What are the inputs and outputs? (File path, sheet name → JSON array to stdout)
- What libraries to use? (excelize for Excel parsing)
- What data transformations needed? (Dates to ISO 8601, types detection, empty to null)
- What error handling required? (File/sheet not found, invalid format)

**Expected Understanding**:
- This is a **new Go application** from scratch, following the dataset structure with repository_before (minimal) and repository_after (complete implementation)
- Must handle Excel-specific features (serial dates, mixed types)
- CLI interface with specific argument format
- JSON output with proper typing and null handling
- Graceful error handling with stderr and exit codes

### Step 1.2: Analyze the Requirements
**Action**: Break down each requirement.

**Requirements Breakdown**:

1. **Go Module Setup**: Create go.mod with excelize dependency
2. **CLI Interface**: Accept `./extractor <file.xlsx> <sheet_name>`
3. **Header Reading**: Use row 1 as JSON keys
4. **Date Conversion**: Excel serial dates (since Dec 30, 1899) to ISO 8601
5. **Type Detection**: numbers→float64, booleans→bool, dates→string, text→string, empty→null
6. **Error Handling**: File/sheet not found, invalid format → stderr + exit 1
7. **Output**: Pretty-printed JSON array to stdout

**Key Insights**:
- Need to understand Excel date system (1900 vs 1904 epoch)
- Type detection requires checking cell types from excelize
- JSON marshaling with null values requires interface{} or custom types
- CLI parsing using os.Args

---

## Phase 2: Learning and Research

### Step 2.1: Investigate Go Basics
**Action**: Review Go fundamentals if needed.

**Key Topics**:
- Go modules and go.mod
- Command-line argument parsing
- JSON encoding/decoding
- Error handling patterns
- Time/date handling

### Step 2.2: Learn Excelize Library
**Action**: Study the excelize documentation.

**Key Functions to Learn**:
- `excelize.OpenFile()` - Open Excel file
- `f.GetSheetList()` - List sheets
- `f.GetRows()` - Get all rows
- `f.GetCellValue()` - Get cell value
- Cell type detection methods

**Date Handling Research**:
- Excel dates: Days since Dec 30, 1899 (or Jan 1, 1904 for 1904 epoch)
- Conversion: Add days to base date, format as ISO 8601
- Need to handle both date-only and datetime serials

### Step 2.3: Ask Questions and Clarify
**Action**: Identify unclear points and research.

**Questions to Investigate**:
- How does excelize detect cell types?
- How to distinguish between date serials and regular numbers?
- How to handle 1904 epoch files?
- How to output null values in JSON?

**Research Findings**:
- Excelize provides `GetCellValue()` which returns string representation
- For type detection, may need to use underlying cell data
- Date serials are stored as numbers, need heuristics to detect
- JSON null requires using interface{} with nil values

---

## Phase 3: Planning the Implementation

### Step 3.1: Design Project Structure
**Action**: Plan the Go module layout based on the dataset structure.

**Proposed Structure**:
```
repository_after/
├── go.mod
├── main.go              # CLI entry point
├── pkg/
│   ├── create_excel.go  # Utility for creating test Excel files
│   └── extractor/
│       └── extractor.go # Core extraction logic
tests/
├── extractor_test.go
```

**Module Decisions**:
- Use `github.com/xuri/excelize/v2`
- Main package in repository_after/
- Extractor package in pkg/extractor/
- Test utilities in pkg/create_excel.go
- Tests in separate tests/ directory

### Step 3.2: Plan Core Functions
**Action**: Design the main components.

**Main Function (main.go)**:
- Parse CLI args (file, sheet)
- Call extractor
- Handle errors and output JSON

**Extractor Function (extractor.go)**:
- Open Excel file
- Validate sheet exists
- Read headers from row 1
- Process data rows
- Convert types and dates
- Return JSON-serializable data

**Helper Functions**:
- `isDateSerial()` - Detect if number is a date
- `serialToISO()` - Convert serial to ISO 8601
- `convertValue()` - Type detection and conversion

### Step 3.3: Define Data Flow
**Action**: Map the processing pipeline.

**Data Flow**:
1. Parse args → file path, sheet name
2. Open file with excelize
3. Get rows from sheet
4. Extract headers (row 0)
5. For each data row (row 1+):
   - Create map[string]interface{}
   - For each column:
     - Get cell value
     - Detect type
     - Convert if needed
     - Set in map (or nil for empty)
6. Collect all row maps into slice
7. Marshal to JSON with pretty printing

---

## Phase 4: Implementation

### Step 4.1: Setup Go Module
**Action**: Initialize the project.

```bash
go mod init go-excel-extractor
go get github.com/xuri/excelize/v2
```

### Step 4.2: Implement CLI (main.go)
**Action**: Create the command-line interface.

**Key Code**:
```go
func main() {
    if len(os.Args) != 3 {
        fmt.Fprintf(os.Stderr, "Usage: %s <file.xlsx> <sheet_name>\n", os.Args[0])
        os.Exit(1)
    }
    
    filePath := os.Args[1]
    sheetName := os.Args[2]
    
    data, err := extractor.Extract(filePath, sheetName)
    if err != nil {
        fmt.Fprintf(os.Stderr, "Error: %v\n", err)
        os.Exit(1)
    }
    
    jsonData, err := json.MarshalIndent(data, "", "  ")
    if err != nil {
        fmt.Fprintf(os.Stderr, "JSON encoding error: %v\n", err)
        os.Exit(1)
    }
    
    fmt.Println(string(jsonData))
}
```

### Step 4.3: Implement Extractor Logic
**Action**: Build the core extraction function.

**Key Components**:

**File Opening and Validation**:
```go
f, err := excelize.OpenFile(filePath)
if err != nil {
    return nil, fmt.Errorf("failed to open file: %w", err)
}
defer f.Close()

// Check if sheet exists
sheets := f.GetSheetList()
sheetExists := false
for _, sheet := range sheets {
    if sheet == sheetName {
        sheetExists = true
        break
    }
}
if !sheetExists {
    return nil, fmt.Errorf("sheet '%s' not found", sheetName)
}
```

**Row Reading and Processing**:
```go
rows, err := f.GetRows(sheetName)
if err != nil {
    return nil, fmt.Errorf("failed to read rows: %w", err)
}

if len(rows) < 1 {
    return []map[string]interface{}{}, nil // Empty sheet
}

headers := rows[0]
var result []map[string]interface{}

for i := 1; i < len(rows); i++ {
    row := rows[i]
    rowData := make(map[string]interface{})
    
    for j, cellValue := range row {
        var key string
        if j < len(headers) {
            key = headers[j]
        } else {
            key = fmt.Sprintf("Column%d", j+1)
        }
        
        convertedValue := convertValue(cellValue)
        rowData[key] = convertedValue
    }
    
    // Fill missing columns with null
    for j := len(row); j < len(headers); j++ {
        key := headers[j]
        rowData[key] = nil
    }
    
    result = append(result, rowData)
}
```

**Type Conversion Function**:
```go
func convertValue(cellValue string) interface{} {
    if cellValue == "" {
        return nil
    }
    
    // Try to parse as number
    if num, err := strconv.ParseFloat(cellValue, 64); err == nil {
        // Check if it's a date serial
        if isDateSerial(num) {
            return serialToISO(num)
        }
        return num
    }
    
    // Try to parse as boolean
    if cellValue == "TRUE" || cellValue == "true" {
        return true
    }
    if cellValue == "FALSE" || cellValue == "false" {
        return false
    }
    
    // Default to string
    return cellValue
}
```

**Date Conversion Functions**:
```go
func isDateSerial(num float64) bool {
    // Excel dates start from 1 (Jan 1, 1900) or 0 (Dec 30, 1899)
    // Reasonable range: 1900-2100
    return num >= 1 && num <= 100000
}

func serialToISO(serial float64) string {
    // Excel epoch: Dec 30, 1899
    baseDate := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
    days := int(serial)
    timeComponent := serial - float64(days)
    
    date := baseDate.AddDate(0, 0, days)
    
    // Add time component if present
    if timeComponent > 0 {
        hours := int(timeComponent * 24)
        minutes := int((timeComponent*24 - float64(hours)) * 60)
        seconds := int(((timeComponent*24 - float64(hours))*60 - float64(minutes)) * 60)
        date = time.Date(date.Year(), date.Month(), date.Day(), hours, minutes, seconds, 0, time.UTC)
    }
    
    return date.Format(time.RFC3339)
}
```

---

## Phase 5: Testing and Validation

### Step 5.1: Create Test Cases
**Action**: Write comprehensive tests.

**Test Scenarios**:
- Valid Excel file with mixed data types
- Date serial conversion
- Empty cells
- Missing sheets
- Invalid files
- Edge cases (negative numbers, large numbers)

**Example Test**:
```go
func TestExtract(t *testing.T) {
    // Create test Excel file
    f := excelize.NewFile()
    f.SetCellValue("Sheet1", "A1", "Name")
    f.SetCellValue("Sheet1", "B1", "Age")
    f.SetCellValue("Sheet1", "C1", "Salary")
    f.SetCellValue("Sheet1", "A2", "Alice")
    f.SetCellValue("Sheet1", "B2", "30")
    f.SetCellValue("Sheet1", "C2", "75000.50")
    
    // Save and test
    testFile := "test.xlsx"
    f.SaveAs(testFile)
    defer os.Remove(testFile)
    
    data, err := Extract(testFile, "Sheet1")
    assert.NoError(t, err)
    assert.Len(t, data, 1)
    assert.Equal(t, "Alice", data[0]["Name"])
    assert.Equal(t, 30.0, data[0]["Age"])
    assert.Equal(t, 75000.50, data[0]["Salary"])
}
```

### Step 5.2: Run Tests
**Action**: Execute test suite.

```bash
go test ./...
```

**Expected Results**:
- All tests pass
- Edge cases handled correctly
- Error conditions properly tested

### Step 5.3: Manual Testing
**Action**: Test with real Excel files.

**Test Commands**:
```bash
go build -o extractor
./extractor test.xlsx Sheet1
```

**Verify Output**:
- JSON structure matches requirements
- Dates converted correctly
- Types preserved
- Empty cells as null

---

## Phase 6: Documentation and Artifacts

### Step 6.1: Create README
**Action**: Document usage and examples.

**README Content**:
- Installation instructions
- Usage examples
- Requirements
- Build instructions

### Step 6.2: Generate Evaluation Metrics
**Action**: Assess code quality.

**Metrics to Track**:
- Test coverage
- Code complexity
- Performance benchmarks
- Error handling completeness

### Step 6.3: Create Instance Metadata
**Action**: Document for dataset purposes.

**Instance JSON**:
```json
{
  "instance_id": "go-excel-extractor",
  "problem_statement": "...",
  "requirements": [...],
  "success_criteria": [...]
}
```

---

## Phase 7: Reflection and Learning

### Key Success Factors

1. **Understand Requirements Thoroughly**
   - Read multiple times, break down each requirement
   - Clarify ambiguities through research

2. **Learn the Tools**
   - Study excelize API thoroughly
   - Understand Excel date system
   - Practice Go patterns

3. **Plan Before Coding**
   - Design data structures
   - Plan error handling
   - Consider edge cases

4. **Test Extensively**
   - Unit tests for all functions
   - Integration tests for CLI
   - Manual testing with real data

5. **Handle Errors Gracefully**
   - Clear error messages
   - Proper exit codes
   - Resource cleanup

### Common Pitfalls to Avoid

❌ **Don't**: Assume Excel behavior
- Excel has quirks (1900 leap year bug, 1904 epoch option)
- Always test with real Excel files

❌ **Don't**: Ignore type detection
- Excel stores everything as strings in some contexts
- Need proper type inference

❌ **Don't**: Forget error handling
- File operations can fail
- Invalid data formats exist

✅ **Do**: Use Go best practices
- Proper error handling with error wrapping
- Interface{} for flexible JSON
- Defer for resource cleanup

✅ **Do**: Test edge cases
- Empty files, missing sheets
- Invalid dates, extreme values
- Unicode characters

---

## Decision Tree for Go CLI Development

```
Need to create a Go CLI tool?
├─ YES → Continue
└─ NO → Different approach

Understand all requirements?
├─ NO → Re-read and research
└─ YES → Continue

Familiar with required libraries?
├─ NO → Study documentation and examples
└─ YES → Continue

Planned project structure?
├─ NO → Design modules and packages
└─ YES → Continue

Implemented core logic?
├─ NO → Code step by step
└─ YES → Continue

Written comprehensive tests?
├─ NO → Create test cases
└─ YES → Continue

Tested manually?
├─ NO → Run with real data
└─ YES → Continue

All requirements met?
├─ NO → Debug and fix
└─ YES → Success!
```

---

## Summary Checklist

**Understanding Phase**:
- [ ] Read problem statement and requirements
- [ ] Break down each requirement
- [ ] Identify key challenges (dates, types, errors)

**Research Phase**:
- [ ] Learn Go basics if needed
- [ ] Study excelize library
- [ ] Research Excel date system
- [ ] Ask clarifying questions

**Planning Phase**:
- [ ] Design project structure
- [ ] Plan core functions
- [ ] Define data flow

**Implementation Phase**:
- [ ] Setup Go module
- [ ] Implement CLI interface
- [ ] Build extraction logic
- [ ] Handle type conversion and dates

**Testing Phase**:
- [ ] Write unit tests
- [ ] Test error conditions
- [ ] Manual testing with Excel files
- [ ] Verify JSON output

**Documentation Phase**:
- [ ] Create README
- [ ] Document usage examples
- [ ] Generate evaluation metrics

**Success Criteria**:
- [ ] All requirements implemented
- [ ] Tests pass
- [ ] Manual testing successful
- [ ] Error handling works
- [ ] JSON output correct

---

## Phase 4: Code Organization and Refactoring

### Step 4.1: Identify Refactoring Opportunities
**Action**: Analyze the codebase for areas that can be improved through refactoring.

**Common Issues to Look For**:
- Large files with multiple responsibilities
- Functions that are too long or complex
- Repeated code patterns
- Poor separation of concerns
- Missing documentation

**Evaluation System Refactoring**:
- Original `evaluation.go` was 353 lines with mixed concerns
- Combined types, utilities, test running, and main logic
- Difficult to maintain and test individual components

### Step 4.2: Apply Separation of Concerns
**Action**: Break down large components into focused, single-responsibility modules.

**Refactoring Strategy**:
1. **Extract Types**: Move all struct definitions to `types.go`
2. **Extract Utilities**: Create `utils.go` for helper functions
3. **Extract Domain Logic**: Separate test running into `test_runner.go`
4. **Keep Entry Points**: Maintain `main.go` and core orchestration

**Benefits Achieved**:
- Improved readability and maintainability
- Better testability of individual components
- Easier code reuse across projects
- Clearer module boundaries

### Step 4.3: External References and Best Practices

**Go Code Organization Resources**:
- [Effective Go - Package Organization](https://golang.org/doc/effective_go#package-names): "Good package names make code more readable"
- [Go Code Review Comments - Package Comments](https://github.com/golang/go/wiki/CodeReviewComments#package-comments): Guidelines for package structure
- [Standard Go Project Layout](https://github.com/golang-standards/project-layout): Community standard for Go project organization

**Refactoring Principles**:
- [SOLID Principles in Go](https://dave.cheney.net/2016/08/20/solid-go-design): Single Responsibility, Open/Closed, etc.
- [Clean Code in Go](https://github.com/Pungyeon/clean-go-article): Practical guide to writing clean Go code
- [Go Proverbs](https://go-proverbs.github.io/): "A little copying is better than a little dependency" and other wisdom

**File Organization Patterns**:
- [Go Package Oriented Design](https://www.ardanlabs.com/blog/2017/02/package-oriented-design.html): Ardan Labs guide to package design
- [Organizing Go Code](https://talks.golang.org/2014/organizing-go-code.slide): Official Go team presentation

**Testing and Evaluation**:
- [Go Testing Best Practices](https://github.com/maratori/testable-examples): Examples of testable Go code
- [Table Driven Tests](https://github.com/golang/go/wiki/TableDrivenTests): Go's preferred testing pattern

---

## Conclusion

Creating a Go CLI tool for Excel to JSON conversion requires careful attention to Excel's data representation quirks, proper type detection, and robust error handling. By following this systematic approach—understanding, researching, planning, implementing, testing, and documenting—an AI can successfully build a complete, production-ready application that meets all specified requirements.

The key insights are:
1. **Excel Complexity**: Dates as serials, type inference challenges
2. **Go Patterns**: Proper error handling, interface{} for JSON
3. **Testing Importance**: Both automated and manual validation
4. **Documentation**: Clear usage and examples for users