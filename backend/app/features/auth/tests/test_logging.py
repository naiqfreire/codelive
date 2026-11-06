"""Unit: NDJSON formatter contract without a database."""
import json

import structlog

from app.shared.logging import configure_logging


def test_two_events_stay_two_ndjson_lines(capsys):
    configure_logging("INFO")
    log = structlog.get_logger("app")
    log.info("probe", n=1)
    log.info("probe", n=2)
    out = capsys.readouterr().out
    lines = [l for l in out.splitlines() if l.strip()]
    assert len(lines) == 2
    for line in lines:
        obj = json.loads(line)
        assert obj["timestamp"]
        assert obj["level"]
        assert obj["event"] == "probe"
        assert "duration_ms" not in obj
