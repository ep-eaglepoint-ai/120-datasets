package main

import (
	"os"
	"time"

	"github.com/xuri/excelize/v2"
)

func main() {
	f := excelize.NewFile()
	defer f.Close()

	// Set sheet name
	sheetName := "Sheet1"
	f.SetSheetName("Sheet1", sheetName)

	customNumFmt := "yyyy-mm-dd"
	style, err := f.NewStyle(&excelize.Style{CustomNumFmt: &customNumFmt})
	if err != nil {
		panic(err)
	}

	// Add headers
	f.SetCellValue(sheetName, "A1", "Name")
	f.SetCellValue(sheetName, "B1", "Age")
	f.SetCellValue(sheetName, "C1", "JoinDate")
	f.SetCellValue(sheetName, "D1", "Salary")
	f.SetCellValue(sheetName, "E1", "Active")

	// Add data
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
	// D3 left empty for null
	f.SetCellValue(sheetName, "E3", false)

	// Get file path from command line argument or default
	filePath := "./tests/test.xlsx"
	if len(os.Args) > 1 {
		filePath = os.Args[1]
	}

	// Save file
	if err := f.SaveAs(filePath); err != nil {
		panic(err)
	}
}
