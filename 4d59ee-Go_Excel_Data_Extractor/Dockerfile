FROM golang:1.24.0

ENV GOTOOLCHAIN=auto

WORKDIR /app

COPY . ./

RUN if [ -f "go.mod" ]; then go mod tidy; fi

CMD ["echo", "Ready for implementation - create go.mod, main.go and build"]

