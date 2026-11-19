# CodeLive backend image (task #49).
#
# Build context is the repository root so requirements.txt is reachable:
#   docker build -f backend/Dockerfile .
#
# Dependencies are installed into a venv in a builder stage and copied into a
# clean runtime stage, so no compiler toolchain or build cache ships in the
# final image.
FROM python:3.14.10-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt


FROM python:3.14.10-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
# app/ plus alembic.ini and alembic/ — the migrate service runs from here.
COPY --chown=app:app backend/ /app/

USER app

EXPOSE 8000

# The image has no curl; probe with the interpreter that is already installed.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"

# Access logs already come from RequestContextMiddleware (structured JSON with
# request_id), so uvicorn's own access log stays off.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
