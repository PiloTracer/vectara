"""
Rule Registry — Auto-discovers and orders active rules.

Rules are discovered from the `rules/` subpackage. Each rule module must
expose RULE_META and RULE_CONTENT (or a get_rule_content callable).

Rules with always_active=True cannot be disabled by env_config.
Rules are returned sorted by priority ASC, so the HIGHEST priority rule
is injected LAST into the prompt (exploiting LLM recency bias).

Usage:
    from app.prompts.registry import get_active_rules
    rules_text = get_active_rules(env_config)
"""
import importlib
import pkgutil
import logging
from typing import Optional

import app.prompts.rules as rules_package

logger = logging.getLogger(__name__)

# Cache of all discovered rule modules (id -> module)
_RULE_MODULES: dict = {}


def _discover_rules() -> dict:
    """
    Discover all rule modules in the `rules/` package.
    Returns a dict of {rule_id: module}.
    Run once and cached.
    """
    if _RULE_MODULES:
        return _RULE_MODULES

    for finder, name, ispkg in pkgutil.iter_modules(rules_package.__path__):
        if name.startswith("_"):
            continue  # Skip __init__ and private modules
        try:
            module = importlib.import_module(f"app.prompts.rules.{name}")
            if hasattr(module, "RULE_META") and hasattr(module, "RULE_CONTENT") or (
                hasattr(module, "RULE_META") and hasattr(module, "get_rule_content")
            ):
                rule_id = module.RULE_META.get("id", name)
                _RULE_MODULES[rule_id] = module
                logger.debug(f"Discovered rule: {rule_id} (priority={module.RULE_META.get('priority', 50)})")
            else:
                logger.warning(f"Rule module '{name}' missing RULE_META or RULE_CONTENT — skipped")
        except Exception as e:
            logger.error(f"Failed to load rule module '{name}': {e}")

    return _RULE_MODULES


def get_active_rules(env_config: Optional[dict] = None) -> list[str]:
    """
    Return active rule content strings, ordered by priority ASC.

    Args:
        env_config: Optional dict from Environment.config JSONB.
                    Expected shape: {"rules": {"anti_hallucination": true, "language": {"response_language": "es"}}}

    Returns:
        List of rule content strings in injection order (lowest priority first → highest last).
        The highest-priority rules go LAST for maximum LLM recency bias enforcement.
    """
    discovered = _discover_rules()

    rules_config = {}
    if env_config and isinstance(env_config, dict):
        rules_config = env_config.get("rules", {})

    active_rules = []

    for rule_id, module in discovered.items():
        meta = module.RULE_META
        priority = meta.get("priority", 50)
        always_active = meta.get("always_active", False)
        enabled_by_default = meta.get("enabled_by_default", True)

        # Determine if this rule is enabled
        rule_config = rules_config.get(rule_id)
        if always_active:
            enabled = True
        elif rule_config is False:
            enabled = False
        elif rule_config is True or rule_config is None:
            enabled = enabled_by_default
        elif isinstance(rule_config, dict):
            enabled = rule_config.get("enabled", enabled_by_default)
        else:
            enabled = enabled_by_default

        if not enabled:
            logger.debug(f"Rule '{rule_id}' is disabled by env_config — skipped")
            continue

        # Get rule content (support both static RULE_CONTENT and callable get_rule_content)
        if hasattr(module, "get_rule_content"):
            rule_cfg = rule_config if isinstance(rule_config, dict) else {}
            content = module.get_rule_content(rule_cfg)
        else:
            content = module.RULE_CONTENT

        active_rules.append((priority, rule_id, content))

    # Sort by priority ASC: lower priority first, highest priority (anti_hallucination=100) last
    active_rules.sort(key=lambda x: x[0])

    logger.debug(f"Active rules order: {[r[1] for r in active_rules]}")
    return [content for _, _, content in active_rules]
