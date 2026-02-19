package tests

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"

	"go-excel-extractor/repository_after/pkg/extractor"
)

func TestParseCell(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected interface{}
	}{
		{"empty", "", nil},
		{"number", "123.45", 123.45},
		{"zero", "0", 0.0},
		{"negative", "-42", -42.0},
		{"true uppercase", "TRUE", true},
		{"true lowercase", "true", true},
		{"false uppercase", "FALSE", false},
		{"false lowercase", "false", false},
		{"date", "2023-01-01", "2023-01-01T00:00:00Z"}, // Formatted date string
		{"string", "hello", "hello"},
		{"string with spaces", "hello world", "hello world"},
		{"string with numbers", "abc123", "abc123"},
		{"scientific notation", "1.23e4", 12300.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractor.ParseCell(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestExtractToJSON(t *testing.T) {
	tempDir := t.TempDir()
	excelFile := filepath.Join(tempDir, "test.xlsx")

	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Sheet1"

	customNumFmt := "yyyy-mm-dd"
	style, err := f.NewStyle(&excelize.Style{CustomNumFmt: &customNumFmt})
	require.NoError(t, err)

	// Set headers
	headers := []string{"Name", "Age", "JoinDate", "Salary", "Active"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
	}

	// Set data rows
	f.SetCellValue(sheetName, "A2", "Alice")
	f.SetCellValue(sheetName, "B2", 30)
	f.SetCellValue(sheetName, "C2", time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC))
	f.SetCellStyle(sheetName, "C2", "C2", style)
	f.SetCellValue(sheetName, "D2", 75000.50)
	f.SetCellValue(sheetName, "E2", true)

	f.SetCellValue(sheetName, "A3", "Bob")
	f.SetCellValue(sheetName, "B3", 25)
	f.SetCellValue(sheetName, "C3", time.Date(2023, 3, 15, 0, 0, 0, 0, time.UTC))
	f.SetCellStyle(sheetName, "C3", "C3", style)
	// D3 empty
	f.SetCellValue(sheetName, "E3", false)

	f.SetCellValue(sheetName, "A4", "Charlie")
	f.SetCellValue(sheetName, "B4", 35)
	f.SetCellValue(sheetName, "C4", time.Date(2023, 6, 14, 0, 0, 0, 0, time.UTC))
	f.SetCellStyle(sheetName, "C4", "C4", style)
	f.SetCellValue(sheetName, "D4", 80000.0)
	f.SetCellValue(sheetName, "E4", true)

	// Save the file
	err = f.SaveAs(excelFile)
	require.NoError(t, err)

	// Test successful extraction
	result, err := extractor.ExtractToJSON(excelFile, sheetName)
	require.NoError(t, err)

	// Parse the JSON to verify structure
	var parsed []map[string]interface{}
	err = json.Unmarshal([]byte(result), &parsed)
	require.NoError(t, err)

	expected := []map[string]interface{}{
		{
			"Name":     "Alice",
			"Age":      30.0,
			"JoinDate": "2023-01-01T00:00:00Z",
			"Salary":   75000.5,
			"Active":   true,
		},
		{
			"Name":     "Bob",
			"Age":      25.0,
			"JoinDate": "2023-03-15T00:00:00Z",
			"Salary":   nil,
			"Active":   false,
		},
		{
			"Name":     "Charlie",
			"Age":      35.0,
			"JoinDate": "2023-06-14T00:00:00Z",
			"Salary":   80000.0,
			"Active":   true,
		},
	}

	assert.Equal(t, expected, parsed)
}

func TestExtractToJSON_EmptySheet(t *testing.T) {
	tempDir := t.TempDir()
	excelFile := filepath.Join(tempDir, "empty.xlsx")

	f := excelize.NewFile()
	defer f.Close()

	err := f.SaveAs(excelFile)
	require.NoError(t, err)

	_, err = extractor.ExtractToJSON(excelFile, "Sheet1")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no data in sheet")
}

func TestExtractToJSON_HeadersOnly(t *testing.T) {
	tempDir := t.TempDir()
	excelFile := filepath.Join(tempDir, "headers_only.xlsx")

	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Sheet1"
	headers := []string{"Name", "Age"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
	}

	err := f.SaveAs(excelFile)
	require.NoError(t, err)

	result, err := extractor.ExtractToJSON(excelFile, sheetName)
	require.NoError(t, err)

	var parsed []map[string]interface{}
	err = json.Unmarshal([]byte(result), &parsed)
	require.NoError(t, err)

	assert.Empty(t, parsed)
}

func TestExtractToJSON_FileNotFound(t *testing.T) {
	_, err := extractor.ExtractToJSON("nonexistent.xlsx", "Sheet1")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "opening file")
}

func TestExtractToJSON_SheetNotFound(t *testing.T) {
	tempDir := t.TempDir()
	excelFile := filepath.Join(tempDir, "test.xlsx")

	f := excelize.NewFile()
	defer f.Close()

	err := f.SaveAs(excelFile)
	require.NoError(t, err)

	_, err = extractor.ExtractToJSON(excelFile, "NonExistentSheet")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "reading sheet")
}

func TestExtractToJSON_InvalidExcel(t *testing.T) {
	tempDir := t.TempDir()
	invalidFile := filepath.Join(tempDir, "invalid.xlsx")

	// Create a file with invalid content
	err := os.WriteFile(invalidFile, []byte("not an excel file"), 0644)
	require.NoError(t, err)

	_, err = extractor.ExtractToJSON(invalidFile, "Sheet1")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "opening file")
}

func TestExtractToJSON_MixedDataTypes(t *testing.T) {
	tempDir := t.TempDir()
	excelFile := filepath.Join(tempDir, "mixed.xlsx")

	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Sheet1"

	customNumFmt := "yyyy-mm-dd"
	style, err := f.NewStyle(&excelize.Style{CustomNumFmt: &customNumFmt})
	require.NoError(t, err)

	// Headers
	headers := []string{"StringCol", "NumberCol", "BoolCol", "DateCol", "EmptyCol"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
	}

	// Data row
	f.SetCellValue(sheetName, "A2", "text")
	f.SetCellValue(sheetName, "B2", 42.5)
	f.SetCellValue(sheetName, "C2", true)
	f.SetCellValue(sheetName, "D2", time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC))
	f.SetCellStyle(sheetName, "D2", "D2", style)
	// E2 empty

	err = f.SaveAs(excelFile)
	require.NoError(t, err)

	result, err := extractor.ExtractToJSON(excelFile, sheetName)
	require.NoError(t, err)

	var parsed []map[string]interface{}
	err = json.Unmarshal([]byte(result), &parsed)
	require.NoError(t, err)

	require.Len(t, parsed, 1)
	record := parsed[0]
	assert.Equal(t, "text", record["StringCol"])
	assert.Equal(t, 42.5, record["NumberCol"])
	assert.Equal(t, true, record["BoolCol"])
	assert.Equal(t, "2023-01-01T00:00:00Z", record["DateCol"])
	assert.Nil(t, record["EmptyCol"])
}

func TestExtractToJSON_DateEdgeCases(t *testing.T) {
	tempDir := t.TempDir()
	excelFile := filepath.Join(tempDir, "dates.xlsx")

	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Sheet1"

	customNumFmt := "yyyy-mm-dd"
	style, err := f.NewStyle(&excelize.Style{CustomNumFmt: &customNumFmt})
	require.NoError(t, err)

	// Headers
	f.SetCellValue(sheetName, "A1", "DateCol")

	// Test various dates
	testCases := []struct {
		date     time.Time
		expected string
	}{
		{time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC), "1899-12-30T00:00:00Z"}, // Excel epoch
		{time.Date(1899, 12, 31, 0, 0, 0, 0, time.UTC), "1899-12-31T00:00:00Z"}, // Day after epoch
		{time.Date(1900, 2, 28, 0, 0, 0, 0, time.UTC), "1900-02-27T00:00:00Z"},  // Leap year handling
		{time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC), "2023-01-01T00:00:00Z"},
	}

	for i, tc := range testCases {
		cell, _ := excelize.CoordinatesToCellName(1, i+2)
		f.SetCellValue(sheetName, cell, tc.date)
		f.SetCellStyle(sheetName, cell, cell, style)
	}

	err = f.SaveAs(excelFile)
	require.NoError(t, err)

	result, err := extractor.ExtractToJSON(excelFile, sheetName)
	require.NoError(t, err)

	var parsed []map[string]interface{}
	err = json.Unmarshal([]byte(result), &parsed)
	require.NoError(t, err)

	for i, tc := range testCases {
		assert.Equal(t, tc.expected, parsed[i]["DateCol"])
	}
}

func TestExtractToJSON_JSONFormatting(t *testing.T) {
	tempDir := t.TempDir()
	excelFile := filepath.Join(tempDir, "format.xlsx")

	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Sheet1"

	// Simple data
	f.SetCellValue(sheetName, "A1", "Name")
	f.SetCellValue(sheetName, "A2", "Test")

	err := f.SaveAs(excelFile)
	require.NoError(t, err)

	result, err := extractor.ExtractToJSON(excelFile, sheetName)
	require.NoError(t, err)

	// Check that it's valid JSON
	var parsed []map[string]interface{}
	err = json.Unmarshal([]byte(result), &parsed)
	require.NoError(t, err)

	// Check pretty printing (has indentation)
	lines := strings.Split(strings.TrimSpace(result), "\n")
	assert.Greater(t, len(lines), 1, "Should be pretty-printed with multiple lines")
	assert.Contains(t, result, "  ", "Should have indentation")
}
