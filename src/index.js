const tmi = require('tmi.js');
const emoteParser = require('./emotes');

class Chat {
    constructor(element, options = {}) {
        this.element = element;
        this.connect(options.channels || []);
    }

    async connect(channels) {
        // Create the client
        this.client = new tmi.Client({
            options: {
                debug: false
            },
            connection: {
                reconnect: true,
                secure: true
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
        const badgesElm = document.createElement('div');
        for (const badge of badges) {
            const badgeElm = document.createElement('img');
            badgeElm.src = badge.url;
            badgesElm.appendChild(badgeElm);
        }

        // Create the name
        const nameElm = document.createElement('span');
        nameElm.textContent = tags['display-name'] || tags.username;
        if (tags.color) nameElm.style.color = tags.color;

        // Create the message element
        const messageElm = document.createElement('div');
        for (const part of emotes) {
            if (part.type === 'text') {
                const partElm = document.createElement('span');
                partElm.textContent = part.content;
                messageElm.appendChild(partElm);
                continue;
            }

            if (part.type === 'emote') {
                const partElm = document.createElement('img');
                partElm.src = part.content.url;
                partElm.alt = part.content.name;
                partElm.title = part.content.name;
                messageElm.appendChild(partElm);
                continue;
            }

            console.error(`Unknown message part type: ${part.type}`);
        }

        // Create the wrapper
        const wrapperElm = document.createElement('div');
        wrapperElm.appendChild(badgesElm);
        wrapperElm.appendChild(nameElm);
        wrapperElm.appendChild(messageElm);
        this.element.appendChild(wrapperElm);
    }
}

module.exports = Chat;
