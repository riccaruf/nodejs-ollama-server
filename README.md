# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx run dev
   ```

Ollama should be up and running on your local machine bash ( > ollama serve)
Docker service should be up and running (sudo docker service start)

- sudo docker volume create pgvector_data
- sudo docker run --name pgvector -e POSTGRES_PASSWORD=mysecret -p 5432:5432 -v pgvector_data:/var/lib/postgresql/data -d ankane/pgvector

- CREATE EXTENSION IF NOT EXISTS vector;
- SELECT * FROM pg_extension WHERE extname = 'vector';

- sudo docker logs pgvector