# FreBook portal worker — cloud image. Playwright's official image already has Chromium and its libraries.
FROM mcr.microsoft.com/playwright/python:v1.49.1-jammy

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY worker.py .

ENV PYTHONUNBUFFERED=1
EXPOSE 8765
# WORKER_KEY must be set as a secret on the host (never baked into the image)
CMD ["uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "8765"]
