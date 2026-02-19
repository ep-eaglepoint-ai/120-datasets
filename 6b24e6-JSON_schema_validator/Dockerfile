FROM node:20-alpine

WORKDIR /workspace

COPY . .

RUN chmod +x setup.sh run_before.sh run_after.sh run_evaluation.sh && \
    chmod +x evaluation/evaluation.js

CMD ["/bin/sh"]
