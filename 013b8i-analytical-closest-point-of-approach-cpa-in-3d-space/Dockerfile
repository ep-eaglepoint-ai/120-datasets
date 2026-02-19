FROM golang:1.18

WORKDIR /app

COPY repository_after/go.mod repository_after/go.sum* ./repository_after/
RUN cd repository_after && go mod download

COPY evaluation/go.mod evaluation/go.sum* ./evaluation/
RUN cd evaluation && go mod download

COPY tests/go.mod ./tests/
RUN cd tests && go mod download

COPY . /app

CMD ["go", "run", "evaluation/evaluate.go"]
