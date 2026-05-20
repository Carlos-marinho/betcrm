FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_VERSION=1.8.3 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Poetry
RUN pip install "poetry==${POETRY_VERSION}"

# Install deps first (Docker layer cache)
COPY pyproject.toml poetry.lock* ./
RUN poetry install --no-root --without dev

# Copy app
COPY . .

# Collectstatic (em prod o build é diferente, mas deixa pronto)
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

CMD ["gunicorn", "betcrm.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
