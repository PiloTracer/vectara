# Feature: Anti-Hallucination Prompt Engineering Strategy
> **ID:** PENDING-0612-prompt-base-260127  
> **Date:** 2026-01-27  
> **Status:** Planning  
> **Priority:** 🔴 Critical (Enterprise Requirement)  
> **Depends On:** PENDING-0611 (Two-Stage LLM Pipeline)

---

## 1. Contexto

Este documento define los prompts anti-alucinación **para el pipeline Two-Stage** implementado en PENDING-0611.

### Arquitectura de Referencia (de PENDING-0611)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TWO-STAGE LLM PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STAGE 1: DATA GATHERER              STAGE 2: RESPONSE GENERATOR        │
│  (gemini-flash / haiku)              (gemini-pro / opus)                │
│  ┌─────────────────────┐             ┌─────────────────────┐            │
│  │ Prompt: GATHERER    │  ──────▶   │ Prompt: GENERATOR   │            │
│  │ Tarea: Extraer      │   HECHOS    │ Tarea: Estructurar  │            │
│  │       hechos        │             │       respuesta     │            │
│  └─────────────────────┘             └─────────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ubicación de Prompts

### Estructura del Módulo

```
app/prompts/
├── __init__.py              # Registry y exports
├── gatherer.py              # Prompts para Stage 1 (Data Gatherer)
├── generator.py             # Prompts para Stage 2 (Response Generator)
├── validation.py            # Prompts para verificación de alucinaciones
└── domains/
    ├── legal.py             # Variantes para dominio legal
    └── technical.py         # Variantes para documentación técnica
```

---

## 2.5 Agent Persona System

### Concepto

Los prompts tienen **dos capas** que trabajan juntas:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PROMPT COMPOSITION                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 1: AGENT PERSONA (Configurable por Usuario)               │    │
│  │                                                                  │    │
│  │ "Eres un abogado penalista con 20 años de experiencia..."       │    │
│  │ "Act as a senior software architect..."                         │    │
│  │ "Eres un traductor profesional políglota..."                    │    │
│  │                                                                  │    │
│  │ → Define: VOZ, TONO, EXPERTISE, PERSPECTIVA                     │    │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              +                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 2: BASE RULES (Sistema - No Modificable)                  │    │
│  │                                                                  │    │
│  │ • Solo usa información de documentos                            │    │
│  │ • Cita fuentes obligatoriamente                                 │    │
│  │ • No inventes ni completes                                      │    │
│  │ • Admite cuando no hay información                              │    │
│  │                                                                  │    │
│  │ → Define: RESTRICCIONES, FORMATO, VALIDACIÓN                    │    │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              =                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ FINAL PROMPT:                                                   │    │
│  │ "Eres un abogado penalista... [PERSONA]                         │    │
│  │  PERO debes seguir estas reglas estrictas... [BASE RULES]"      │    │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Datos: Agent (EXISTENTE ✅)

> [!IMPORTANT]
> **Ya existe un modelo `Agent`** en `app/models/intelligence.py`.
> El campo `system_prompt` ya cumple la función de "persona".

**Archivo existente:** `app/models/intelligence.py`

```python
class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    env_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"))
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)           # "researcher", "coder", "analyst"
    system_prompt = Column(Text, nullable=True)     # ← ESTE ES EL "PERSONA"
    tools_config = Column(JSONB, default={})        # MCP tools habilitadas
    model_override = Column(JSONB, default={})      # LLM específico para este agent
    
    environment = relationship("Environment", back_populates="agents")
```

### Mapeo a Dos Capas

| Capa | Campo Existente | Uso |
|------|-----------------|-----|
| **Layer 1: Persona** | `Agent.system_prompt` | Define voz, tono, expertise |
| **Layer 2: Base Rules** | Nuevo código en `composer.py` | Restricciones anti-alucinación |

### Preset Roles (Ya Existen)

El endpoint `/agents/presets/roles` ya proporciona templates:

| Role | Default Prompt |
|------|----------------|
| `researcher` | "Gather information thoroughly, cite sources..." |
| `coder` | "Write clean, efficient, well-documented code..." |
| `analyst` | "Interpret data accurately, identify patterns..." |

**NO se requiere migración de DB** - solo agregar el composer.

### Prompt Composer

**Archivo:** `app/prompts/composer.py`

```python
"""
Compone prompts finales combinando Persona + Base Rules.
Garantiza que las reglas anti-alucinación SIEMPRE se apliquen.
"""

from typing import Optional
from app.models.intelligence import Agent  # ← Modelo existente

# Base rules que NUNCA se omiten
BASE_ANTI_HALLUCINATION_RULES = """
═══════════════════════════════════════════════════════════════════════
                    REGLAS OBLIGATORIAS (NO NEGOCIABLES)
═══════════════════════════════════════════════════════════════════════

Independientemente de tu rol, DEBES seguir estas reglas:

1. **SOLO INFORMACIÓN DE DOCUMENTOS**
   - Usa ÚNICAMENTE la información proporcionada
   - NUNCA uses tu conocimiento de entrenamiento
   - Si no está en los documentos → no lo menciones

2. **CITACIÓN OBLIGATORIA**
   - Cada afirmación debe incluir [📄 Fuente: archivo.pdf]
   - Sin fuente = no incluir en respuesta

3. **HONESTIDAD ANTE LIMITACIONES**
   - Si te piden N items y solo hay M: "Solo encontré M en los documentos"
   - Si no hay información: "Los documentos no contienen esta información"

4. **VOCABULARIO RESTRINGIDO**
   ❌ Prohibido: "generalmente", "podría ser", "es posible"
   ✓ Permitido: "según el documento", "el texto indica"

═══════════════════════════════════════════════════════════════════════
"""


def compose_system_prompt(
    agent: Optional[Agent],
    stage: str,  # "gatherer" | "generator"
    stage_task: str  # Instrucciones específicas del stage
) -> str:
    """
    Compone el prompt final garantizando consistencia.
    
    Estructura:
    1. Persona del Agent (Agent.system_prompt si existe)
    2. Tarea específica del Stage
    3. Reglas anti-alucinación (siempre al final para reforzar)
    """
    
    parts = []
    
    # Layer 1: Persona (usa Agent.system_prompt existente)
    if agent and agent.system_prompt:
        parts.append(f"""
╔═══════════════════════════════════════════════════════════════════════╗
║                         TU IDENTIDAD                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

{agent.system_prompt}

""")
    
    # Layer 2: Tarea del Stage
    parts.append(f"""
╔═══════════════════════════════════════════════════════════════════════╗
║                         TU TAREA ACTUAL                               ║
╚═══════════════════════════════════════════════════════════════════════╝

{stage_task}

""")
    
    # Layer 3: Reglas base (SIEMPRE al final para máximo refuerzo)
    parts.append(BASE_ANTI_HALLUCINATION_RULES)
    
    return "".join(parts)


# Ejemplos de uso
GATHERER_TASK = """
En esta fase, tu rol es EXTRAER INFORMACIÓN de los documentos.
- Lee el contexto
- Identifica hechos relevantes para la pregunta
- Lista cada hecho con su fuente
- NO interpretes, solo extrae
"""

GENERATOR_TASK = """
En esta fase, tu rol es ESTRUCTURAR LA RESPUESTA.
- Usa los hechos pre-extraídos
- Organiza de forma clara y profesional
- Mantén las citas de fuente
- Admite limitaciones si las hay
"""
```

### Ejemplos de Personas

```python
# Ejemplos de Agent.persona para diferentes casos de uso

LEGAL_EXPERT_PERSONA = """
Eres un abogado penalista con 20 años de experiencia en defensa criminal.

Tu expertise incluye:
- Análisis de expedientes judiciales
- Identificación de argumentos de defensa
- Evaluación de pruebas y testimonios
- Conocimiento de jurisprudencia

Tu estilo es:
- Riguroso y objetivo
- Usa terminología legal apropiada
- Distingue entre hechos probados y alegaciones
- No toma partido, presenta los hechos
"""

SOFTWARE_ARCHITECT_PERSONA = """
Act as a senior software architect with 15 years of experience 
in enterprise systems.

Your expertise includes:
- System design and architecture patterns
- Code review and best practices
- Technical documentation analysis
- Technology stack evaluation

Your style is:
- Technical but accessible
- Provides concrete examples when relevant
- Identifies potential issues and trade-offs
- Suggests actionable improvements
"""

TRANSLATOR_PERSONA = """
Eres un traductor profesional políglota certificado.

Tu expertise incluye:
- Traducción técnica y legal
- Adaptación cultural de contenido
- Preservación de matices y contexto
- Terminología especializada por dominio

Tu estilo es:
- Preciso y fiel al original
- Mantiene el tono del documento fuente
- Aclara términos sin equivalente directo
- Indica cuando una traducción es aproximada
"""
```

### UI: Selector de Agent

El frontend debe permitir:

1. **Crear Agents** con nombre + persona
2. **Seleccionar Agent** activo por Environment
3. **Preview** de cómo se compone el prompt final

```typescript
// AgentForm.tsx
interface AgentFormData {
  name: string;
  persona: string;  // Textarea grande para descripción rica
  config: {
    language: string;
    tone: 'formal' | 'casual' | 'technical';
    domain: 'general' | 'legal' | 'technical' | 'creative';
  };
}
```

### Integración con LLMRouter

```python
# En chat.py

async def chat_endpoint(request: ChatRequest, ...):
    # Obtener Agent activo para el environment
    agent = await get_active_agent(db, request.env_id)
    
    # Stage 1: Gatherer
    gatherer_prompt = compose_system_prompt(
        agent=agent,
        stage="gatherer",
        stage_task=GATHERER_TASK
    )
    
    gatherer_messages = [
        {"role": "system", "content": gatherer_prompt},
        {"role": "user", "content": ...}
    ]
    
    # ... gatherer execution ...
    
    # Stage 2: Generator
    generator_prompt = compose_system_prompt(
        agent=agent,
        stage="generator", 
        stage_task=GENERATOR_TASK
    )
    
    generator_messages = [
        {"role": "system", "content": generator_prompt},
        {"role": "user", "content": ...}
    ]
```

### Garantía de Consistencia

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ORDEN DE PRIORIDAD                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Si hay conflicto entre Persona y Base Rules:                           │
│                                                                         │
│  ┌─────────────────────┐                                                │
│  │ BASE RULES GANAN    │  ← Siempre van AL FINAL del prompt            │
│  └─────────────────────┘    (última instrucción = mayor peso)           │
│                                                                         │
│  Ejemplo de conflicto:                                                  │
│  - Persona: "Eres creativo y siempre das respuestas completas"         │
│  - Base Rule: "Admite cuando no hay información"                        │
│  - Resultado: Base Rule prevalece porque está al final                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Prompts por Stage

### 3.1 Stage 1: Data Gatherer Prompt

**Archivo:** `app/prompts/gatherer.py`

```python
"""
Prompts para Stage 1: Data Gatherer.
Modelo barato (gemini-flash, claude-haiku) para extraer hechos.
"""

DATA_GATHERER_SYSTEM_PROMPT = """
Eres un EXTRACTOR DE INFORMACIÓN. Tu única función es identificar y listar 
los hechos relevantes de los documentos proporcionados.

═══════════════════════════════════════════════════════════════════════
                              TU TAREA
═══════════════════════════════════════════════════════════════════════

1. LEE el contexto de documentos
2. IDENTIFICA los hechos que responden a la pregunta del usuario
3. LISTA cada hecho con su fuente exacta
4. NO interpretes, NO resumas, NO agregues información

═══════════════════════════════════════════════════════════════════════
                           REGLAS ESTRICTAS
═══════════════════════════════════════════════════════════════════════

✓ INCLUIR:
  - Hechos explícitos del documento
  - Citas textuales relevantes
  - Datos numéricos exactos
  - Nombres, fechas, lugares mencionados

✗ NUNCA INCLUIR:
  - Tu interpretación o análisis
  - Información de tu entrenamiento
  - Suposiciones o inferencias
  - Información no presente en el documento

═══════════════════════════════════════════════════════════════════════
                          FORMATO DE SALIDA
═══════════════════════════════════════════════════════════════════════

HECHOS EXTRAÍDOS:

1. [Hecho textual del documento]
   📄 Fuente: nombre_archivo.pdf

2. [Otro hecho]
   📄 Fuente: otro_archivo.pdf

...

Si NO hay hechos relevantes, responde:
"NO SE ENCONTRARON HECHOS RELEVANTES para esta pregunta en los documentos."

═══════════════════════════════════════════════════════════════════════
"""

DATA_GATHERER_USER_TEMPLATE = """
PREGUNTA DEL USUARIO:
{user_question}

DOCUMENTOS DISPONIBLES:
{available_documents}

CONTEXTO DE LOS DOCUMENTOS:
{context}

───────────────────────────────────────────────────────────────────────
TAREA: Extrae SOLO los hechos que respondan la pregunta anterior.
Cada hecho debe incluir [Fuente: archivo.pdf]
"""
```

### 3.2 Stage 2: Response Generator Prompt

**Archivo:** `app/prompts/generator.py`

```python
"""
Prompts para Stage 2: Response Generator.
Modelo premium (gemini-pro, claude-opus) para estructurar respuesta final.
"""

RESPONSE_GENERATOR_SYSTEM_PROMPT = """
Eres un REDACTOR DE RESPUESTAS profesional. Tu función es estructurar 
una respuesta clara y precisa basándote ÚNICAMENTE en los hechos 
proporcionados por el extractor.

═══════════════════════════════════════════════════════════════════════
                           REGLAS ABSOLUTAS
═══════════════════════════════════════════════════════════════════════

1. **USA SOLO LOS HECHOS PROPORCIONADOS**
   - Los hechos vienen pre-verificados con sus fuentes
   - NO agregues información adicional de tu entrenamiento
   - NO inventes hechos nuevos

2. **MANEJA INFORMACIÓN INSUFICIENTE**
   - Si los hechos no cubren toda la pregunta:
     "Según los documentos disponibles: [respuesta parcial]
      Los documentos no contienen información sobre: [aspectos faltantes]"
   - Si no hay hechos relevantes:
     "Los documentos disponibles no contienen información sobre este tema."

3. **MANTÉN LAS CITAS**
   - Preserva las fuentes [📄 Fuente: archivo.pdf] en tu respuesta
   - Agrupa información de la misma fuente cuando sea apropiado

4. **FORMATO PROFESIONAL**
   - Usa encabezados si la respuesta es larga
   - Usa listas numeradas para puntos discretos
   - Mantén un tono profesional y objetivo

5. **VOCABULARIO RESTRINGIDO**
   ❌ NO usar: "generalmente", "podría ser", "es posible", "probablemente"
   ✓ SÍ usar: "según el documento", "el texto indica", "se menciona que"

═══════════════════════════════════════════════════════════════════════
"""

RESPONSE_GENERATOR_USER_TEMPLATE = """
PREGUNTA ORIGINAL DEL USUARIO:
{user_question}

HECHOS EXTRAÍDOS DE LOS DOCUMENTOS:
{extracted_facts}

HISTORIAL DE CONVERSACIÓN:
{conversation_history}

───────────────────────────────────────────────────────────────────────
TAREA: Genera una respuesta estructurada usando ÚNICAMENTE los hechos 
anteriores. Mantén las citas de fuente en tu respuesta.
"""

# Caso especial: sin hechos encontrados
NO_FACTS_RESPONSE = """
Los documentos disponibles no contienen información relevante para 
responder esta pregunta.

**Documentos revisados:**
{documents_checked}

**Sugerencia:** Reformule la pregunta o verifique que los documentos 
correctos estén indexados.
"""
```

### 3.3 Prompt de Validación (Opcional Stage 3)

**Archivo:** `app/prompts/validation.py`

```python
"""
Prompts para validación de alucinaciones (Stage 3 opcional).
Usa modelo barato para verificar respuesta antes de enviar.
"""

HALLUCINATION_CHECK_PROMPT = """
Eres un VERIFICADOR DE HECHOS. Analiza si la respuesta contiene 
información que NO está en los hechos fuente.

HECHOS FUENTE (extraídos de documentos):
{source_facts}

RESPUESTA A VERIFICAR:
{response_to_check}

───────────────────────────────────────────────────────────────────────

Analiza cada afirmación de la respuesta y clasifícala:

RESPONDE EN JSON:
{
  "verified_claims": [
    {"claim": "texto de afirmación", "source": "archivo.pdf", "confidence": 0.95}
  ],
  "suspicious_claims": [
    {"claim": "texto sospechoso", "reason": "no encontrado en fuentes", "confidence": 0.3}
  ],
  "hallucination_detected": true/false,
  "overall_confidence": 0.0-1.0,
  "recommendation": "approve" | "flag" | "reject"
}
"""

# Thresholds para validación
VALIDATION_CONFIG = {
    "suspicious_threshold": 0.5,      # Claims con confianza < 0.5 son sospechosos
    "rejection_threshold": 3,         # Más de 3 claims sospechosos = reject
    "min_overall_confidence": 0.7     # Confianza mínima para aprobar
}
```

---

## 4. Integración con LLMRouter (PENDING-0611)

### Uso en chat.py

```python
from app.prompts.gatherer import (
    DATA_GATHERER_SYSTEM_PROMPT, 
    DATA_GATHERER_USER_TEMPLATE
)
from app.prompts.generator import (
    RESPONSE_GENERATOR_SYSTEM_PROMPT,
    RESPONSE_GENERATOR_USER_TEMPLATE,
    NO_FACTS_RESPONSE
)
from app.services.llm.router import LLMRouter

async def chat_endpoint(request: ChatRequest, ...):
    # ... retrieval code ...
    
    # ───────────────────────────────────────────────────────────
    # STAGE 1: Data Gatherer (modelo con role="gatherer")
    # ───────────────────────────────────────────────────────────
    
    gatherer_messages = [
        {"role": "system", "content": DATA_GATHERER_SYSTEM_PROMPT},
        {"role": "user", "content": DATA_GATHERER_USER_TEMPLATE.format(
            user_question=request.message,
            available_documents=sources_list,
            context=context_text
        )}
    ]
    
    gathered = await llm_router.chat(
        db=db,
        env_id=request.env_id,
        messages=gatherer_messages,
        role="gatherer"
    )
    
    extracted_facts = gathered["message"]["content"]
    
    # Check if no facts found
    if "NO SE ENCONTRARON HECHOS RELEVANTES" in extracted_facts:
        return ChatResponse(
            response=NO_FACTS_RESPONSE.format(documents_checked=sources_list),
            sources=sources,
            session_id=session.id
        )
    
    # ───────────────────────────────────────────────────────────
    # STAGE 2: Response Generator (modelo con role="generator")
    # ───────────────────────────────────────────────────────────
    
    generator_messages = [
        {"role": "system", "content": RESPONSE_GENERATOR_SYSTEM_PROMPT},
        {"role": "user", "content": RESPONSE_GENERATOR_USER_TEMPLATE.format(
            user_question=request.message,
            extracted_facts=extracted_facts,
            conversation_history=format_history(request.history)
        )}
    ]
    
    final = await llm_router.chat(
        db=db,
        env_id=request.env_id,
        messages=generator_messages,
        role="generator"
    )
    
    return ChatResponse(
        response=final["message"]["content"],
        sources=sources,
        session_id=session.id
    )
```

---

## 5. Variantes por Dominio

### 5.1 Dominio Legal

**Archivo:** `app/prompts/domains/legal.py`

```python
"""
Prompts especializados para documentos legales.
"""

LEGAL_GATHERER_ADDITIONS = """
PRESTA ATENCIÓN ESPECIAL A:
- Nombres de partes (demandante, demandado, testigos)
- Fechas de hechos y resoluciones
- Artículos de ley citados
- Pruebas mencionadas
- Decisiones y fallos judiciales
- Montos y sanciones
"""

LEGAL_GENERATOR_ADDITIONS = """
FORMATO LEGAL:
- Usa terminología jurídica apropiada
- Cita artículos de ley cuando aparezcan en las fuentes
- Distingue entre hechos probados y alegaciones
- Mantén objetividad (no tomes partido)
"""
```

---

## 6. Configuración

### Variables de Environment

```ini
# .env.dev / .env.prd

# Pipeline Mode
TWO_STAGE_ENABLED=true              # true = usa gatherer + generator
SINGLE_STAGE_FALLBACK=true          # true = fallback a single stage si falla

# Validation (Stage 3 opcional)
HALLUCINATION_CHECK_ENABLED=false   # true = verifica respuesta antes de enviar
HALLUCINATION_REJECTION_MODE=flag   # "flag" | "reject" | "log"

# Domain hints
DEFAULT_DOMAIN=general              # "general" | "legal" | "technical"
```

---

## 7. Casos de Test

### Test 1: Lista Incompleta

```
PREGUNTA: "Dame 20 argumentos de inocencia del acusado"
DOCUMENTOS: Contienen solo 5 argumentos

STAGE 1 OUTPUT (Gatherer):
HECHOS EXTRAÍDOS:
1. El acusado presentó coartada verificable [📄 Fuente: Defensa.pdf]
2. Testimonios de 3 testigos a favor [📄 Fuente: Defensa.pdf]
3. Análisis forense inconcluso [📄 Fuente: Pericial.pdf]
4. Ausencia de móvil comprobado [📄 Fuente: Defensa.pdf]
5. Cadena de custodia comprometida [📄 Fuente: Defensa.pdf]

STAGE 2 OUTPUT (Generator):
Según los documentos disponibles, se identificaron 5 argumentos de defensa:

1. **Coartada verificable** - El acusado demostró con evidencia su ubicación 
   durante los hechos. [📄 Fuente: Defensa.pdf]
...

⚠️ **Nota:** Los documentos solo contienen 5 argumentos de defensa. 
No se encontraron 15 argumentos adicionales en el material disponible.
```

### Test 2: Información Inexistente

```
PREGUNTA: "¿Cuál fue la evaluación fisicoquímica del caso?"

STAGE 1 OUTPUT (Gatherer):
NO SE ENCONTRARON HECHOS RELEVANTES para esta pregunta en los documentos.
Los documentos tratan sobre: defensa penal, testimonios, análisis forense.

STAGE 2: (No se ejecuta)

RESPUESTA FINAL:
Los documentos disponibles no contienen información sobre evaluaciones 
fisicoquímicas. Los documentos revisados se enfocan en la defensa legal 
del acusado.
```

---

## 8. Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `app/models/intelligence.py` | ✅ YA EXISTE | Modelo Agent con `system_prompt` |
| `app/routers/agents.py` | ✅ YA EXISTE | CRUD endpoints |
| `app/prompts/__init__.py` | 🆕 Crear | Exports y registry |
| `app/prompts/composer.py` | 🆕 Crear | Composición Persona + Base Rules |
| `app/prompts/gatherer.py` | 🆕 Crear | Prompts Stage 1 |
| `app/prompts/generator.py` | 🆕 Crear | Prompts Stage 2 |
| `app/prompts/validation.py` | 🆕 Crear | Prompts verificación (opcional) |
| `front-dl/.../agents/page.tsx` | ✅ YA EXISTE | UI de Agents |

---

## 9. Orden de Implementación

1. ✅ **PRIMERO**: Implementar PENDING-0611 (LLMRouter + Providers + Model Roles)
2. **LUEGO**: Implementar este documento:
   - a) ~~Crear modelo Agent~~ → **YA EXISTE** ✅
   - b) Crear `app/prompts/composer.py`
   - c) Crear prompts por stage
   - d) ~~UI para gestión de Agents~~ → **YA EXISTE** ✅
3. Modificar `chat.py` para:
   - Obtener Agent activo para el environment
   - Usar `compose_system_prompt()` con `agent.system_prompt`

**Esfuerzo estimado:** ~2 horas (reducido por infraestructura existente)

---

*Fin del documento.*
