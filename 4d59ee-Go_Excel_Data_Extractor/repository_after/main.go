// Implement your solution here

package main

import (
	"fmt"
	"os"

	"go-excel-extractor/repository_after/pkg/extractor"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintf(os.Stderr, "Usage: %s <file.xlsx> <sheet_name>\n", os.Args[0])
		os.Exit(1)
	}

	filePath := os.Args[1]
	sheetName := os.Args[2]

	data, err := extractor.ExtractToJSON(filePath, sheetName)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(data)
}
