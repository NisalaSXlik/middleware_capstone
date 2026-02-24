FROM node:20-alpine

WORKDIR /app

# Copy package files first — Docker layer cache means npm install
# only re-runs when package.json changes, not on every source change
COPY package.json package-lock.json* ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
