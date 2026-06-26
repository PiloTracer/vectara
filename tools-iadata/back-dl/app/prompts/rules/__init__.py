"""
Pluggable behavioral rule modules.

Each rule file must expose:
    RULE_META: dict — {id, name, description, priority (int), enabled_by_default (bool), category}
    RULE_CONTENT: str — The prompt text to inject.

Rules with higher priority are injected LAST in the final prompt,
exploiting the LLM's recency bias for maximum enforcement weight.
"""
