"""Event loop policy compatible with async DB drivers on Windows.

On Windows the default loop is ProactorEventLoop, which psycopg (async) cannot
use. The Selector policy is the supported alternative there. On other
platforms the default is already Selector, so this is a no-op.
"""
import asyncio
import sys
import warnings


def ensure_selector_event_loop() -> None:
    """Force the Selector event loop policy on Windows; no-op elsewhere."""
    if sys.platform != "win32":
        return
    # WindowsSelectorEventLoopPolicy is deprecated in 3.14 (removal planned
    # for 3.16) but remains the supported workaround for psycopg async.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
