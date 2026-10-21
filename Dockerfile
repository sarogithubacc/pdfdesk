FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript qpdf ocrmypdf \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-spa tesseract-ocr-fra tesseract-ocr-deu tesseract-ocr-ita tesseract-ocr-por \
    libreoffice-writer libreoffice-calc libreoffice-impress fonts-liberation fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dependencies
COPY server.js ./
COPY public ./public
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "server.js"]
