import { red, green, yellow, bold, cyan } from "https://deno.land/std@0.221.0/fmt/colors.ts";

class MessageDeleter {
    constructor() {
        this.throttleTime = 2000;
        this.queue = new Set();
        this.offset = 0;
        this.targetId = "";
        this.guildId = "";
        this.token = "";
    }

    async delay(ms = this.throttleTime) {
        console.log(`Waiting ${ms}ms`);
        return new Promise(res => setTimeout(res, ms));
    }

    async doDelete(channelId, messageId) {
        console.log(`deleting ${messageId} in ${channelId}`);
        return fetch(`${this.domain}/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: "DELETE",
            headers: {
                "Authorization": this.token,
                "Content-Type": "application/json"
            }
        })
            .then(res => this.responseHandler(res, this.doDelete.bind(this), [channelId, messageId]));
    }

    async responseHandler(res, func, args) {
        const json = await res.json().catch(() => ({}));

        switch (res.status) {
            case 204:
            case 200:
                this.throttleTime = Math.max(this.throttleTime - 25, 600);
                return json;
            case 404:
                console.log(yellow("not found"));
                return json;
            case 429:
                console.log(red("rate limited"));
                this.throttleTime = Math.ceil((json.retry_after || 1) * 1000) + this.throttleTime;
                return this.delay().then(() => func(...args));
            default:
                console.log(red(`unhandled: ${res.status}`));
                return this.delay().then(() => func(...args));
        }
    }

    async run({ targetId, guildId, token, domain }) {
        this.targetId = targetId;
        this.guildId = guildId;
        this.token = token;
        this.domain = domain;

        await this.fetchMessages();
        await this.processQueue();
        console.log(bold(green("done")));
    }

    async processQueue() {
        console.log(bold(cyan("processing queue")));

        const loop = () => {
            if (this.queue.size === 0) return;
            const msg = this.queue.values().next().value;
            return this.delay()
                .then(() => this.doDelete(msg.channel_id, msg.id))
                .then(() => this.queue.delete(msg))
                .then(loop);
        };

        return loop();
    }

    async fetchMessages() {
        console.log(cyan("searching"));
        this.throttleTime = 500;
        let total = Infinity;

        const fetchPage = () =>
            fetch(
                `${this.domain}/api/v9/guilds/${this.guildId}/messages/search?author_id=${this.targetId}&include_nsfw=true&offset=${this.offset}`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": this.token,
                        "Content-Type": "application/json"
                    }
                }
            );

        while (this.offset < total) {
            await fetchPage()
                .then(res => {
                    this.throttleTime = 500;
                    return this.responseHandler(res, fetchPage.bind(this), []);
                })
                .then(data => data ?? {})
                .then(data => typeof data.messages === "object" ? data : { messages: [] })
                .then(data => {
                    total = typeof data.total_results === "number" ? data.total_results : total;
                    this.offset += 25;

                    for (const m of data.messages) {
                        m[0]?.id && m[0]?.channel_id && this.queue.add(m[0]);
                    }
                    console.log(`found ${data.messages.length} msgs (total: ${this.queue.size})`);
                })
                .then(() => this.delay());
        }
    }
}

/// Entry
(async (f, cfgs) => {
    cfgs = await Deno.readTextFile(f)
        .then(t => JSON.parse(t))
        .catch(e => {
            console.error(red(`Error reading config: ${e}`));
            return [];
        });

    for (let cfg of cfgs) {
        await new MessageDeleter().run(cfg);
    }
})("msg-purge.json", []);

