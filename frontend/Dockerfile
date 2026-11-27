FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=https://attendx-backend-production-bb6f8a0e.up.railway.app/api
ARG VITE_WS_BASE_URL=wss://attendx-backend-production-bb6f8a0e.up.railway.app
ARG VITE_UNIVERSITY_NAME="University of Cape Coast (UCC)"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL
ENV VITE_UNIVERSITY_NAME=$VITE_UNIVERSITY_NAME

RUN npm run build && npm install -g serve

EXPOSE 4173
CMD ["sh", "-c", "serve -s dist -l ${PORT:-4173}"]
