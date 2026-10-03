FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY dist/ ./dist/
RUN mkdir -p /app/data/spool
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
