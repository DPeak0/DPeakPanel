#!/bin/sh
set -eu

RUNTIME_DIR="${DOCKER_SYNC_OUTPUT:-/usr/share/nginx/html/backend/runtime}"

mkdir -p "${RUNTIME_DIR}"

python3 /app/generate_backend.py &
SYNC_PID=$!

cleanup() {
  if kill -0 "${SYNC_PID}" 2>/dev/null; then
    kill "${SYNC_PID}" 2>/dev/null || true
    wait "${SYNC_PID}" 2>/dev/null || true
  fi
}

trap cleanup INT TERM

nginx -g 'daemon off;' &
NGINX_PID=$!

wait "${NGINX_PID}"
EXIT_CODE=$?

cleanup
exit "${EXIT_CODE}"
