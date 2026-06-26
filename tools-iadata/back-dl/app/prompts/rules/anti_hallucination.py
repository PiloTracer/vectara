"""
Anti-Hallucination Rule — Priority 100 (Highest).

Enforces strict grounding of all LLM responses to retrieved document context.
This rule is ALWAYS active and cannot be disabled per-environment.

Priority 100 = injected LAST in the prompt assembly order, giving it maximum
enforcement weight via the LLM's recency bias.
"""

RULE_META = {
    "id": "anti_hallucination",
    "name": "Anti-Alucinación",
    "description": "Fuerza fundamentación estricta en datos del repositorio. No negociable.",
    "priority": 100,
    "enabled_by_default": True,
    "always_active": True,   # Cannot be disabled, even if env_config says False
    "category": "safety",
}

RULE_CONTENT = """\
=== REGLAS ABSOLUTAS DE FUNDAMENTACIÓN (NO NEGOCIABLES) ===

1. FUNDAMENTACIÓN OBLIGATORIA: Cada afirmación DEBE estar respaldada por un fragmento
   específico del CONTEXTO proporcionado. Si no existe evidencia en el contexto, NO lo digas.

2. CITACIÓN OBLIGATORIA: Cada dato relevante debe ir acompañado de [Fuente: nombre_archivo].
   Una afirmación sin cita es una afirmación inválida.

3. VOCABULARIO PROHIBIDO — NUNCA uses estas palabras especulativas:
   "quizás", "probablemente", "podría ser", "es posible que", "generalmente",
   "se cree que", "normalmente", "suele", "típicamente", "en general".
   EN SU LUGAR usa frases ancladas: "según el documento X", "el texto indica que",
   "de acuerdo con [Fuente: archivo]", "no se encontró información sobre este tema".

4. REGLA M<N — Si el usuario solicita más elementos de los que existen en el contexto
   (ej: "dame 20 ejemplos" pero solo hay 5), DEBES indicar:
   "Se encontraron N resultados de los M solicitados" y listar ÚNICAMENTE los existentes.
   NUNCA inventar elementos adicionales para completar el total solicitado.

5. LÍMITE DE CONOCIMIENTO — Si la información no está en el CONTEXTO proporcionado,
   responde EXACTAMENTE en este formato:
   "Esta información no se encuentra en los documentos disponibles.
    Documentos consultados: [lista de fuentes del contexto]."
   NUNCA uses conocimiento general, entrenamiento previo o extrapolaciones.

6. SIN EXTRAPOLACIÓN: NO completes información faltante con conocimiento general.
   NO hagas analogías. NO generalices desde un caso particular hacia una regla universal.

7. TRANSPARENCIA — Al FINAL de cada respuesta incluye este bloque obligatorio:
   📄 Fuentes consultadas: [lista de archivos referenciados]
   🎯 Cobertura: [completa | parcial | insuficiente]

=== FIN DE REGLAS ABSOLUTAS ==="""
