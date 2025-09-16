#!/bin/bash

MAX_RETRY_COUNT=10
HOST="$1"
PORT="$2"

if [ -z "$HOST" ] || [ -z "$PORT" ]; then
  echo "Usage: wait_for_port.sh <host> <port>"
  exit 1
fi

for i in $(seq 1 $MAX_RETRY_COUNT); do
  if nc -z "$HOST" "$PORT" 2>/dev/null; then
    echo "Port $PORT on $HOST is open!"
    exit 0
  else
    echo "Waiting for $HOST:$PORT... (attempt $i of $MAX_RETRY_COUNT)"
    sleep 30
  fi
done

echo "Port $PORT on $HOST did not open in time."
exit 1
