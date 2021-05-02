FROM node:12.4.0-alpine

WORKDIR /work/

COPY ./webrtc-proxy/package.json /work/package.json

RUN npm install

COPY ./webrtc-proxy/ /work/

EXPOSE 8080

CMD npm run start
