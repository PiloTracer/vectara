# Feature: Centralización Anti-Alucinación

> **Objetivo**: Eliminar las alucinaciones del sistema RAG garantizando que toda respuesta esté fundamentada exclusivamente en datos reales del repositorio de conocimiento.

---

## 1. Diagnóstico: Estado Actual vs. Diseñado

### Qué está diseñado (documentación KI)

| Componente | Descripción |
|---|---|
| **Pipeline Multi-Etapa** | Gatherer (extracción de hechos) → Generator (síntesis de respuesta) |
| **Prompt Composer** | `app/prompts/composer.py` — ensamblaje centralizado de prompts |
| **Composición por Capas** | Layer 1: Persona del Agente → Layer 2: Instrucciones de Stage → Layer 3: Reglas Base (no negociables) |
| **Guardrails** | Regla M<N, Source Gating, Confirmation Step, vocabulario restringido |
| **Refuerzo por Recencia** | Las reglas anti-alucinación van AL FINAL del prompt (recency bias del LLM) |

### Qué está implementado (código actual)

| Componente | Estado | Archivo |
|---|---|---|
| Pipeline Multi-Etapa | ❌ No existe | Solo hay 1 llamada LLM en `chat.py:180` |
| Prompt Composer | ❌ No existe | No hay `app/prompts/` |
| Composición por Capas | ❌ No existe | Prompt inline hardcodeado en `chat.py:155-163` |
| Integración de Agents | ❌ No conectado | `agents.py` existe pero `chat.py` no lo usa |
| Source Gating | ⚠️ Parcial | El prompt dice "solo usa el contexto" pero no hay validación post-generación |
| Regla M<N | ❌ No existe | — |
| Confirmation Step | ❌ No existe | — |
| Vocabulario Restringido | ❌ No existe | El prompt permite lenguaje especulativo |

### El prompt actual (líneas 155-163 de `chat.py`)

```python
system_prompt = (
    "You are a document assistant. Answer questions based ONLY on the context provided below.\n"
    "RULES:\n"
    "1. Each PDF filename in AVAILABLE DOCUMENTS is a REAL, VALID book or document.\n"
    "2. When listing available books, list ALL filenames from AVAILABLE DOCUMENTS.\n"
    "3. Use ONLY information from the CONTEXT section to answer questions.\n"
    "4. Cite the source filename when providing information.\n"
    "5. If information is not in the context, say 'I don't have that information in the provided context.'\n\n"
)
```

**Problemas:**
- Está en inglés (el sistema se usa predominantemente en español)
- Es genérico (no tiene personalidad ni dominio)
- No tiene vocabulario restringido
- No tiene refuerzo anti-alucinación al final
- No integra el `system_prompt` del Agent configurado
- No tiene instrucciones de citación estructurada

---

## 2. Fuentes de Alucinación Identificadas

> [!CAUTION]
> Estas son las causas raíz por las que el sistema alucina actualmente.

### 2.1 Prompt débil sin restricciones duras
El prompt actual solo dice "use ONLY information from context" pero no tiene:
- Consecuencias definidas para violar esa regla
- Formato obligatorio de citación
- Vocabulario prohibido ("quizás", "probablemente", "podría ser")
- Instrucciones sobre qué hacer cuando la información es insuficiente

### 2.2 Sin validación post-generación
Después de que el LLM responde, no hay ningún chequeo de que la respuesta esté realmente fundamentada en los chunks recuperados.

### 2.3 Un solo stage hace todo
El mismo modelo extrae hechos Y genera la respuesta. Esto permite que la "creatividad" del generador contamine la extracción de hechos.

### 2.4 Sin integración de persona del Agent
La tabla `agents` tiene `system_prompt` pero el chat endpoint no lo usa. Cada Agent podría tener restricciones de dominio específicas que refuercen la veracidad.

### 2.5 Parámetros del LLM demasiado permisivos
```python
"temperature": 0.3,  # Aceptable pero podría ser más bajo para factual
"top_p": 0.7,        # Podría ser 0.5 para restringir más
```

---

## 3. Arquitectura Propuesta: Motor de Reglas Escalable

> [!TIP]
> Esta arquitectura NO es exclusiva para anti-alucinación. Es un **motor de reglas pluggable**
> que permite agregar cualquier tipo de directiva centralizada sin tocar el código del chat.

### 3.1 Módulo Centralizado de Prompts (`app/prompts/`)

```
app/prompts/
├── __init__.py
├── composer.py              ← Ensamblaje centralizado (orquestador)
├── registry.py              ← Registro de reglas activas
├── rules/
│   ├── __init__.py
│   ├── anti_hallucination.py   ← Reglas de fundamentación (inmutables)
│   ├── language.py             ← Reglas de idioma/tono (ej: responder siempre en español)
│   ├── confidentiality.py      ← Reglas de confidencialidad/GDPR
│   ├── domain_legal.py         ← Reglas para análisis jurídico
│   ├── domain_medical.py       ← Reglas para documentos médicos
│   └── custom.py               ← Reglas definidas por el usuario desde el Dashboard
├── stage_gatherer.py        ← Instrucciones para Stage 1 (extracción)
└── stage_generator.py       ← Instrucciones para Stage 2 (síntesis)
```

### 3.2 Patrón: Rule Registry (Escalabilidad)

Cada regla es un módulo Python que expone una interfaz estándar:

```python
# app/prompts/rules/anti_hallucination.py

RULE_META = {
    "id": "anti_hallucination",
    "name": "Anti-Alucinación",
    "description": "Fuerza fundamentación estricta en datos del repositorio",
    "priority": 100,       # Más alto = se inyecta más al final (más peso por recency bias)
    "enabled_by_default": True,
    "category": "safety"
}

RULE_CONTENT = """
=== REGLAS ABSOLUTAS: FUNDAMENTACIÓN ===
...
"""
```

El `registry.py` descubre y ordena las reglas automáticamente:

```python
# app/prompts/registry.py

def get_active_rules(env_config: dict = None) -> list[str]:
    """
    Retorna las reglas activas ordenadas por prioridad (menor → mayor).
    Las de mayor prioridad van AL FINAL del prompt (recency bias).
    
    env_config permite activar/desactivar reglas por entorno:
    {"rules": {"anti_hallucination": true, "domain_legal": true, "domain_medical": false}}
    """
```

### 3.3 Ejemplos de Reglas Escalables

| Regla | Caso de Uso | Prioridad |
|---|---|---|
| `anti_hallucination` | Fundamentación en datos reales (siempre activa) | 100 |
| `language` | Forzar idioma de respuesta (español/inglés) | 10 |
| `confidentiality` | No revelar datos PII, cumplimiento GDPR | 90 |
| `domain_legal` | Terminología jurídica, distinguir hechos de alegatos | 50 |
| `domain_medical` | Disclaimers médicos, no dar diagnósticos | 50 |
| `formatting` | Formato estructurado (bullets, tablas, headers) | 20 |
| `custom` | Reglas definidas por el usuario desde el Dashboard | 30 |

### 3.4 Configuración por Entorno

Las reglas se activan/desactivan **por Environment** (ya existe la tabla `environments`). Esto permite:
- Un entorno jurídico con `anti_hallucination` + `domain_legal` + `confidentiality`
- Un entorno general con solo `anti_hallucination` + `language`
- Un entorno médico con `anti_hallucination` + `domain_medical`

```python
# Se almacena en environments.config (JSONB, ya existe)
{
  "rules": {
    "anti_hallucination": true,
    "domain_legal": true,
    "confidentiality": true,
    "language": {"response_language": "es"}
  }
}
```

### 3.5 Prompt Composer — `composer.py`

El composer ahora usa el registry para ensamblar dinámicamente:

```python
def compose_system_prompt(
    agent: Optional[Agent],
    context_text: str,
    sources_list: str,
    env_config: dict = None,
    stage: str = "single"
) -> str:
    """
    Ensambla el prompt final con composición por capas:
    Layer 1: Persona del Agent (si existe)
    Layer 2: Instrucciones del Stage
    Layer 3: Contexto + Fuentes
    Layer 4: Reglas activas ordenadas por prioridad (del registry)
    """
    parts = []
    
    # Layer 1: Agent persona
    if agent and agent.system_prompt:
        parts.append(agent.system_prompt)
    
    # Layer 2: Stage instructions
    parts.append(get_stage_instructions(stage))
    
    # Layer 3: Context
    if context_text:
        parts.append(f"DOCUMENTOS DISPONIBLES:\n{sources_list}")
        parts.append(f"CONTEXTO:\n{context_text}")
    
    # Layer 4: Rules (ordered by priority — highest goes LAST)
    active_rules = get_active_rules(env_config)
    parts.extend(active_rules)
    
    return "\n\n".join(parts)
```

### 3.6 Integración en `chat.py`

El chat endpoint cambia de:
```python
# ANTES (inline, hardcoded)
system_prompt = "You are a document assistant..."
```

A:
```python
# DESPUÉS (centralizado + escalable)
from app.prompts.composer import compose_system_prompt

agent = await get_active_agent(env_id, db)
env_config = environment.config  # JSONB con reglas activas

system_prompt = compose_system_prompt(
    agent=agent,
    context_text=context_text,
    sources_list=sources_list,
    env_config=env_config
)
```

### 3.7 Parámetros del LLM más estrictos

```python
"options": {
    "temperature": 0.1,      # Casi determinístico para factual
    "top_p": 0.5,            # Más restrictivo
    "repeat_penalty": 1.2,
    "num_ctx": 8192
}
```

---

## 4. Fases de Implementación

### Fase 1 — Fundación: Motor de Reglas (Impacto inmediato) ⭐

| Cambio | Archivo | Impacto |
|---|---|---|
| Crear módulo `app/prompts/` | `[NEW]` | Hogar centralizado |
| Crear `rules/anti_hallucination.py` | `[NEW]` | Primera regla con interfaz estándar |
| Crear `rules/language.py` | `[NEW]` | Regla de idioma |
| Crear `registry.py` | `[NEW]` | Descubrimiento y ordenamiento de reglas |
| Crear `composer.py` | `[NEW]` | Composición por capas usando registry |
| Refactorizar `chat.py` para usar `composer` | `[MODIFY]` | Elimina prompt inline |
| Bajar `temperature` a 0.1, `top_p` a 0.5 | `[MODIFY] llm_service.py` | Reduce creatividad no deseada |
| Integrar `Agent.system_prompt` en el chat flow | `[MODIFY] chat.py` | Activa las personas configuradas |
| Agregar `config` field a environments | `[MODIFY] environments model` | Permite reglas por entorno |

### Fase 2 — Pipeline Multi-Etapa (Calidad superior)

| Cambio | Archivo | Impacto |
|---|---|---|
| Crear Stage 1 (Gatherer) con prompt de extracción | `[NEW] stage_gatherer.py` | Separa extracción de síntesis |
| Crear Stage 2 (Generator) con prompt de redacción | `[NEW] stage_generator.py` | Genera solo a partir de hechos extraídos |
| Modificar `chat.py` para ejecutar 2 llamadas LLM | `[MODIFY]` | Pipeline completo |
| Agregar flag `use_multi_stage` en config | `[MODIFY] config.py` | Permite activar/desactivar |

### Fase 3 — Validación Post-Generación (Máxima seguridad)

| Cambio | Archivo | Impacto |
|---|---|---|
| Crear validador de source gating | `[NEW] prompts/validator.py` | Verifica que cada claim tenga fuente |
| Agregar Confirmation Step opcional | `[MODIFY] chat.py` | Tercera llamada LLM para verificar |
| Metadata de confianza en ChatResponse | `[MODIFY] chat.py` | Devuelve métricas de fundamentación |

---

## 5. Archivos Afectados (Resumen)

### Nuevos
- `app/prompts/__init__.py`
- `app/prompts/registry.py` — Descubrimiento y ordenamiento de reglas activas
- `app/prompts/composer.py` — Ensamblador centralizado de prompts
- `app/prompts/rules/__init__.py`
- `app/prompts/rules/anti_hallucination.py` — Regla de fundamentación (prioridad 100, siempre activa)
- `app/prompts/rules/language.py` — Regla de idioma/tono
- `app/prompts/stage_gatherer.py` — Instrucciones Stage 1 (Fase 2)
- `app/prompts/stage_generator.py` — Instrucciones Stage 2 (Fase 2)
- `app/prompts/validator.py` — Validación post-generación (Fase 3)

### Modificados
- `app/routers/chat.py` — Usar composer en lugar de prompt inline
- `app/services/llm_service.py` — Parámetros más estrictos
- `app/config.py` — Nuevos flags de configuración

---

## 6. Verificación

### Tests automatizados
```bash
cd tools-iadata/back-dl
python -m pytest tests/ -v
```

### Verificación manual
1. **Test de alucinación**: Preguntar al chat algo que NO esté en los documentos.
   - **Esperado**: "Esta información no se encuentra en los documentos disponibles."
   - **Falla**: Cualquier respuesta que invente datos.

2. **Test de citación**: Preguntar algo que SÍ esté en los documentos.
   - **Esperado**: Respuesta con `[Fuente: archivo.pdf]` y bloque de cobertura al final.
   - **Falla**: Respuesta sin citas.

3. **Test M<N**: Pedir "dame 20 ejemplos de X" cuando solo hay 3.
   - **Esperado**: "Se encontraron 3 resultados de los 20 solicitados" + solo 3 items.
   - **Falla**: El sistema inventa ejemplos extras.

4. **Test de vocabulario**: Verificar que no aparezcan palabras prohibidas.
   - **Esperado**: Usa "según el documento", "el texto indica".
   - **Falla**: Usa "probablemente", "quizás".

---

## 7. Notas de Diseño

> [!IMPORTANT]
> **¿Por qué las reglas van al FINAL del prompt?**
> Los LLMs tienen un sesgo de recencia (recency bias): le dan más peso a las últimas instrucciones que leyeron. Al poner las reglas anti-alucinación al final, nos aseguramos de que sean las que más influyen en la generación, incluso si la persona del Agent o el contexto son extensos.

> [!NOTE]
> **¿Por qué español?**
> El sistema se usa predominantemente en español. Los prompts en el idioma de uso del usuario son más efectivos que los prompts traducidos, ya que el LLM no necesita "traducir mentalmente" las reglas.
