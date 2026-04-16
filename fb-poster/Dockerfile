FROM node:22-slim

# Playwright needs these system deps for Chromium
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libxshmfence1 fonts-liberation fonts-noto-color-emoji \
    ca-certificates wget --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install Playwright Chromium browser binary
RUN npx playwright install chromium

COPY tsconfig.json ./
COPY src/ ./src/

# Persist cookies and debug screenshots across restarts
VOLUME ["/app/cookies.json", "/app/commented-posts.json", "/app/scraped-posts.json"]

CMD ["node", "--import", "tsx", "src/index.ts"]
