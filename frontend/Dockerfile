FROM node:24-bookworm-slim
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
RUN chown node:node /app /app/node_modules
USER node
EXPOSE 5173
CMD ["npm", "run", "dev"]
