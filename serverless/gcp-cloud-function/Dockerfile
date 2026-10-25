# docker build -f gcp-cloud-function/Dockerfile -t vahanaiq-search .
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY gcp-cloud-function/package*.json ./
RUN npm ci --omit=dev

COPY shared ./shared
COPY gcp-cloud-function/index.js ./

USER node

EXPOSE 8080
CMD ["npm", "start"]
