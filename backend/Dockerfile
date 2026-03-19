FROM python:3.12-slim

# Set working directory inside the container
WORKDIR /app

# Install system deps needed by some Python packages (e.g. cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first so Docker layer caches them
# independently of application code changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/

# Create a non-root user — running as root is a bad habit even in containers
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

# Railway injects $PORT; default to 8000 for local docker-compose use
ENV PORT=8000

EXPOSE $PORT

# --workers 2 is intentionally conservative: the SSE streaming endpoint holds
# connections open, so we want to avoid exhausting the process pool.
# Scale horizontally in Railway instead of vertically per container.
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2
