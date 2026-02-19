FROM golang:1.22.5-alpine
WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .

CMD ["go", "test", "-v", "./tests"]


