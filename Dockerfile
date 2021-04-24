FROM node:alpine

WORKDIR /program

COPY package.json /program/package.json
COPY src /program/src
COPY prisma /program/prisma
COPY views /program/views
COPY static /program/static
COPY tsconfig.json /program/tsconfig.json

RUN mkdir storage
VOLUME ["/program/storage"]

RUN npm install
RUN npm run build

EXPOSE 8080
EXPOSE 5555

RUN npx prisma migrate deploy

CMD ["npm", "run", "start:prod"]
