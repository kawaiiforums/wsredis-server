FROM node:11.6.0-alpine

RUN mkdir -p /opt/wsredis/

ADD app.js /opt/wsredis/
ADD config.js /opt/wsredis/
ADD package.json /opt/wsredis/
ADD wsredisServer.js /opt/wsredis/

WORKDIR /opt/wsredis/
RUN npm install
USER nobody
CMD ["npm", "start"]
