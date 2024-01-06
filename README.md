## Залогин в майнкрафт через телеграм для (полу)приватных серверов

Это плагин для Bukkit/Spigot/Paper, проверяет пользователя до спавна.

При попытке зайти на сервер, [стучится по HTTP](https://github.com/enovikov11/MinecraftHTTPAuth/blob/main/src/main/java/rs/tgr/minecraftauth/MinecraftHTTPAuth.java#L23) в модуль залогина http://mcauth.local:1337/.

Его можно реализовать на любом языке и проверять что угодно, например [auth-modules/telegram.js](https://github.com/enovikov11/MinecraftHTTPAuth/blob/main/auth-modules/telegram.js) присылает сообщение в телеграм где просит подтвердить залогин и проверяет что пользователь состоит в группе/чате.

### Установка

#### Плагин

Компилим java через maven, командой `mvn package`, переносим `./target/MinecraftHTTPAuth-1.0.jar` в `./mc-server/data/plugins/`

#### Модуль залогина

Важно: Если майнкрафт сервер запущен не в докере, нужно пробросить порт `1337` на `127.0.0.1:1337` и прописать `mcauth.local` в hosts
Важно: Монтирование volume нужно тк рядом с telegram.js появится mapping.json где будут пары никнейм-chatId

Добавляем в docker-compose.yml с нашим сервером

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
  - TELEGRAM_BE_MEMBER=${TELEGRAM_BE_MEMBER}
  - TELEGRAM_SUBSCRIBE_MSG=${TELEGRAM_SUBSCRIBE_MSG}
```

где
- `TELEGRAM_API_KEY` - API ключ из https://t.me/BotFather
- `TELEGRAM_BOT_URL` - t.me ссылка на бота, например `t.me/mcbot`
- `TELEGRAM_BE_MEMBER` - канал/чат где нужно быть чтобы зайти на сервер. Для канала формат `@channel_name`, для группы это число chatId
- `TELEGRAM_SUBSCRIBE_MSG` - например `Только для подписчиков канала https://t.me/channel_name`

### Пишем свой модуль залогина

- Нужно слушать 1337 порт по HTTP, прилетает POST запрос вида `http://mcauth.local:1337/?name=name&ip=ip&uuid=uuid`
- Если ответ `OK`, пользователя пускает на сервер, если нет, то этот текст прилетает в качестве текста ошибки
- Если за 300 секунд не было ответа, плагин не пустит, но на практике таймаут у клиента бывает и 30 секунд