# Feature: Two-Stage LLM Pipeline with Remote API Support
> **ID:** PENDING-0611-use-api-data-gatherer-260127  
> **Date:** 2026-01-27  
> **Status:** Planning  
> **Priority:** 🔴 Critical (Quality + Cost Optimization)

---

## 1. Current State Analysis

### ❌ Problema Identificado

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ESTADO ACTUAL - DESCONECTADO                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FRONTEND (Models UI)              BACKEND (chat.py)                    │
│  ┌─────────────────────┐           ┌─────────────────────┐              │
│  │ LLMModel (DB)       │           │ LLMService          │              │
│  │ - Gemini-Pro ✓      │ ════╪════ │ - SOLO Ollama ❌    │              │
│  │ - Anthropic         │   NO      │ - Hardcoded         │              │
│  │ - OpenAI            │  CONECTADO│ - No usa DB         │              │
│  └─────────────────────┘           └─────────────────────┘              │
│                                                                         │
│  Los modelos configurados en el frontend NO se usan en chat.py          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Código Actual (chat.py línea 180)
```python
# SOLO llama a Ollama - ignora modelos de DB
llm_response = await llm_service.chat(messages)
```

---

## 2. Arquitectura Propuesta: Two-Stage Pipeline

### Concepto

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TWO-STAGE LLM PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STAGE 1: DATA GATHERER              STAGE 2: RESPONSE GENERATOR        │
│  (Modelo Barato)                     (Modelo Premium)                   │
│                                                                         │
│  ┌─────────────────────┐             ┌─────────────────────┐            │
│  │ gemini-flash        │             │ gemini-pro          │            │
│  │ claude-haiku        │             │ claude-opus         │            │
│  │ gpt-4o-mini         │             │ claude-sonnet-4     │            │
│  └──────────┬──────────┘             └──────────┬──────────┘            │
│             │                                   │                       │
│             ▼                                   ▼                       │
│  ┌─────────────────────┐             ┌─────────────────────┐            │
│  │ TAREA:              │             │ TAREA:              │            │
│  │ - Extraer hechos    │  ────────▶  │ - Estructurar       │            │
│  │ - Filtrar ruido     │   HECHOS    │ - Citar fuentes     │            │
│  │ - Identificar datos │ RELEVANTES  │ - Formato elegante  │            │
│  │ - Resumir chunks    │             │ - Respuesta final   │            │
│  └─────────────────────┘             └─────────────────────┘            │
│                                                                         │
│  COSTO: ~$0.001/query                COSTO: ~$0.01/query                │
│  TIEMPO: 500ms                       TIEMPO: 1-2s                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Requisitos del Usuario

| # | Requisito | Estado Actual | Solución |
|---|-----------|---------------|----------|
| 1 | Usar modelos de DB en lugar de Ollama | ❌ chat.py ignora DB | Crear `LLMRouter` que lea de DB |
| 2 | Modelo barato para recolectar datos | ❌ No existe | Stage 1: Data Gatherer |
| 3 | Modelo caro para respuesta final | ❌ Solo Ollama | Stage 2: Response Generator |

---

## 4. Implementación Detallada

### 4.1 Nuevo LLM Router (Lee de Base de Datos)

**Archivo:** `app/services/llm/router.py`

```python
"""
LLM Router que usa modelos configurados en la base de datos.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.llm import LLMModel
from app.services.llm.providers import get_provider
import uuid

class LLMRouter:
    """
    Enruta requests al provider correcto basado en configuración de DB.
    """
    
    async def get_model_config(
        self, 
        db: AsyncSession, 
        env_id: uuid.UUID,
        role: str = "default"  # "default", "gatherer", "generator"
    ) -> LLMModel:
        """
        Obtiene modelo de la DB según environment y rol.
        """
        # Buscar modelo con rol específico en capabilities
        if role != "default":
            result = await db.execute(
                select(LLMModel).where(
                    LLMModel.env_id == env_id,
                    LLMModel.enabled == True,
                    LLMModel.capabilities.contains({"role": role})
                )
            )
            model = result.scalars().first()
            if model:
                return model
        
        # Fallback: modelo default del environment
        result = await db.execute(
            select(LLMModel).where(
                LLMModel.env_id == env_id,
                LLMModel.is_default == True,
                LLMModel.enabled == True
            )
        )
        return result.scalars().first()
    
    async def chat(
        self,
        db: AsyncSession,
        env_id: uuid.UUID,
        messages: list,
        role: str = "default"
    ) -> dict:
        """
        Envía request al modelo configurado para el environment.
        """
        model_config = await self.get_model_config(db, env_id, role)
        
        if not model_config:
            raise ValueError(f"No model configured for env {env_id}")
        
        # Obtener provider correcto
        provider = get_provider(
            provider_type=model_config.provider,
            model_id=model_config.model_id,
            api_base_url=model_config.api_base_url,
            api_key_env_var=model_config.api_key_env_var,
            default_params=model_config.default_params
        )
        
        return await provider.chat(messages)
```

### 4.2 Provider Factory

**Archivo:** `app/services/llm/providers/__init__.py`

```python
from .ollama import OllamaProvider
from .anthropic import AnthropicProvider
from .openai import OpenAIProvider
from .google import GoogleProvider
import os

def get_provider(
    provider_type: str,
    model_id: str,
    api_base_url: str = None,
    api_key_env_var: str = None,
    default_params: dict = None
):
    """Factory para crear el provider correcto."""
    
    # Resolver API key desde environment variable
    api_key = None
    if api_key_env_var:
        api_key = os.environ.get(api_key_env_var)
    
    if provider_type == "ollama":
        return OllamaProvider(
            base_url=api_base_url or "http://ollama:11434",
            model=model_id,
            params=default_params
        )
    
    elif provider_type == "anthropic":
        return AnthropicProvider(
            api_key=api_key,
            model=model_id,
            params=default_params
        )
    
    elif provider_type == "openai":
        return OpenAIProvider(
            api_key=api_key,
            model=model_id,
            base_url=api_base_url,
            params=default_params
        )
    
    elif provider_type == "google":
        return GoogleProvider(
            api_key=api_key,
            model=model_id,
            params=default_params
        )
    
    else:
        raise ValueError(f"Unknown provider: {provider_type}")
```

### 4.3 Google Provider (Gemini)

**Archivo:** `app/services/llm/providers/google.py`

```python
import httpx
from typing import List, Dict
import os

class GoogleProvider:
    """
    Provider para Google Gemini.
    """
    
    API_BASE = "https://generativelanguage.googleapis.com/v1beta"
    
    def __init__(self, api_key: str, model: str, params: dict = None):
        self.api_key = api_key
        self.model = model
        self.params = params or {}
    
    async def chat(self, messages: List[Dict]) -> dict:
        """
        Envía mensajes a Gemini API.
        """
        # Convertir formato OpenAI → Gemini
        contents = []
        system_instruction = None
        
        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            else:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}]
                })
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            url = f"{self.API_BASE}/models/{self.model}:generateContent"
            
            payload = {
                "contents": contents,
                "generationConfig": {
                    "temperature": self.params.get("temperature", 0.3),
                    "maxOutputTokens": self.params.get("max_tokens", 4096),
                }
            }
            
            if system_instruction:
                payload["systemInstruction"] = {
                    "parts": [{"text": system_instruction}]
                }
            
            response = await client.post(
                url,
                params={"key": self.api_key},
                json=payload
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Extraer respuesta
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            
            return {
                "message": {"content": content},
                "model": self.model,
                "provider": "google"
            }
```

### 4.4 Modificar chat.py para Two-Stage Pipeline

```python
# chat.py - NUEVO FLUJO

from app.services.llm.router import LLMRouter
from app.prompts.base import DATA_GATHERER_PROMPT, RESPONSE_GENERATOR_PROMPT

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    llm_router: LLMRouter = Depends(LLMRouter),
    # ... otros services
):
    # ... retrieval code igual ...
    
    # ═══════════════════════════════════════════════════════════════
    # STAGE 1: DATA GATHERER (Modelo Barato)
    # Extrae hechos relevantes de los chunks
    # ═══════════════════════════════════════════════════════════════
    
    if context_text and request.use_two_stage:  # Nueva opción
        gatherer_messages = [
            {"role": "system", "content": DATA_GATHERER_PROMPT},
            {"role": "user", "content": f"""
PREGUNTA DEL USUARIO: {request.message}

CONTEXTO DE DOCUMENTOS:
{context_text}

TAREA: Extrae SOLO los hechos relevantes para responder la pregunta.
Formato: Lista de hechos con [Fuente: archivo.pdf] para cada uno.
"""}
        ]
        
        # Usar modelo barato (role="gatherer")
        gathered_facts = await llm_router.chat(
            db=db,
            env_id=request.env_id,
            messages=gatherer_messages,
            role="gatherer"  # Busca modelo con capabilities.role = "gatherer"
        )
        
        extracted_facts = gathered_facts.get("message", {}).get("content", "")
    else:
        extracted_facts = context_text
    
    # ═══════════════════════════════════════════════════════════════
    # STAGE 2: RESPONSE GENERATOR (Modelo Premium)
    # Genera respuesta final estructurada
    # ═══════════════════════════════════════════════════════════════
    
    generator_messages = [
        {"role": "system", "content": RESPONSE_GENERATOR_PROMPT},
        *request.history,
        {"role": "user", "content": f"""
PREGUNTA: {request.message}

HECHOS EXTRAÍDOS DE DOCUMENTOS:
{extracted_facts}

Genera una respuesta estructurada basada ÚNICAMENTE en estos hechos.
"""}
    ]
    
    # Usar modelo premium (role="generator" o default)
    final_response = await llm_router.chat(
        db=db,
        env_id=request.env_id,
        messages=generator_messages,
        role="generator"
    )
    
    return ChatResponse(
        response=final_response.get("message", {}).get("content", ""),
        sources=sources,
        session_id=session.id
    )
```

---

## 5. Configuración de Modelos en Frontend

### UI: Agregar Rol a Modelo

```typescript
// ModelForm.tsx - Nuevo campo "Role"
<Select 
  label="Rol del Modelo"
  value={model.capabilities?.role || "default"}
  onChange={(e) => setCapabilities({...capabilities, role: e.target.value})}
>
  <Option value="default">Default (Single Stage)</Option>
  <Option value="gatherer">Data Gatherer (Stage 1 - Barato)</Option>
  <Option value="generator">Response Generator (Stage 2 - Premium)</Option>
</Select>
```

### Configuración Ejemplo

| Modelo | Provider | Role | Uso |
|--------|----------|------|-----|
| gemini-1.5-flash | google | gatherer | Stage 1: Extrae hechos |
| gemini-pro | google | generator | Stage 2: Respuesta final |
| claude-3-haiku | anthropic | gatherer | Stage 1: Alternativo |
| claude-sonnet-4 | anthropic | generator | Stage 2: Máxima calidad |

---

## 6. Prompts para Two-Stage

**Archivo:** `app/prompts/base.py`

```python
# STAGE 1: Data Gatherer
DATA_GATHERER_PROMPT = """
Eres un extractor de información. Tu tarea es:
1. Leer el contexto de documentos
2. Identificar SOLO los hechos relevantes para la pregunta
3. Listar cada hecho con su fuente

REGLAS:
- NO generes información nueva
- NO interpretes, solo extrae
- Cada hecho debe tener [Fuente: archivo.pdf]
- Si no hay hechos relevantes, di "No se encontraron hechos relevantes"

FORMATO DE SALIDA:
- Hecho 1 [Fuente: documento.pdf]
- Hecho 2 [Fuente: otro.pdf]
...
"""

# STAGE 2: Response Generator  
RESPONSE_GENERATOR_PROMPT = """
Eres un asistente que genera respuestas basadas ÚNICAMENTE en los hechos 
proporcionados.

REGLAS ESTRICTAS:
1. SOLO usa los hechos listados - NO agregues información
2. Mantén las citas [Fuente: ...] en tu respuesta
3. Si los hechos no son suficientes, di "La información disponible es limitada"
4. Estructura tu respuesta de forma clara y profesional

NO inventes, NO supongas, NO completes con conocimiento general.
"""
```

---

## 7. Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FLUJO COMPLETO: TWO-STAGE RAG                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Query] → [bge-m3] → [Qdrant] → [Reranker] → [Top-10 Chunks]          │
│                                                      │                  │
│                                                      ▼                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ STAGE 1: gemini-flash / haiku ($0.001)                          │   │
│  │ INPUT: Chunks + Query                                           │   │
│  │ OUTPUT: Lista de hechos con fuentes                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                      │                                  │
│                                      ▼ Hechos extraídos                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ STAGE 2: gemini-pro / claude-sonnet-4 ($0.01)                   │   │
│  │ INPUT: Hechos + Query + History                                 │   │
│  │ OUTPUT: Respuesta final estructurada                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                      │                                  │
│                                      ▼                                  │
│                              [Respuesta al Usuario]                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Beneficios del Two-Stage Pipeline

| Beneficio | Explicación |
|-----------|-------------|
| **Menos alucinaciones** | Stage 1 filtra y ancla en fuentes |
| **Costo optimizado** | 90% del trabajo lo hace modelo barato |
| **Mejor calidad** | Modelo premium solo estructura |
| **Trazabilidad** | Hechos intermedios son auditables |
| **Flexibilidad** | Cambiar modelos sin cambiar código |

---

## 9. Archivos a Crear/Modificar

> [!IMPORTANT]
> **Sin cambios de esquema DB** - Usamos `LLMModel.capabilities` (JSONB) existente para guardar `{"role": "gatherer"}`.

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `app/models/llm.py` | ✅ YA EXISTE | Modelo con `capabilities` JSONB |
| `app/services/llm/__init__.py` | 🆕 | Export principal |
| `app/services/llm/router.py` | 🆕 | Router que lee de DB |
| `app/services/llm/providers/__init__.py` | 🆕 | Provider factory |
| `app/services/llm/providers/google.py` | 🆕 | Gemini provider |
| `app/services/llm/providers/anthropic.py` | 🆕 | Claude provider |
| `app/services/llm/providers/openai.py` | 🆕 | GPT provider |
| `app/services/llm/providers/ollama.py` | 🆕 | Migrar de llm_service.py |
| `app/prompts/base.py` | 🆕 | Prompts para stages |
| `app/routers/chat.py` | ✏️ | Two-stage pipeline |

---

## 10. Estimación de Esfuerzo

| Fase | Tarea | Esfuerzo |
|------|-------|----------|
| 1 | Crear estructura providers + router | 2 hr |
| 2 | Implementar GoogleProvider (Gemini) | 1 hr |
| 3 | Implementar AnthropicProvider | 45 min |
| 4 | Implementar OpenAIProvider | 30 min |
| 5 | Modificar chat.py para two-stage | 1.5 hr |
| 6 | Crear prompts para cada stage | 30 min |
| 7 | UI: Agregar selector de rol | 1 hr |
| 8 | Testing end-to-end | 1 hr |

**Total: ~8 horas**

---

## 11. Preguntas Pendientes

1. ¿Habilitar two-stage por defecto o como opción en UI?
2. ¿Permitir override de modelo por request (para testing)?
3. ¿Logging de hechos intermedios para auditoría?

---

*Fin del documento actualizado.*
