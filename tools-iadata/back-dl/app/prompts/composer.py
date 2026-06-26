"""
Prompt Composer — Centralized LLM System Prompt Assembly.

Assembles the final system prompt using layered composition:
  Layer 1: Agent persona (from DB Agent.system_prompt, if provided)
  Layer 2: Task role instructions (document assistant)
  Layer 3: Retrieved context + available document list
  Layer 4: Active behavioral rules (from Registry, ordered by priority)
            — highest priority rules injected LAST for recency bias

NEVER build system prompts outside this module.

Usage:
    from app.prompts.composer import compose_system_prompt

    system_prompt = compose_system_prompt(
        agent_persona="...",      # Optional: from Agent.system_prompt
        context_text="...",       # Retrieved RAG chunks
        sources_list="...",       # Newline-separated list of source filenames
        env_config=None,          # Optional: Environment.config JSONB dict
    )
"""
import logging
from typing import Optional

from app.prompts.registry import get_active_rules

logger = logging.getLogger(__name__)

_TASK_ROLE = """\
Eres un asistente especializado en análisis de documentos.
Tu único rol es responder preguntas basándote estrictamente en los documentos del repositorio.
No tienes opiniones propias. No tienes conocimiento fuera del contexto proporcionado.\
"""


def compose_system_prompt(
    agent_persona: Optional[str] = None,
    context_text: Optional[str] = None,
    sources_list: Optional[str] = None,
    env_config: Optional[dict] = None,
) -> str:
    """
    Compose the final system prompt for the LLM chat call.

    Args:
        agent_persona:  Optional custom persona text from Agent.system_prompt.
                        Injected as Layer 1. Falls back to _TASK_ROLE if None.
        context_text:   Retrieved and re-ranked RAG text chunks.
        sources_list:   Newline-separated filenames of all available documents.
        env_config:     Environment.config JSONB dict for per-env rule configuration.

    Returns:
        Assembled system prompt string, ready for injection as the "system" message.
    """
    parts: list[str] = []

    # ─── Layer 1: Agent Persona ───────────────────────────────────────────────
    if agent_persona and agent_persona.strip():
        parts.append(agent_persona.strip())
        logger.debug("Composer: Agent persona injected (Layer 1)")
    else:
        parts.append(_TASK_ROLE)
        logger.debug("Composer: Default task role injected (Layer 1)")

    # ─── Layer 2: Context ─────────────────────────────────────────────────────
    if sources_list and sources_list.strip():
        parts.append(f"DOCUMENTOS DISPONIBLES:\n{sources_list.strip()}")

    if context_text and context_text.strip():
        parts.append(f"CONTEXTO EXTRAÍDO DE DOCUMENTOS:\n{context_text.strip()}")
        logger.debug("Composer: RAG context injected (Layer 2)")
    else:
        parts.append(
            "CONTEXTO: No se encontraron documentos relevantes para esta consulta."
        )
        logger.debug("Composer: No-context placeholder injected (Layer 2)")

    # ─── Layer 3+: Active Rules (ordered by priority, highest last) ───────────
    active_rules = get_active_rules(env_config)
    if active_rules:
        parts.extend(active_rules)
        logger.debug(f"Composer: {len(active_rules)} rules injected (Layer 3+)")

    final_prompt = "\n\n".join(parts)
    logger.debug(f"Composer: Final system prompt length = {len(final_prompt)} chars")
    return final_prompt
