FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the code
COPY . .

EXPOSE 5000

# Vite needs --host to allow connections from outside the container
CMD ["npm", "run", "dev", "--", "--host"]