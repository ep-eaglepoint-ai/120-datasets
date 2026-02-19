package collaborate

// RawSegment837 represents a parsed EDI segment as a map
type RawSegment837 map[string]interface{}

// EDIResponse represents the response from the EDI parsing service
type EDIResponse struct {
	Segments []RawSegment837 `json:"segments"`
}

// api struct contains the API dependencies
type api struct {
	Logger Logger
}

// Logger interface for logging operations
type Logger interface {
	Error(msg string, keysAndValues ...interface{})
}

