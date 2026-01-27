# Feature: Anti-Hallucination Prompt Engineering Strategy
> **ID:** PENDING-0610-prompt-base-260127  
> **Date:** 2026-01-27  
> **Status:** Planning  
> **Priority:** 🔴 Critical (Enterprise Requirement)

---

## 1. Problem Analysis

### Root Cause of Hallucination

El LLM (Qwen 2.5) es el **responsable directo** de las alucinaciones, pero por razones específicas:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PIPELINE RAG ACTUAL                                                    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [1] Query → [2] bge-m3 → [3] Qdrant → [4] Reranker → [5] LLM         │
│       │          │            │            │             │            │
│       │          │            │            │             ▼            │
│       │          │            │            │      ┌──────────────┐    │
│       │          │            │            │      │ AQUÍ OCURRE  │    │
│       │          │            │            │      │ LA ALUCINACIÓN│   │
│       │          │            │            │      └──────────────┘    │
│       ▼          ▼            ▼            ▼                          │
│   NO genera  NO genera    NO genera   NO genera    GENERA TEXTO       │
│    texto      texto        texto       texto       ← ÚNICO QUE LO HACE│
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Por Qué el LLM Alucina

| Causa | Descripción |
|-------|-------------|
| **Prompt débil** | No hay instrucciones estrictas de limitación |
| **Demanda excesiva** | Usuario pide N items, documentos tienen M (M < N) |
| **Entrenamiento** | LLMs entrenados para "ser útiles" = completar siempre |
| **Sin verificación** | No hay validación post-generación |

---

## 2. Ubicación del Prompt Base

### ¿Dónde Definir el Prompt?

| Opción | Ubicación | Pros | Contras | Recomendación |
|--------|-----------|------|---------|---------------|
| **Environment (.env)** | `.env.dev` / `.env.prd` | Fácil cambiar sin deploy | Limitado a texto simple | ⚠️ Solo para flags |
| **Config File** | `app/config.py` | Centralizado, tipado | Requiere rebuild imagen | ✅ Para prompts cortos |
| **Prompt Templates** | `app/prompts/*.py` | Modular, versionable | Más archivos | ✅ **RECOMENDADO** |
| **Database** | PostgreSQL | Editable en runtime | Complejidad, migración | ⚠️ Para A/B testing |

### Estrategia Recomendada: **Prompt Templates Module**

```
app/
├── prompts/
│   ├── __init__.py          # Registry de prompts
│   ├── base.py              # System prompts base
│   ├── rag.py               # Prompts específicos RAG
│   ├── legal.py             # Prompts para dominio legal
│   └── validation.py        # Prompts para verificar alucinaciones
```

---

## 3. Solución Completa

### 3.1 Nuevo Módulo de Prompts

**Archivo:** `app/prompts/base.py`

```python
"""
Enterprise Prompt Templates.
Diseñados para minimizar alucinaciones en RAG.
"""

# Prompt base para RAG - Ultra restrictivo
RAG_SYSTEM_PROMPT = """
Eres un asistente documental. Tu ÚNICA función es responder preguntas 
usando EXCLUSIVAMENTE la información de los documentos proporcionados.

═══════════════════════════════════════════════════════════════════════
                         REGLAS ABSOLUTAS
═══════════════════════════════════════════════════════════════════════

1. **SOLO USA INFORMACIÓN DE LOS DOCUMENTOS**
   - Si la información NO está en los documentos, responde:
     "Esta información no se encuentra en los documentos disponibles."
   - NUNCA uses tu conocimiento general o de entrenamiento.

2. **NO INVENTES NI COMPLETES**
   - Si te piden N elementos y solo hay M en los documentos (M < N):
     "En los documentos solo encontré M elementos: [listar]"
   - NUNCA inventes para completar una lista.

3. **CITA SIEMPRE LA FUENTE**
   - Cada afirmación debe incluir: "[Fuente: nombre_archivo.pdf]"
   - Si no puedes citar fuente = no incluyas la afirmación.

4. **VOCABULARIO RESTRINGIDO**
   - NO uses frases como "generalmente", "podría ser", "es posible que"
   - USA frases como "según [documento]", "el documento establece"

5. **FORMATO DE RESPUESTA**
   - Usa listas numeradas cuando sea apropiado
   - Incluye citas al final de cada punto

═══════════════════════════════════════════════════════════════════════

DOCUMENTOS DISPONIBLES:
{available_documents}

CONTEXTO EXTRAÍDO DE LOS DOCUMENTOS:
{context}

═══════════════════════════════════════════════════════════════════════
IMPORTANTE: Si algo no está explícitamente en el contexto anterior,
NO lo incluyas en tu respuesta. Es preferible una respuesta corta y
precisa que una respuesta larga con invenciones.
═══════════════════════════════════════════════════════════════════════
"""

# Prompt para validar si una respuesta tiene alucinaciones
HALLUCINATION_CHECK_PROMPT = """
Analiza si la siguiente respuesta contiene información que NO está 
en el contexto proporcionado.

CONTEXTO:
{context}

RESPUESTA A VERIFICAR:
{response}

Responde SOLO con un JSON:
{{
  "has_hallucination": true/false,
  "confidence": 0.0-1.0,
  "suspicious_claims": ["claim1", "claim2"],
  "verified_claims": ["claim1", "claim2"]
}}
"""
```

### 3.2 Modificar chat.py

```python
# En chat.py líneas 154-167, REEMPLAZAR con:

from app.prompts.base import RAG_SYSTEM_PROMPT

# 2. Construct System Prompt usando template
system_prompt = RAG_SYSTEM_PROMPT.format(
    available_documents=sources_list if sources_list else "No hay documentos cargados.",
    context=context_text if context_text else "No se encontró contexto relevante."
)
```

### 3.3 Validación Post-Generación (Opcional pero Recomendado)

```python
# Nuevo archivo: app/services/hallucination_detector.py

from app.prompts.base import HALLUCINATION_CHECK_PROMPT
import json

class HallucinationDetector:
    """
    Detecta alucinaciones comparando respuesta vs contexto.
    Usa un LLM secundario para verificar.
    """
    
    async def check(
        self, 
        context: str, 
        response: str,
        llm_service
    ) -> dict:
        """
        Verifica si la respuesta contiene alucinaciones.
        """
        prompt = HALLUCINATION_CHECK_PROMPT.format(
            context=context,
            response=response
        )
        
        messages = [
            {"role": "system", "content": "Eres un verificador de hechos."},
            {"role": "user", "content": prompt}
        ]
        
        result = await llm_service.chat(messages)
        
        try:
            return json.loads(result.get("message", {}).get("content", "{}"))
        except:
            return {"has_hallucination": None, "error": "Parse failed"}
```

### 3.4 Configuración en Environment

```ini
# .env.dev / .env.prd

# Control de alucinaciones
ENABLE_HALLUCINATION_CHECK=false   # true para activar verificación
HALLUCINATION_THRESHOLD=0.3        # Umbral para warning
STRICT_RAG_MODE=true               # true = solo responde de documentos
```

---

## 4. Implementación por Fases

| Fase | Tarea | Esfuerzo | Impacto |
|------|-------|----------|---------|
| **1** | Crear `app/prompts/base.py` con prompt mejorado | 30 min | 🔴 Alto |
| **2** | Modificar `chat.py` para usar nuevo prompt | 15 min | 🔴 Alto |
| **3** | Agregar configs en `.env` | 10 min | 🟡 Medio |
| **4** | Crear `HallucinationDetector` (opcional) | 1 hr | 🟡 Medio |
| **5** | UI: Mostrar confidence/warnings | 2 hr | 🟢 Bajo |

**Total:** ~4 horas

---

## 5. Comparación: Antes vs Después

### Prompt Actual (chat.py líneas 155-162)
```python
system_prompt = (
    "You are a document assistant. Answer questions based ONLY on the context provided below.\n"
    "RULES:\n"
    "1. Each PDF filename in AVAILABLE DOCUMENTS is a REAL, VALID book or document.\n"
    # ... reglas débiles
)
```

### Prompt Mejorado
- 2x más largo con reglas explícitas
- Formato visual con separadores
- Instrucciones para listas incompletas
- Requisito de citación obligatoria
- Vocabulario restringido

---

## 6. Testing

### Test Case 1: Lista Incompleta
```
Query: "Dame 20 argumentos de inocencia"
Documentos: Solo contienen 5 argumentos

ESPERADO:
"En los documentos solo encontré 5 argumentos de defensa:
1. [Argumento 1] [Fuente: Libro Estafa.pdf]
2. [Argumento 2] [Fuente: Libro Estafa.pdf]
...
Los documentos no contienen más argumentos sobre este tema."
```

### Test Case 2: Información No Disponible
```
Query: "¿Cuál es la evaluación fisicoquímica del caso?"

ESPERADO:
"Esta información no se encuentra en los documentos disponibles.
Los documentos tratan sobre: [temas encontrados]"
```

---

## 7. Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `app/prompts/__init__.py` | 🆕 Crear | Registry de prompts |
| `app/prompts/base.py` | 🆕 Crear | Sistema de prompts anti-alucinación |
| `app/services/hallucination_detector.py` | 🆕 Crear | Validador opcional |
| `app/routers/chat.py` | ✏️ Modificar | Usar nuevo prompt |
| `.env.dev` | ✏️ Modificar | Agregar configs |

---

*Fin del documento.*
