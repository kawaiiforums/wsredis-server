FROM node:14-alpine

ARG BUILD_DATE
ARG BUILD_VERSION

LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.version=$BUILD_VERSION

WORKDIR /opt/wsredis
COPY ${PWD} /opt/wsredis

RUN npm install && npm cache clean --force

USER node
CMD ["node", "app.js"]
