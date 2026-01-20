# Garage Scholars Scheduling System

## Local Dev

```sh
cd app
npm install
npm run dev
```

## Functions Setup (OpenAI)

Set the OpenAI key for functions runtime (do not put in the browser env):

```sh
export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

Then deploy or update functions:

```sh
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```
