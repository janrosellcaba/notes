FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
RUN groupadd --gid 1000 notes \
    && useradd --uid 1000 --gid 1000 --create-home notes \
    && mkdir -p /data \
    && chown notes:notes /data
WORKDIR /app
COPY backend/pyproject.toml /app/pyproject.toml
COPY backend/app /app/app
RUN pip install --no-cache-dir .
COPY --from=frontend /src/dist /app/static
USER 1000
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
