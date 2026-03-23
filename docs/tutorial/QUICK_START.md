# 🚀 Datalake/Vectara — Guía Rápida para Colaboradores

> Tutorial para poner el sistema a funcionar desde cero después de clonar el repo.

---

## Visión General

El proyecto tiene **2 componentes principales**:

| Componente | Qué es | Dónde vive |
|---|---|---|
| **Vectara** | App de escritorio (Tauri v2 + Rust + React 19) | `vectara/` |
| **Tools-IADATA** | Stack de IA dockerizado (FastAPI + Next.js + PostgreSQL + Qdrant + Ollama) | `tools-iadata/` |

**Vectara** es la app de escritorio que controla y orquesta los contenedores Docker de **Tools-IADATA**.

```
datalake/
├── vectara/              ← App Tauri (Rust + React)
│   ├── src/              ← Frontend React 19 + Vite
│   └── src-tauri/        ← Backend Rust (maneja Docker)
├── tools-iadata/         ← Servicios dockerizados
│   ├── back-dl/          ← API FastAPI (Python 3.11)
│   ├── front-dl/         ← Dashboard Next.js
│   ├── docker-compose.dev.yml
│   ├── bin/start.sh      ← Manager interactivo
│   └── .env.dev          ← Configuración (la creas tú)
└── docs/
```

---

## Prerrequisitos

Instalar **todo** esto antes de empezar:

### Obligatorio
- **Git**
- **Docker Desktop** (o Docker Engine + Docker Compose v2)
- **Node.js ≥ 20** + **pnpm** (`npm install -g pnpm`)
- **Rust** (via [rustup.rs](https://rustup.rs))

### Solo para Tauri en Linux
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Solo para Tauri en Windows
- **Visual Studio Build Tools 2022** con el workload "Desktop development with C++"
- **WebView2** (viene con Windows 10/11 modernos)
- Descargar desde: https://visualstudio.microsoft.com/visual-cpp-build-tools/

### Solo para Tauri en macOS
```bash
xcode-select --install
```

---

## Paso 1 — Clonar el Repositorio

```bash
git clone https://github.com/PiloTracer/vectara.git datalake
cd datalake
```

---

## Paso 2 — Configurar Tools-IADATA (Docker)

### 2.1 Crear el archivo de entorno

```bash
cd tools-iadata
cp .env.example .env.dev
```

### 2.2 Editar `.env.dev` — Valores mínimos requeridos

Abrir `.env.dev` y verificar/ajustar estos valores:

```ini
# --- Mínimos que ya vienen bien por defecto ---
ENVIRONMENT=development
COMPOSE_PROJECT_NAME=tools-iadata
DEPLOY_SUFFIX=dl_dev

# --- Base de Datos ---
DB_USER=dl_admin
DB_PASSWORD=password        # ⚠️ Cambia en producción
DB_NAME=datalake
DB_HOST_PORT=15435

# --- Puertos ---
FRONT_PORT=13000
BACK_PORT=18080
QDRANT_PORT=16333

# --- Auth (NextAuth) ---
AUTH_SECRET="dev-secret-key-123456"
AUTH_URL=http://localhost:13000
AUTH_TRUST_HOST=true

# --- LLM Local (Ollama) ---
USE_LOCAL_EMBEDDING=false    # Poner "true" si quieres AI local
USE_GPU=false                # Poner "true" si tienes GPU NVIDIA
OLLAMA_HOST=host.docker.internal
LOCAL_MODEL_NAME=qwen2.5:7b
LOCAL_EMBEDDING_MODEL_NAME=bge-m3

# --- Directorio de Datos para Ingestión ---
DATA_SOURCES_DIR=./data/sources
```

> [!IMPORTANT]
> **`DATA_SOURCES_DIR`** es la carpeta donde el sistema busca archivos para ingestar al datalake.
> Ajústala a la ruta donde tengas tus documentos (PDFs, DOCX, TXT, etc).
> - **Linux**: `DATA_SOURCES_DIR=/home/usuario/documentos/datalake`
> - **Windows**: `DATA_SOURCES_DIR=C:\Users\usuario\Documents\datalake`
>
> **Ubicación actual de datos de prueba** (máquina del propietario): `/mnt/data/tmp/datos`

### 2.3 Configuración de Keycloak (Autenticación — Opcional en dev)

Si el equipo tiene un servidor Keycloak existente:

```ini
AUTH_ISSUER_BASE=http://localhost:18090
AUTH_REALM=master
AUTH_CLIENT_ID=vectara
AUTH_CLIENT_SECRET=<pedir al admin>
```

Si **no** tienen Keycloak, el sistema funciona sin él en modo desarrollo.

### 2.4 Google Drive / SharePoint (Opcional)

Para conectar fuentes de datos cloud:

```ini
# Google Drive
GOOGLE_CLIENT_ID="<tu-client-id>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-<tu-secret>"
GOOGLE_REDIRECT_URI=http://localhost:18080/oauth/google/callback

# SharePoint / OneDrive
MS_CLIENT_ID="<tu-client-id>"
MS_CLIENT_SECRET="<tu-client-secret>"
MS_TENANT_ID="<tu-tenant-id>"
MS_REDIRECT_URI=http://localhost:18080/oauth/microsoft/callback
```

---

## Paso 3 — Levantar los Contenedores Docker

Hay **2 formas** de levantar el stack:

### Opción A: Usando el Manager Interactivo (recomendado)

```bash
cd tools-iadata
chmod +x bin/start.sh
./bin/start.sh dev
```

Se abre un menú interactivo. Seleccionar **opción 1 (Up)**.

### Opción B: Docker Compose directo

```bash
cd tools-iadata

# Sin AI local (solo PostgreSQL + Qdrant + Backend + Frontend):
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build

# CON AI local (agrega Ollama + Infinity + Reranker):
COMPOSE_PROFILES=local-llm docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build
```

### Verificar que todo está corriendo

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev ps
```

Debes ver estos servicios:

| Servicio | Puerto | Función |
|---|---|---|
| `pg-dl` | 15435 | PostgreSQL 15 |
| `ia-dl` | 16333 | Qdrant (vectores) |
| `back-dl` | 18080 | FastAPI backend |
| `front-dl` | 13000 | Next.js dashboard |

Si `USE_LOCAL_EMBEDDING=true`, también verás:

| Servicio | Puerto | Función |
|---|---|---|
| `llm-dl` | 21434 | Ollama (LLM chat) |
| `infinity` | 17997 | Servidor de embeddings |
| `reranker` | 17998 | Re-ranker para RAG |

### Probar el dashboard

Abrir: **http://localhost:13000**

### Probar el API

```bash
curl http://localhost:18080/health
# Respuesta esperada: {"status":"ok"} o similar
```

---

## Paso 4 — Configurar la App Tauri (Vectara)

### 4.1 Instalar dependencias del frontend

```bash
cd vectara
pnpm install
```

### 4.2 Ejecutar en modo desarrollo

```bash
pnpm tauri dev
```

Esto:
1. Compila el frontend Vite en `http://localhost:1420`
2. Compila el backend Rust
3. Abre la ventana de la aplicación de escritorio

> [!NOTE]
> La primera compilación de Rust toma varios minutos. Las siguientes son rápidas gracias al cache.

### 4.3 Seleccionar el entorno en la app

Al iniciar Vectara, la app pregunta el modo: **dev** o **prd**.
Seleccionar **dev**. Esto le dice a la app que busque `tools-iadata/.env.dev` y `docker-compose.dev.yml`.

> La app Tauri busca `tools-iadata/` como carpeta hermana de `vectara/`. Ambas deben estar al mismo nivel:
> ```
> datalake/
> ├── vectara/        ← aquí
> └── tools-iadata/   ← aquí (hermana)
> ```

---

## Paso 5 — Alimentar el Datalake con Datos

### 5.1 Fuentes de archivos locales

Colocar los archivos a ingestar en la carpeta configurada en `DATA_SOURCES_DIR`:

```bash
# Por defecto: tools-iadata/data/sources/
# O la ruta que hayas puesto en .env.dev
```

Formatos soportados: **PDF, DOCX, XLSX, PPTX, TXT, RTF, HTML, imágenes (OCR)**

### 5.2 Google Drive

1. Configurar las credenciales OAuth en `.env.dev` (ver Paso 2.4)
2. Desde el dashboard (http://localhost:13000), conectar tu cuenta de Google Drive
3. Seleccionar las carpetas/archivos a ingestar

### 5.3 SharePoint / OneDrive

1. Configurar las credenciales MS en `.env.dev` (ver Paso 2.4)
2. Desde el dashboard, conectar SharePoint
3. Seleccionar los sitios y bibliotecas

### 5.4 Ingestión

Desde el dashboard de IADATA (http://localhost:13000):
1. Crear un **Entorno** (Environment)
2. Agregar **Fuentes de Datos** (Data Sources) al entorno
3. Ejecutar la **indexación** — los documentos se procesan, se extraen embeddings, y se almacenan en Qdrant

---

## Paso 6 — Acceso al Colaborador

### Acceso al repositorio GitHub

El colaborador necesita acceso al repo privado. Opciones:

1. **Invitar como colaborador** en GitHub → Settings → Collaborators
2. **Token de acceso personal (PAT)** — para clonar sin ser colaborador:
   ```bash
   git clone https://<TOKEN>@github.com/PiloTracer/vectara.git datalake
   ```

### Acceso a las APIs del Datalake

Todo es local por defecto. No se necesitan credenciales externas para desarrollo.

### Acceso a datos / fuentes

El colaborador necesita:
- **Archivos locales**: compartirle la carpeta de documentos o un respaldo
- **Google Drive**: crear sus propias credenciales OAuth o compartir las existentes
- **SharePoint**: el admin de Azure AD debe agregar al colaborador

---

## Referencia Rápida de Comandos

```bash
# --- Tools-IADATA (Docker) ---
cd tools-iadata

# Levantar
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build

# Ver logs
docker compose -f docker-compose.dev.yml --env-file .env.dev logs -f --tail=100

# Detener
docker compose -f docker-compose.dev.yml --env-file .env.dev down

# Reconstruir solo el backend
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build back-dl

# Manager interactivo
./bin/start.sh dev

# --- Vectara (Tauri) ---
cd vectara
pnpm install          # Primera vez
pnpm tauri dev        # Desarrollo
pnpm tauri build      # Build producción
```

---

## Troubleshooting

| Problema | Solución |
|---|---|
| `back-dl` no arranca | Verificar que `pg-dl` esté healthy: `docker logs iadata_pg_dl_dev` |
| Puerto ocupado | Cambiar en `.env.dev`: `FRONT_PORT`, `BACK_PORT`, etc. |
| Tauri no compila | Verificar Rust: `rustup update` y dependencias de sistema |
| Tauri no encuentra `tools-iadata` | Verificar que ambas carpetas estén al mismo nivel |
| Docker out of memory | Aumentar memoria en Docker Desktop (mínimo 4GB) |
| Modelos Ollama no descargan | Verificar conexión a internet y espacio en disco (7B ≈ 4GB) |

---

## Autenticación y Credenciales

El sistema tiene **dos capas de autenticación** independientes:

### Capa 1: App Tauri (Vectara) — Autenticación del Sistema Operativo

Vectara usa **las credenciales del usuario del sistema operativo**. No hay usuario/contraseña separado.

| SO | Mecanismo | Qué necesitas |
|---|---|---|
| Linux | PAM (Pluggable Authentication Modules) | Tu usuario y contraseña de Linux |
| Windows | LogonUserW (Win32 API) | Tu usuario y contraseña de Windows |

> [!NOTE]
> El colaborador inicia sesión con su **propia cuenta del sistema operativo**.
> No se necesita crear usuarios adicionales.

### Capa 2: Dashboard IADATA (front-dl) — Keycloak / NextAuth

El dashboard web usa **Keycloak** (OIDC) a través de NextAuth.

- **Con Keycloak configurado**: El admin debe crear el usuario en Keycloak (realm configurado en `AUTH_REALM`)
- **Sin Keycloak**: En modo dev, el dashboard funciona sin autenticación forzada. Los endpoints del API están abiertos.

---

## Notas para Windows 🪟

**Rutas que deben cambiar** al correr en Windows:

| Variable en `.env.dev` | Linux | Windows |
|---|---|---|
| `DATA_SOURCES_DIR` | `/mnt/data/tmp/datos` | `C:\Users\tu-user\Documents\datos` |
| `BACKUP_DIR` | `./backups` | `./backups` (OK, es relativa) |
| `IMPORT_DIR` | `./data/import` | `./data/import` (OK, es relativa) |

**Otros ajustes para Windows:**

1. **`bin/start.sh`** no funciona en Windows (es bash). Usar Docker Compose directo:
   ```powershell
   cd tools-iadata
   docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build
   ```

2. **`host.docker.internal`** funciona nativamente en Docker Desktop para Windows — no se necesita cambiar.

3. **Tauri ya soporta Windows**: El código Rust tiene compilación condicional (`#[cfg(target_os = "windows")]`) para autenticación y manejo de rutas UNC.

4. **COMPOSE_PROFILES en PowerShell**: Usar la sintaxis de PowerShell:
   ```powershell
   $env:COMPOSE_PROFILES="local-llm"
   docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build
   ```

---

## Puertos del Sistema

| Puerto | Servicio | Protocolo |
|---|---|---|
| 1420 | Vite dev server (Tauri frontend) | HTTP |
| 13000 | Next.js Dashboard (IADATA) | HTTP |
| 18080 | FastAPI Backend (IADATA) | HTTP |
| 15435 | PostgreSQL | TCP |
| 16333 | Qdrant | HTTP |
| 21434 | Ollama (si local-llm activo) | HTTP |
| 17997 | Infinity Embeddings (si local-llm activo) | HTTP |
| 17998 | Reranker (si local-llm activo) | HTTP |
