# API Usage Monitor - cURL Examples

## Ingest API Event

Send API usage events to the monitoring system using the `/api/ingest` endpoint.

### Basic Example

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-api-key-12345" \
  -d '{
    "tenantId": "tenant-123",
    "timestamp": "2024-01-28T10:30:00Z",
    "endpoint": "/api/users",
    "method": "GET",
    "statusCode": 200,
    "latencyMs": 150,
    "requestId": "req-abc-123"
  }'
```

### Successful Response

```json
{
  "success": true,
  "eventId": "evt_abc123xyz"
}
```

### Error Response (Invalid API Key)

```json
{
  "error": "Invalid or revoked API key"
}
```

### Error Response (Rate Limit Exceeded)

```json
{
  "error": "Rate limit exceeded"
}
```

## Multiple Event Examples

### POST Request with 4xx Error

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-api-key-12345" \
  -d '{
    "tenantId": "tenant-123",
    "timestamp": "2024-01-28T10:31:00Z",
    "endpoint": "/api/users/999",
    "method": "GET",
    "statusCode": 404,
    "latencyMs": 45,
    "requestId": "req-def-456"
  }'
```

### POST Request with High Latency

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-api-key-12345" \
  -d '{
    "tenantId": "tenant-123",
    "timestamp": "2024-01-28T10:32:00Z",
    "endpoint": "/api/reports/generate",
    "method": "POST",
    "statusCode": 200,
    "latencyMs": 3500,
    "requestId": "req-ghi-789"
  }'
```

### Server Error (5xx)

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-api-key-12345" \
  -d '{
    "tenantId": "tenant-123",
    "timestamp": "2024-01-28T10:33:00Z",
    "endpoint": "/api/database/query",
    "method": "POST",
    "statusCode": 500,
    "latencyMs": 2000,
    "requestId": "req-jkl-012"
  }'
```

### DELETE Request

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-api-key-12345" \
  -d '{
    "tenantId": "tenant-123",
    "timestamp": "2024-01-28T10:34:00Z",
    "endpoint": "/api/users/123",
    "method": "DELETE",
    "statusCode": 204,
    "latencyMs": 80,
    "requestId": "req-mno-345"
  }'
```

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string | Yes | Unique identifier for the tenant |
| `timestamp` | string/number | Yes | ISO 8601 timestamp or Unix timestamp |
| `endpoint` | string | Yes | API endpoint path (e.g., `/api/users`) |
| `method` | string | Yes | HTTP method: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS |
| `statusCode` | number | Yes | HTTP status code (100-599) |
| `latencyMs` | number | Yes | Request latency in milliseconds (must be >= 0) |
| `requestId` | string | Yes | Unique identifier for the request |

## Authentication

All ingest requests require an API key passed in the `x-api-key` header. The API key must:
- Be associated with a valid tenant
- Not be revoked
- Match the `tenantId` in the request body

## Rate Limiting

The ingest endpoint is rate-limited to **100 requests per minute** per tenant. Exceeding this limit will result in a `429 Too Many Requests` response.

## Validation Rules

- **tenantId**: Must be a non-empty string
- **timestamp**: Must be a valid ISO 8601 datetime string or Unix timestamp
- **endpoint**: Must be a non-empty string
- **method**: Must be one of: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- **statusCode**: Must be an integer between 100 and 599
- **latencyMs**: Must be a non-negative integer
- **requestId**: Must be a non-empty string

## Testing with Sample Data

To quickly test the system, you can use the demo API key created during database seeding:

```bash
# Demo API Key: demo-api-key-12345
# Demo Tenant ID: (check database after running seed)

# Generate multiple events for testing
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/ingest \
    -H "Content-Type: application/json" \
    -H "x-api-key: demo-api-key-12345" \
    -d "{
      \"tenantId\": \"tenant-123\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"endpoint\": \"/api/test\",
      \"method\": \"GET\",
      \"statusCode\": 200,
      \"latencyMs\": $((RANDOM % 500)),
      \"requestId\": \"req-test-$i\"
    }"
  sleep 0.1
done
```

## Troubleshooting

### 401 Unauthorized
- Check that the `x-api-key` header is present
- Verify the API key is correct and not revoked
- Ensure the API key exists in the database

### 403 Forbidden
- Verify the `tenantId` in the request matches the tenant associated with the API key

### 400 Bad Request
- Check that all required fields are present
- Verify field types and formats match the validation rules
- Ensure the HTTP method is one of the allowed values

### 429 Rate Limit Exceeded
- Reduce request frequency to stay under 100 requests per minute
- Implement exponential backoff in your client
- Consider batching events if possible

## Production Usage

In production, you should:
1. Use HTTPS instead of HTTP
2. Store API keys securely (environment variables, secrets manager)
3. Implement retry logic with exponential backoff
4. Monitor your ingestion rate to avoid hitting rate limits
5. Use unique, meaningful request IDs for traceability
