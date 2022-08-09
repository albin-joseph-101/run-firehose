FROM node:16

WORKDIR /app

COPY . /app

RUN yarn install

RUN yarn prod-build

CMD ["node", "build/index.js"]

