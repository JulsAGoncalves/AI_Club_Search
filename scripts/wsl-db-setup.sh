#!/usr/bin/env bash
# Idempotent setup for CourtReach's local Postgres + Redis inside WSL Ubuntu.
# Re-run this after a WSL restart; it prints the DATABASE_URL/REDIS_URL to use.
set -e

CONF=/etc/postgresql/16/main/postgresql.conf
HBA=/etc/postgresql/16/main/pg_hba.conf

# Postgres on 5433 (5432 is taken by a Windows Postgres) and listening on all
# interfaces so Windows can reach it via the WSL IP.
sed -i "s/^#\?port = .*/port = 5433/" "$CONF"
sed -i "s/^#\?listen_addresses = .*/listen_addresses = '*'/" "$CONF"

# Allow the host to connect (dev only).
if ! grep -q "courtreach-dev" "$HBA"; then
  echo "host all all 0.0.0.0/0 scram-sha-256 # courtreach-dev" >> "$HBA"
fi

service postgresql restart
service redis-server restart
sleep 2

sudo -u postgres psql -p 5433 -c "ALTER USER postgres PASSWORD 'postgres';"
if ! sudo -u postgres psql -p 5433 -tc "SELECT 1 FROM pg_database WHERE datname='courtreach'" | grep -q 1; then
  sudo -u postgres createdb -p 5433 courtreach
fi

# Make Redis reachable from Windows too.
sed -i "s/^bind .*/bind 0.0.0.0 ::/" /etc/redis/redis.conf || true
sed -i "s/^protected-mode yes/protected-mode no/" /etc/redis/redis.conf || true
service redis-server restart
sleep 1

WSL_IP=$(hostname -I | awk '{print $1}')
echo "===================================================================="
echo "DATABASE_URL=postgresql://postgres:postgres@${WSL_IP}:5433/courtreach?schema=public"
echo "REDIS_URL=redis://${WSL_IP}:6379"
echo "===================================================================="
PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d courtreach -c 'select 1 as ok;'
redis-cli ping
