"""structlog ProcessorFormatter pipeline writing NDJSON to stdout."""
import logging
import logging.config
import sys

import structlog
from structlog.stdlib import ProcessorFormatter


def configure_logging(level: str = "INFO") -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    log_level = getattr(logging, level.upper(), logging.INFO)
    dict_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": ProcessorFormatter,
                "foreign_pre_chain": [
                    structlog.contextvars.merge_contextvars,
                    structlog.stdlib.add_log_level,
                    structlog.processors.TimeStamper(fmt="iso", utc=True),
                    structlog.stdlib.PositionalArgumentsFormatter(),
                ],
                "processors": [
                    ProcessorFormatter.remove_processors_meta,
                    structlog.processors.format_exc_info,
                    structlog.processors.JSONRenderer(),
                ],
            }
        },
        "handlers": {
            "stdout": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "formatter": "json",
            }
        },
        "loggers": {
            "uvicorn": {"handlers": ["stdout"], "level": log_level, "propagate": False},
            "uvicorn.error": {"handlers": ["stdout"], "level": log_level, "propagate": False},
            "uvicorn.access": {"handlers": ["stdout"], "level": log_level, "propagate": False},
            "httpx": {"handlers": ["stdout"], "level": "WARNING", "propagate": False},
        },
        "root": {"handlers": ["stdout"], "level": log_level},
    }
    logging.config.dictConfig(dict_config)
