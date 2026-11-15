# Container image for Cloud Run
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

# Cloud Run injects $PORT
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
