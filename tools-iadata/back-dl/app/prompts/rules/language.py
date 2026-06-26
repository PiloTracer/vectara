"""
Language Rule — Priority 10.

Enforces the response language for the LLM. Default is Spanish.
Can be configured per-environment via env_config:
    {"rules": {"language": {"response_language": "es"}}}

Priority 10 = injected early, before safety rules — safety rules always override.
"""

RULE_META = {
    "id": "language",
    "name": "Idioma de Respuesta",
    "description": "Fuerza el idioma de respuesta del LLM.",
    "priority": 10,
    "enabled_by_default": True,
    "always_active": False,
    "category": "behavior",
}

RULE_CONTENT_ES = """\
=== IDIOMA ===
Responde SIEMPRE en español, independientemente del idioma en que esté escrita la pregunta.
Si el usuario escribe en inglés, responde en español de todas formas.
=== FIN DE IDIOMA ==="""

RULE_CONTENT_EN = """\
=== LANGUAGE ===
Respond ALWAYS in English, regardless of the language used in the question.
=== END LANGUAGE ==="""


def get_rule_content(config: dict = None) -> str:
    """Return the rule content for the configured language."""
    lang = "es"
    if config and isinstance(config, dict):
        lang = config.get("response_language", "es")
    return RULE_CONTENT_EN if lang == "en" else RULE_CONTENT_ES
