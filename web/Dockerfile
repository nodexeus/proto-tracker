FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL
ARG VITE_GOOGLE_REDIRECT_URI
ARG VITE_DEV_MODE

COPY package*.json ./
RUN npm ci
COPY . .

RUN npm run build:production

# Using 'serve' (smallest/simple)
FROM node:22-alpine
WORKDIR /app
RUN npm i -D serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npx", "serve", "-s", "dist", "-l", "3000"]