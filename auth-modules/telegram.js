import { serve } from "https://deno.land/std/http/server.ts";

async function api(method, body) {
    return await fetch(`${API_URL}/${method}`, {
        method: "POST", body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    }).then(res => res.json());
}

async function isMember(userId) {
    const chat = await api("getChatMember", { chat_id: TELEGRAM_BE_MEMBER, user_id: userId });
    return chat.ok && ["creator", "administrator", "member"].includes(chat.result.status);
}

async function onMessage(chatId, text) {
    if (!await isMember(chatId)) return locale.subscribe;

    const [command, name] = text.split(" ");
    if (!["/start", "/claim"].includes(command) || !name) return locale.usage;

    if (name in mapping) return locale.registed(name);
    if (!attempts.has(name)) return locale.login;
    if (Object.values(mapping).filter(id => id === chatId).length >= MAX_NICKS_PER_TG) return locale.toomany;

    mapping[name] = chatId;
    await Deno.writeTextFile("mapping.json", JSON.stringify(mapping, null, 4));
    return locale.added(name);
}

async function onLoginAttempt(name, ip) {
    if (!(name in mapping)) {
        attempts.add(name);
        return locale.fail(name);
    };

    const attemptId = Date.now(), chatId = mapping[name], allowData = `allow${attemptId}`, denyData = `deny${attemptId}`;

    if (!await isSubscriber(chatId)) return locale.subscribe;

    if (name in sessions && sessions[name].ip === ip && Date.now() - sessions[name].time < SESSION_TIME) {
        return "OK";
    }

    const sentMessage = await api("sendMessage", {
        chat_id: chatId, text: locale.attempt(name, ip), reply_markup: {
            inline_keyboard: [
                [{ text: locale.allow, callback_data: allowData }],
                [{ text: locale.deny, callback_data: denyData }]
            ]
        }
    });

    return await Promise.race([
        new Promise(resolve => {
            callbacks[allowData] = async (queryId) => {
                sessions[name] = { ip, time: Date.now() };
                resolve("OK");

                await api("sendMessage", { chat_id: chatId, text: locale.allowed(name, ip) });
                await api("answerCallbackQuery", { callback_query_id: queryId, text: "OK" });
                await api("deleteMessage", { chat_id: chatId, message_id: sentMessage.result.message_id });
            };

            callbacks[denyData] = async (queryId) => {
                resolve(locale.nologin);
                await api("sendMessage", { chat_id: chatId, text: locale.denied(name, ip) });
                await api("answerCallbackQuery", { callback_query_id: queryId, text: "OK" });
                await api("deleteMessage", { chat_id: chatId, message_id: sentMessage.result.message_id });
            };
        }),
        new Promise(resolve => setTimeout(() => resolve(locale.nologin), WAIT_TIME))
    ]);
}

async function onRequest(req) {
    if (req.method !== "POST") return new Response("", { status: 404 });
    const url = new URL(req.url), name = url.searchParams.get("name"), ip = url.searchParams.get("ip");
    if (!name || !ip) return new Response("", { status: 400 });

    const response = await onLoginAttempt(name, ip);
    return new Response(response, { status: 200 });
}

async function pollTelegram() {
    let lastUpdateId = 0;

    while (true) {
        const updates = await api("getUpdates", { offset: lastUpdateId });

        for (const update of updates.result) {
            console.log(update);

            lastUpdateId = update.update_id + 1;
            const chatId = update?.message?.chat?.id, text = update?.message?.text,
                data = update?.callback_query?.data, queryId = update?.callback_query?.id;

            if (chatId && text) {
                const reply = await onMessage(chatId, text);
                await api("sendMessage", { chat_id: chatId, text: reply });
            }

            if (data in callbacks) {
                await callbacks[data](queryId);
                delete callbacks[data];
            }
        }
    }
}

const WAIT_TIME = 10000, SESSION_TIME = 6 * 60 * 60 * 1000, MAX_NICKS_PER_TG = 1;

const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY"),
    TELEGRAM_BOT_URL = Deno.env.get("TELEGRAM_BOT_URL"),
    TELEGRAM_BE_MEMBER = Deno.env.get("TELEGRAM_BE_MEMBER"),
    TELEGRAM_SUBSCRIBE_MSG = Deno.env.get("TELEGRAM_SUBSCRIBE_MSG"),
    API_URL = `https://api.telegram.org/bot${TELEGRAM_API_KEY}`;

if (!TELEGRAM_API_KEY || !TELEGRAM_BOT_URL || !TELEGRAM_BE_MEMBER || !TELEGRAM_SUBSCRIBE_MSG) {
    throw new Error("Set ENVs: TELEGRAM_API_KEY, TELEGRAM_BOT_URL, TELEGRAM_BE_MEMBER, TELEGRAM_SUBSCRIBE_MSG");
}

const locale = {
    registed: name => `Ник ${name} уже занят`,
    login: `Сначала нужно попробовать зайти на сервер`,
    added: name => `Теперь ${name} твой, можно логиниться на сервер`,
    usage: `Напиши /claim <твой ник в майнкрафте>`,
    fail: name => `Напиши ${TELEGRAM_BOT_URL} команду /claim ${name}`,
    attempt: (name, ip) => `Попытка входа под именем ${name} с ip ${ip}, пускаем?`,
    allow: `🟢 Разрешить вход, запомнить ip на 6ч`,
    deny: `🔴 Запретить вход`,
    allowed: (name, ip) => `Вход под именем ${name} с ip ${ip} разрешен`,
    denied: (name, ip) => `Вход под именем ${name} с ip ${ip} запрещен`,
    nologin: `Нужно подтвердить вход через телеграм ${TELEGRAM_BOT_URL}`,
    toomany: `У тебя уже есть 2 ника, больше нельзя`,
    subscribe: TELEGRAM_SUBSCRIBE_MSG,
}

const attempts = new Set(), callbacks = {}, sessions = {};
let mapping = {};
try {
    mapping = JSON.parse(await Deno.readTextFile("mapping.json"));
} catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
}

serve(onRequest, { port: 1337 });
pollTelegram();
