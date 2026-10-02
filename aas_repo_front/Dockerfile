# 1단계: 빌드 환경 설정
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
#RUN npm install
RUN npm ci
COPY . .
RUN npm run build

# 2단계: 실행 환경 설정
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]