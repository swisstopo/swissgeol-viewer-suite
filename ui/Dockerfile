FROM node:22-alpine AS build

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

RUN apk add --no-cache git

WORKDIR /app
COPY . .

WORKDIR /app/ui

RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN=$(cat /run/secrets/github_token) \
    npm install --ignore-scripts \
    && npm run build --omit=dev

# Pinned to the current patched release (nginx.org/en/security_advisories.html).
# Uses the unprivileged variant so the container doesn't run as root.
FROM nginx/nginx-unprivileged:1.31.9-alpine3.24

# Declare the non-root runtime user explicitly for static analysis.
USER nginx

WORKDIR /usr/share/nginx/html
COPY --chown=root:root --from=build /app/ui/dist/ /usr/share/nginx/html

# this nginx base image will parse the template and will move it to
# /etc/nginx/conf.d/default.conf before it starts nginx process
COPY --chown=root:root ui/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
