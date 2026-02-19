package extractor

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/xuri/excelize/v2"
)

// excelEpoch is the Excel epoch date (December 30, 1899)
var excelEpoch = time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)

// ExtractToJSON extracts data from the specified Excel file and sheet, returning JSON string
func ExtractToJSON(filePath, sheetName string) (string, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return "", fmt.Errorf("opening file: %w", err)
	}
	defer f.Close()

	cols, err := f.GetCols(sheetName)
	if err != nil {
		return "", fmt.Errorf("reading sheet: %w", err)
	}

	maxCol := len(cols)
	maxRow := 0
	for _, col := range cols {
		if len(col) > maxRow {
			maxRow = len(col)
		}
	}

	if maxRow < 1 {
		return "", fmt.Errorf("no data in sheet")
	}

	headers := make([]string, 0, maxCol)
	for i := 0; i < maxCol; i++ {
		axis, _ := excelize.CoordinatesToCellName(i+1, 1)
		value, err := f.GetCellValue(sheetName, axis, excelize.Options{RawCellValue: false})
		if err != nil {
			return "", fmt.Errorf("getting cell value: %w", err)
		}
		headers = append(headers, value)
	}

	var data []map[string]interface{}
	for i := 1; i < maxRow; i++ {
		record := make(map[string]interface{})
		for j := 0; j < maxCol; j++ {
			axis, _ := excelize.CoordinatesToCellName(j+1, i+1)
			value, err := f.GetCellValue(sheetName, axis, excelize.Options{RawCellValue: false})
			if err != nil {
				return "", fmt.Errorf("getting cell value: %w", err)
			}
			key := headers[j]
			parsed := ParseCell(value)
			record[key] = parsed
		}
		data = append(data, record)
	}

	output, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshaling JSON: %w", err)
	}

	return string(output), nil
}

// ParseCell parses a cell value and returns the appropriate type
func ParseCell(cell string) interface{} {
	if cell == "" {
		return nil
	}

	// Try to parse as date
	if date, err := time.Parse("2006-01-02", cell); err == nil {
		// Handle Excel leap year bug: 1900-02-28 should be 1900-02-27
		if date.Year() == 1900 && date.Month() == 2 && date.Day() == 28 {
			date = date.AddDate(0, 0, -1)
		}
		return date.Format(time.RFC3339)
	}

	// Try to parse as number
	if num, err := strconv.ParseFloat(cell, 64); err == nil {
		return num
	}

	// Try to parse as boolean
	if cell == "TRUE" || cell == "true" {
		return true
	}
	if cell == "FALSE" || cell == "false" {
		return false
	}

	// Default to string
	return cell
}
