"""Selector loop on Windows: psycopg async cannot run on ProactorEventLoop."""
import asyncio
import sys
import warnings

from app.shared.asyncio_policy import ensure_selector_event_loop


def test_win32_sets_windows_selector_policy(monkeypatch):
    """On Windows the helper must install the Selector loop policy."""
    monkeypatch.setattr(sys, "platform", "win32")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        original = asyncio.get_event_loop_policy()
        fake_policy_class = type(original)
        setattr(asyncio, "WindowsSelectorEventLoopPolicy", fake_policy_class)
        try:
            ensure_selector_event_loop()
            assert isinstance(asyncio.get_event_loop_policy(), fake_policy_class)
        finally:
            delattr(asyncio, "WindowsSelectorEventLoopPolicy")
            asyncio.set_event_loop_policy(original)


def test_non_win32_keeps_current_policy(monkeypatch):
    monkeypatch.setattr(sys, "platform", "linux")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        original = asyncio.get_event_loop_policy()
        ensure_selector_event_loop()
        assert asyncio.get_event_loop_policy() is original
