FROM python:3.12-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY docker-sync/generate_backend.py /app/generate_backend.py

CMD ["python3", "/app/generate_backend.py"]
