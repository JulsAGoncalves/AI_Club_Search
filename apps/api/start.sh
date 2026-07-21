#!/bin/sh
set -e

echo "[startup] Running database migrations..."
npx prisma migrate deploy

echo "[startup] Starting API server and background worker..."
node dist/server.js &
SERVER_PID=$!
node dist/worker.js &
WORKER_PID=$!

echo "[startup] Server PID=$SERVER_PID  Worker PID=$WORKER_PID"

# Forward SIGTERM/SIGINT to both child processes for graceful shutdown
trap "echo '[shutdown] Stopping...'; kill $SERVER_PID $WORKER_PID 2>/dev/null; wait; exit 0" TERM INT

wait $SERVER_PID $WORKER_PID
