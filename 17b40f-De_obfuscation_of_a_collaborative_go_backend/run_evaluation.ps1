# PowerShell script to run evaluation and ensure report.json is created
param()

Write-Host "Starting evaluation process..." -ForegroundColor Green

try {
    # Start database
    Write-Host "Starting MongoDB..." -ForegroundColor Yellow
    docker compose up -d db
    Start-Sleep -Seconds 10

    # Clean database
    Write-Host "Cleaning database..." -ForegroundColor Yellow
    docker compose exec db mongosh godoc --eval "db.users.deleteMany({}); db.documents.deleteMany({})"

    # Run evaluation
    Write-Host "Running evaluation..." -ForegroundColor Yellow
    docker compose run --rm tests sh -c "cd ../evaluation && go mod download && go run evaluation.go"

    # Verify report.json exists
    if (Test-Path "report.json") {
        Write-Host "✅ report.json successfully created at root level" -ForegroundColor Green
        $fileSize = (Get-Item "report.json").Length
        Write-Host "File size: $fileSize bytes" -ForegroundColor Green
        Write-Host "First few lines of report.json:" -ForegroundColor Green
        Get-Content "report.json" -Head 10
    } else {
        Write-Host "❌ ERROR: report.json not found at root level" -ForegroundColor Red
        Write-Host "Checking if it was created elsewhere..." -ForegroundColor Yellow
        Get-ChildItem -Recurse -Name "report.json"
        exit 1
    }

    Write-Host "Evaluation completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    # Clean up
    Write-Host "Cleaning up..." -ForegroundColor Yellow
    docker compose down
}