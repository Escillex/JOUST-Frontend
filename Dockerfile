FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Compose runs this container as uid 1000; .next is an anonymous volume
# seeded from the image, so it must exist here owned by node (uid 1000)
RUN mkdir -p /app/.next && chown node:node /app/.next

EXPOSE 3000

CMD ["npm", "run", "dev"]
