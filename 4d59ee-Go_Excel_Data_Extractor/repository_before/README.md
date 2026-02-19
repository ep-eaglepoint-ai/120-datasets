# Excel to JSON Extractor

Build a Go CLI tool that converts Excel spreadsheets to JSON.

## Usage
```
./extractor data.xlsx Sheet1
```

## Example Input (data.xlsx, Sheet1)
| Name  | Age | JoinDate | Salary   | Active |
|-------|-----|----------|----------|--------|
| Alice | 30  | 44927    | 75000.50 | TRUE   |
| Bob   | 25  | 45000    |          | FALSE  |

## Example Output
```json
[
  {
    "Name": "Alice",
    "Age": 30,
    "JoinDate": "2023-01-01T00:00:00Z",
    "Salary": 75000.5,
    "Active": true
  },
  {
    "Name": "Bob",
    "Age": 25,
    "JoinDate": "2023-03-15T00:00:00Z",
    "Salary": null,
    "Active": false
  }
]
```

## Notes
- Excel stores dates as serial numbers (days since December 30, 1899)
- Empty cells should be null, not empty strings
- Use the excelize library (github.com/xuri/excelize/v2)

