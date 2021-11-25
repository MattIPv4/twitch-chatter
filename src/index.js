const tmi = require('tmi.js');
const emoteParser = require('./emotes');

class Chat {
    constructor(element, options = {}) {
        this.bootstrap(element);
        this.limit = options.limit ?? 30;
        this.speed = options.speed ?? 0.2;
        this.connect(options.channels || []);
    }

    bootstrap (element) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.overflow = 'hidden';
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';

        const chat = document.createElement('div');
        chat.style.position = 'absolute';
        chat.style.bottom = '0';
        chat.style.width = '100%';

        wrapper.appendChild(chat);
        element.appendChild(wrapper);
        this.element = chat;
    }

    async connect(channels) {
        // Create the client
        this.client = new tmi.Client({
            options: {
                debug: false,
            },
            connection: {
                reconnect: true,
                secure: true,
            },
            channels,
        });

        // Load emotes once we know the room
        this.client.on('roomstate', async (channel, state) => {
            await emoteParser.loadChannel(channel, state['room-id']);
            console.log('Emotes ready', channel);
        });

        // Connect
        await this.client.connect();

        // Handle messages
        this.client.on('message', this.message.bind(this));
        console.log('Ready');
    }

    async message(channel, tags, message) {
        // Get the badges and emotes
        const badges = emoteParser.getBadges(tags, channel);
        const emotes = emoteParser.handleEmotes(message, tags, channel);

        // Create the badges element
        const badgesElm = document.createElement('span');
        for (const badge of badges) {
            const badgeElm = document.createElement('img');
            badgeElm.src = badge.url;
            badgeElm.alt = badge.name;
            badgeElm.title = badge.name;
            badgeElm.style.margin = '0 .3em .2em 0';
            badgeElm.style.verticalAlign = 'middle';
            badgeElm.style.width = '1.25em';
            badgeElm.style.height = '1.25em';
            badgeElm.style.borderRadius = '.2em';
            badgesElm.appendChild(badgeElm);
        }

        // Create the name
        const nameElm = document.createElement('span');
        nameElm.textContent = tags['display-name'] || tags.username;
        nameElm.style.wordBreak = 'break-all';
        nameElm.style.overflowWrap = 'anywhere';
        nameElm.style.fontWeight = '700';
        nameElm.style.margin = '0 .3em .2em 0';
        if (tags.color) nameElm.style.color = tags.color;

        // Create the message element
        const messageElm = document.createElement('span');
        messageElm.style.wordWrap = 'break-word';
        for (const part of emotes) {
            if (part.type === 'text') {
                const partElm = document.createElement('span');
                partElm.textContent = part.content;
                partElm.style.wordWrap = 'break-word';
                messageElm.appendChild(partElm);
                continue;
            }

            if (part.type === 'emote') {
                const partElm = document.createElement('span');
                const partImg = document.createElement('img');
                partImg.src = part.content.url;
                partImg.alt = part.content.name;
                partImg.title = part.content.name;
                partImg.style.verticalAlign = 'middle';
                partImg.style.width = '2em';
                partImg.style.height = '2em';
                partImg.style.margin = '-.25em 0';
                partElm.appendChild(partImg);
                messageElm.appendChild(partElm);
                continue;
            }

            console.error(`Unknown message part type: ${part.type}`);
        }

        // Create the wrapper
        const wrapperElm = document.createElement('div');
        wrapperElm.style.background = 'rgba(0, 0, 0, 0.5)';
        wrapperElm.style.color = '#fff';
        wrapperElm.style.borderRadius = '.2em';
        wrapperElm.style.padding = '.5em';
        wrapperElm.style.width = '100%';
        wrapperElm.style.boxSizing = 'border-box';
        wrapperElm.style.lineHeight = '1.2em';
        wrapperElm.style.overflowWrap = 'anywhere';
        wrapperElm.style.textOverflow = 'ellipsis';
        wrapperElm.style.overflow = 'hidden';
        wrapperElm.style.marginTop = '0';
        wrapperElm.style.opacity = '0';
        wrapperElm.style.transition = `opacity ${this.speed / 4}s, max-height ${this.speed}s, margin-top ${this.speed}s`;
        wrapperElm.appendChild(badgesElm);
        wrapperElm.appendChild(nameElm);
        wrapperElm.appendChild(messageElm);
        this.element.appendChild(wrapperElm);

        // Animate in the message
        window.requestAnimationFrame(() => {
            const { height } = wrapperElm.getBoundingClientRect();
            wrapperElm.style.maxHeight = '0';

            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    wrapperElm.style.opacity = '1';
                    wrapperElm.style.maxHeight = `${height}px`;
                    wrapperElm.style.marginTop = '.5em';
                });
            });
        });

        // Enforce limit
        if (this.element.childElementCount > this.limit) this.element.removeChild(this.element.firstElementChild);
    }
}

module.exports = Chat;
