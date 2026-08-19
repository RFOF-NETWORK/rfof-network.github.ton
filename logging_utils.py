"""Logging-Helfer fuer das Projekt."""

from __future__ import annotations

import logging
import os


def configure_logging(name: str = "rfof", level: str | None = None) -> logging.Logger:
    """Konfiguriert und liefert einen Logger."""
    log_level = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )
        logger.addHandler(handler)

    logger.setLevel(getattr(logging, log_level, logging.INFO))
    logger.propagate = False
    return logger
