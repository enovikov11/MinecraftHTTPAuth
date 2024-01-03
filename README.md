build - `mvn package`

```
mcauth.local:
restart: always
image: denoland/deno:alpine
working_dir: /app
command: run --allow-all telegram.js
volumes:
  - ./mcauth:/app
environment:
  - TELEGRAM_API_KEY=${TELEGRAM_API_KEY}
  - TELEGRAM_BOT_URL=${TELEGRAM_BOT_URL}
  - TELEGRAM_CHANNEL=${TELEGRAM_CHANNEL}
```