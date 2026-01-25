#!/usr/bin/env bash

# start.sh - Tools IADATA Docker Environment Manager
# Supports: dev, stg, prd

# 1. Determine Project Root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 2. Argument Parsing / Environment Detection
TARGET_ENV="$1"

if [ -z "$TARGET_ENV" ]; then
    # Auto-detection logic
    count=0
    [ -f "$PROJECT_ROOT/.env.dev" ] && count=$((count+1)) && FOUND_ENV="dev"
    [ -f "$PROJECT_ROOT/.env.stg" ] && count=$((count+1)) && FOUND_ENV="stg"
    [ -f "$PROJECT_ROOT/.env.prd" ] && count=$((count+1)) && FOUND_ENV="prd"

    if [ $count -eq 1 ]; then
        TARGET_ENV="$FOUND_ENV"
        echo "Auto-detected environment: $TARGET_ENV"
    elif [ $count -eq 0 ]; then
        echo "❌ No .env files found in $PROJECT_ROOT"
        echo "Please copy .env.example to .env.dev, .env.stg, or .env.prd"
        exit 1
    else
        # Prompt user
        echo "Multiple environments found. Select one:"
        echo "1) Development (dev)"
        echo "2) Staging (stg)"
        echo "3) Production (prd)"
        read -p "Select option [1-3]: " env_opt
        case $env_opt in
            1) TARGET_ENV="dev" ;;
            2) TARGET_ENV="stg" ;;
            3) TARGET_ENV="prd" ;;
            *) echo "Invalid option"; exit 1 ;;
        esac
    fi
else
    # Normalize argument
    TARGET_ENV=$(echo "$TARGET_ENV" | tr '[:upper:]' '[:lower:]')
    if [[ "$TARGET_ENV" != "dev" && "$TARGET_ENV" != "stg" && "$TARGET_ENV" != "prd" ]]; then
        echo "❌ Invalid environment specified: $TARGET_ENV"
        echo "Usage: ./bin/start.sh [dev|stg|prd]"
        exit 1
    fi
fi

# 3. Configure Paths & Variables
case $TARGET_ENV in
    dev)
        COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"
        ENV_FILE="$PROJECT_ROOT/.env.dev"
        ;;
    stg)
        COMPOSE_FILE="$PROJECT_ROOT/docker-compose.stg.yml"
        ENV_FILE="$PROJECT_ROOT/.env.stg"
        ;;
    prd)
        COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prd.yml"
        ENV_FILE="$PROJECT_ROOT/.env.prd"
        ;;
esac

# 4. Load Project Name & Suffix
if [ -f "$ENV_FILE" ]; then
    PROJ_NAME=$(grep "^COMPOSE_PROJECT_NAME=" "$ENV_FILE" | tail -n 1 | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    RAW_SUFFIX=$(grep "^DEPLOY_SUFFIX=" "$ENV_FILE" | tail -n 1 | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    export DEPLOY_SUFFIX=$(echo "$RAW_SUFFIX" | tr '[:upper:]' '[:lower:]')
    
    # Extract Paths
    BACKUP_DIR=$(grep "^BACKUP_DIR=" "$ENV_FILE" | tail -n 1 | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    IMPORT_DIR=$(grep "^IMPORT_DIR=" "$ENV_FILE" | tail -n 1 | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    EXPORT_DIR=$(grep "^EXPORT_DIR=" "$ENV_FILE" | tail -n 1 | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    
    # Check for Local LLM
    USE_LOCAL=$(grep "^USE_LOCAL_EMBEDDING=" "$ENV_FILE" | tail -n 1 | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d '\r' | tr '[:upper:]' '[:lower:]')
    if [ "$USE_LOCAL" = "true" ]; then
        export COMPOSE_PROFILES="local-llm"
        echo "🟢 Local LLM Stack Enabled"
    fi
fi

if [ -z "$PROJ_NAME" ]; then
    PROJ_NAME="tools-iadata" # Default project name
fi

VOL_PREFIX="${PROJ_NAME}_"
PG_VOLUME="${VOL_PREFIX}plpg_data"
QDRANT_VOLUME="${VOL_PREFIX}qdrant_data"

# Detect Docker Compose
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose version &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "ERROR: Neither 'docker compose' nor 'docker-compose' found."
    exit 1
fi

echo "========================================="
echo "   IADATA Docker Manager"
echo "========================================="
echo "Environment:    $TARGET_ENV"
echo "Project Name:   $PROJ_NAME"
echo "Deploy Suffix:  $DEPLOY_SUFFIX"
echo "Compose File:   $COMPOSE_FILE"
echo "========================================="
echo ""

pause() {
  read -n1 -r -p "Press any key to continue..." key
  echo
}

# 5. Core Functions

# Load Backup Dir from Env or Default
if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR="./backups_${DEPLOY_SUFFIX}"
fi

# Load Import Dir from Env or Default
if [ -z "$IMPORT_DIR" ]; then
    IMPORT_DIR="./data/import"
fi

# Ensure Host Directories (Idempotent)
ensure_host_directories() {
    # 1. Backup Directory
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi

    # 2. Import Directory
    if [ ! -d "$IMPORT_DIR" ]; then
        echo "Creating import directory: $IMPORT_DIR"
        mkdir -p "$IMPORT_DIR"
    fi
}

# Ensure External Volumes Exist (Idempotent)
ensure_volumes() {
  echo "Checking external volumes..."
  
  if docker volume inspect "$PG_VOLUME" >/dev/null 2>&1; then
    echo "✓ Volume exists: $PG_VOLUME"
  else
    echo "Creating missing external volume: $PG_VOLUME"
    docker volume create "$PG_VOLUME"
    echo "✓ Volume created: $PG_VOLUME"
  fi

  if docker volume inspect "$QDRANT_VOLUME" >/dev/null 2>&1; then
    echo "✓ Volume exists: $QDRANT_VOLUME"
  else
    echo "Creating missing external volume: $QDRANT_VOLUME"
    docker volume create "$QDRANT_VOLUME"
    echo "✓ Volume created: $QDRANT_VOLUME"
  fi
}

prune_anonymous_volumes() {
  echo "Pruning unused anonymous volumes..."
  PROTECTED_VOLUMES="plpg_data ${PG_VOLUME} qdrant_data ${QDRANT_VOLUME}"
  docker volume ls -q -f dangling=true | while read -r volume_name; do
    [ -z "$volume_name" ] && continue
    if echo "$PROTECTED_VOLUMES" | grep -qw "$volume_name"; then
      echo "⚠️  PROTECTED: Skipping critical volume: $volume_name"
      continue
    fi
    echo "Removing anonymous volume: $volume_name"
    docker volume rm "$volume_name" >/dev/null 2>&1 || true
  done
  echo "Anonymous volume pruning complete."
}

ensure_directories_and_volumes() {
    ensure_host_directories
    ensure_volumes
}

# Pre-acquire LLM models before starting app stack
ensure_llm_models() {
  if [ "$USE_LOCAL" != "true" ]; then
    return 0
  fi
  
  echo ""
  echo "🤖 Pre-acquiring LLM models..."
  
  # Extract model names from env file
  EMBED_MODEL=$(grep "^LOCAL_EMBEDDING_MODEL_NAME=" "$ENV_FILE" | tail -n 1 | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
  CHAT_MODEL=$(grep "^LOCAL_MODEL_NAME=" "$ENV_FILE" | tail -n 1 | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
  EMBED_MODEL=${EMBED_MODEL:-bge-m3}
  CHAT_MODEL=${CHAT_MODEL:-qwen2.5:3b}
  
  LLM_CONTAINER="iadata_llm_${DEPLOY_SUFFIX}"
  
  # Step 1: Start only llm-dl
  echo "Starting Ollama container..."
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d llm-dl
  
  # Step 2: Wait for Ollama to be healthy
  echo "Waiting for Ollama to become ready..."
  MAX_WAIT=120
  WAITED=0
  while [ $WAITED -lt $MAX_WAIT ]; do
    if docker exec "$LLM_CONTAINER" curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
      echo "✓ Ollama is ready."
      break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    echo "  ... waiting ($WAITED/$MAX_WAIT seconds)"
  done
  
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "⚠️  Warning: Ollama did not become ready in time. Continuing anyway..."
    return 0
  fi
  
  # Step 3: Pull models
  echo "Pulling embedding model: $EMBED_MODEL..."
  docker exec "$LLM_CONTAINER" ollama pull "$EMBED_MODEL" || echo "⚠️  Failed to pull $EMBED_MODEL"
  
  echo "Pulling chat model: $CHAT_MODEL..."
  docker exec "$LLM_CONTAINER" ollama pull "$CHAT_MODEL" || echo "⚠️  Failed to pull $CHAT_MODEL"
  
  echo "✅ LLM models pre-acquired."
  echo ""
}

up() {
  clear
  ensure_directories_and_volumes
  ensure_llm_models
  echo "Bringing up environment ($TARGET_ENV)..."
  if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build; then
     echo "❌ Startup failed."
     pause
     return
  fi
  
  prune_anonymous_volumes
  echo ""
  echo "✅ Environment is up!"
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
  pause
}

build() {
  clear
  echo "Building images..."
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build
  echo "Build complete."
  pause
}

down() {
  clear
  echo "Stopping environment..."
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans
  prune_anonymous_volumes
  echo "Environment stopped."
  pause
}

restart() {
  clear
  echo "Restarting environment..."
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
  echo "Restart complete."
  pause
}

backup() {
  clear
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  echo "Manual Backup: $TIMESTAMP"
  echo "Detailed Status: [Backing up to $BACKUP_DIR]"
  
  ensure_host_directories
  
  # --- Postgres Backup ---
  if ! docker volume inspect "$PG_VOLUME" >/dev/null 2>&1; then
      echo "❌ Volume $PG_VOLUME does not exist. Skipping PG backup."
  else
      echo "Backing up Postgres Data ($PG_VOLUME)..."
      docker run --rm \
        -v "${PG_VOLUME}":/data \
        -v "$BACKUP_DIR":/backup \
        busybox sh -c "tar czvf /backup/pg_${TIMESTAMP}.tar.gz -C /data ."
      
      if [ $? -eq 0 ]; then
          echo "✓ Postgres backup successful."
          ln -sf "$BACKUP_DIR/pg_${TIMESTAMP}.tar.gz" "$BACKUP_DIR/_backup_pg.tar.gz"
      else
          echo "❌ Postgres backup failed."
      fi
  fi

  # --- Qdrant Backup ---
  if ! docker volume inspect "$QDRANT_VOLUME" >/dev/null 2>&1; then
      echo "❌ Volume $QDRANT_VOLUME does not exist. Skipping Qdrant backup."
  else
      echo "Backing up Qdrant Data ($QDRANT_VOLUME)..."
      docker run --rm \
        -v "${QDRANT_VOLUME}":/data \
        -v "$BACKUP_DIR":/backup \
        busybox sh -c "tar czvf /backup/qdrant_${TIMESTAMP}.tar.gz -C /data ."
      
      if [ $? -eq 0 ]; then
          echo "✓ Qdrant backup successful."
          ln -sf "$BACKUP_DIR/qdrant_${TIMESTAMP}.tar.gz" "$BACKUP_DIR/_backup_qdrant.tar.gz"
      else
          echo "❌ Qdrant backup failed."
      fi
  fi

  # Rotation (Keep 7 days)
  find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
  
  echo ""
  echo "✅ Backup complete."
  ls -lh "$BACKUP_DIR" | grep "$TIMESTAMP"
  pause
}

restore_backup() {
  clear
  echo "⚠️  DANGER: RESTORE BACKUP ($TARGET_ENV)"
  echo "    This will:"
  echo "    1. STOP all services."
  echo "    2. DELETE current database volumes ($PG_VOLUME, $QDRANT_VOLUME)."
  echo "    3. RESTORE from: $BACKUP_DIR/_backup_pg.tar.gz AND _backup_qdrant.tar.gz"
  echo ""
  read -p "Are you sure? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then echo "Cancelled."; pause; return; fi

  PG_BACKUP="$BACKUP_DIR/_backup_pg.tar.gz"
  QDRANT_BACKUP="$BACKUP_DIR/_backup_qdrant.tar.gz"

  if [ ! -f "$PG_BACKUP" ] && [ ! -f "$QDRANT_BACKUP" ]; then 
    echo "❌ No backup files found in $BACKUP_DIR"
    pause
    return
  fi

  echo "Stopping containers..."
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

  # --- Restore Postgres ---
  if [ -f "$PG_BACKUP" ]; then
      echo "Wiping PG Volume ($PG_VOLUME)..."
      docker volume rm "$PG_VOLUME" >/dev/null 2>&1 || true
      docker volume create "$PG_VOLUME" >/dev/null
      
      echo "Restoring PG Data..."
      docker run --rm \
        -v "${PG_VOLUME}":/data \
        -v "$BACKUP_DIR":/backup \
        busybox sh -c "tar xzvf /backup/_backup_pg.tar.gz -C /data"
      echo "✓ PG Restored."
  fi

  # --- Restore Qdrant ---
  if [ -f "$QDRANT_BACKUP" ]; then
      echo "Wiping Qdrant Volume ($QDRANT_VOLUME)..."
      docker volume rm "$QDRANT_VOLUME" >/dev/null 2>&1 || true
      docker volume create "$QDRANT_VOLUME" >/dev/null
      
      echo "Restoring Qdrant Data..."
      docker run --rm \
        -v "${QDRANT_VOLUME}":/data \
        -v "$BACKUP_DIR":/backup \
        busybox sh -c "tar xzvf /backup/_backup_qdrant.tar.gz -C /data"
      echo "✓ Qdrant Restored."
  fi

  echo "Restarting services..."
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
  
  echo "✅ Restore complete."
  pause
}

view_logs() {
  clear
  echo "Logs (Ctrl+C to exit)..."
  $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f --tail=100
  pause
}

# 6. Main Menu
while true; do
  clear
  echo "========================================="
  echo "   IADATA Manager: $TARGET_ENV"
  echo "========================================="
  echo " 1. Up (Build & Start)"
  echo " 2. Down (Stop)"
  echo " 3. Build (No Start)"
  echo " 4. Restart"
  echo " 5. View Logs"
  echo " 6. Backup (Manual)"
  echo " 7. RESTORE BACKUP (Overwrite!)"
  echo " 0. Exit"
  echo "========================================="
  echo " Backup Dir: $BACKUP_DIR"
  echo "========================================="
  read -p "Select: " opt
  case $opt in
    1) up ;;
    2) down ;;
    3) build ;;
    4) restart ;;
    5) view_logs ;;
    6) backup ;;
    7) restore_backup ;;
    0) exit 0 ;;
    *) ;;
  esac
done
