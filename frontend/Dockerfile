# CodeLive frontend image (task #49): Vite build, served by nginx.
#
# Build context is frontend/:
#   docker build -t codelive-frontend frontend
FROM node:22.22-alpine AS build

WORKDIR /app

# Layer-cache dependencies independently from sources.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# `npm run build` is `tsc --noEmit && vite build`: the typecheck gate runs here.
RUN npm run build


FROM nginx:1.31-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=6 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
