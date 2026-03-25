#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[deploy] %s\n' "$*"
}

abort() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

ensure_dir() {
  local dir="$1"
  [[ -d "$dir" ]] || abort "Directory not found: $dir"
}

sync_dir() {
  local src="$1"
  local dest="$2"

  ensure_dir "$src"
  mkdir -p "$dest"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$src"/ "$dest"/
    return
  fi

  find "$dest" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "$src"/. "$dest"/
}

npm_install() {
  local dir="$1"
  local mode="${2:-full}"
  ensure_dir "$dir"

  pushd "$dir" >/dev/null
  if [[ -f package-lock.json ]]; then
    if [[ "$mode" == "prod" ]]; then
      npm ci --omit=dev
    else
      npm ci
    fi
  else
    if [[ "$mode" == "prod" ]]; then
      npm install --omit=dev
    else
      npm install
    fi
  fi
  popd >/dev/null
}

APP_ROOT="${APP_ROOT:-/www/wwwroot/portfolio}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
GIT_REPO_URL="${GIT_REPO_URL:-}"

SERVER_DIR="${SERVER_DIR:-$APP_ROOT/server}"
CLIENT_DIR="${CLIENT_DIR:-$APP_ROOT/client}"
ADMIN_DIR="${ADMIN_DIR:-$APP_ROOT/admin}"

CLIENT_WEB_ROOT="${CLIENT_WEB_ROOT:-/www/wwwroot/nguyenquangson.id.vn}"
ADMIN_WEB_ROOT="${ADMIN_WEB_ROOT:-/www/wwwroot/admin.nguyenquangson.id.vn}"

API_RESTART_CMD="${API_RESTART_CMD:-}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-https://api.nguyenquangson.id.vn/api/ping}"

log "Deploy branch: $DEPLOY_BRANCH"
log "App root: $APP_ROOT"

if [[ ! -d "$APP_ROOT/.git" ]]; then
  [[ -n "$GIT_REPO_URL" ]] || abort "Missing git repository at $APP_ROOT and GIT_REPO_URL is empty."
  log "Repository not found, cloning from $GIT_REPO_URL"
  mkdir -p "$(dirname "$APP_ROOT")"
  git clone --branch "$DEPLOY_BRANCH" "$GIT_REPO_URL" "$APP_ROOT"
fi

pushd "$APP_ROOT" >/dev/null
git fetch --all --prune
git checkout "$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"
popd >/dev/null

log "Install dependencies"
npm_install "$SERVER_DIR" "prod"
npm_install "$CLIENT_DIR" "full"
npm_install "$ADMIN_DIR" "full"

log "Build frontend apps"
pushd "$CLIENT_DIR" >/dev/null
npm run build
popd >/dev/null

pushd "$ADMIN_DIR" >/dev/null
npm run build
popd >/dev/null

log "Sync client dist -> $CLIENT_WEB_ROOT"
sync_dir "$CLIENT_DIR/dist" "$CLIENT_WEB_ROOT"

log "Sync admin dist -> $ADMIN_WEB_ROOT"
sync_dir "$ADMIN_DIR/dist" "$ADMIN_WEB_ROOT"

if [[ -n "$API_RESTART_CMD" ]]; then
  log "Restart API with custom command"
  bash -lc "$API_RESTART_CMD"
elif command -v pm2 >/dev/null 2>&1; then
  if pm2 describe portfolio-api >/dev/null 2>&1; then
    log "Restart API with pm2 app: portfolio-api"
    pm2 restart portfolio-api
  elif pm2 describe server >/dev/null 2>&1; then
    log "Restart API with pm2 app: server"
    pm2 restart server
  else
    log "pm2 found, but no known app name. Set API_RESTART_CMD to force restart command."
  fi
else
  log "No restart command configured. Restart Node service manually in aaPanel."
fi

if [[ -n "$HEALTHCHECK_URL" ]]; then
  log "Healthcheck: $HEALTHCHECK_URL"
  curl -fsS --max-time 20 "$HEALTHCHECK_URL" >/dev/null
fi

log "Deploy completed successfully."
