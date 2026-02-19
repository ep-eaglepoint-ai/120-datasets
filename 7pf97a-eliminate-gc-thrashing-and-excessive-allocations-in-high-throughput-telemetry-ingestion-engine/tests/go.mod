module tests

go 1.21

require (
	repository_after v0.0.0
	scenario-008-go-slice-realloc v0.0.0
)

replace (
	repository_after => /app/repository_after
	scenario-008-go-slice-realloc => /app/repository_before
)
