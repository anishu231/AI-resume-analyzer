# FROM python:3.11-slim

# RUN useradd -m -u 1000 user
# USER user
# ENV PATH="/home/user/.local/bin:$PATH"

# WORKDIR /app

# COPY --chown=user requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Download spaCy model
# RUN python -m spacy download en_core_web_sm

# COPY --chown=user . .

# CMD ["sh", "-c", "python manage.py migrate && gunicorn ats_checker.wsgi --bind 0.0.0.0:7860 --workers 2 --timeout 120"]

FROM node:22-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/ai-resume-frontend/package.json frontend/ai-resume-frontend/package-lock.json ./
RUN npm ci

COPY frontend/ai-resume-frontend/ ./
RUN npm run build

FROM python:3.11

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

COPY --from=frontend-build /frontend/dist /app/frontend-build


EXPOSE 7860

CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn ats_checker.wsgi:application --bind 0.0.0.0:7860"]
