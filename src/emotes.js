// Based on https://github.com/smilefx/tmi-emote-parse

// Global store of all emotes loaded
const loadedAssets = {
    _global: {
        emotes: [],
        badges: {},
        loaded: {
            badges: false,
            bttv: false,
            ffz: false,
        },
    },
};

/**
 * Load emotes for a context, either a channel or '_global'
 * @param context
 * @param args
 * @return {Promise<void>[]}
 */
const loadEmotes = (context, args) => {
    // Start loading the channel emotes
    const pending = [];

    // Load FFZ channel emotes
    if (args.ffz && !loadedAssets[context].loaded.ffz) {
        pending.push(
            fetch(`https://api.frankerfacez.com/v1/${context === '_global' ? 'set/global' : `room/${context}`}`)
                .then(response => response.json())
                .then(body => {
                    try {
                        for (const set in body.sets) {
                            for (const emote of body.sets[set].emoticons) {
                                loadedAssets[context].emotes.push({
                                    name: emote.name,
                                    url: `https://cdn.frankerfacez.com/emoticon/${emote.id}/1`,
                                    type: 'ffz',
                                    id: emote.id,
                                });
                            }
                        }

                        loadedAssets[context].loaded.ffz = true;
                    } catch (error) {
                        console.log(error);
                        exports.events.emit('error', {
                            channel: context,
                            error: "Failed to load FFZ emotes for " + context
                        });
                    }
                }),
        );
    }

    // Load BTTV channel emotes
    if (args.bttv && !loadedAssets[context].loaded.bttv) {
        pending.push(
            fetch(`https://api.betterttv.net/3/cached/${context === '_global' ? 'emotes/global' : `users/twitch/${loadedAssets[context].uid}`}`)
                .then(response => response.json())
                .then(body => {
                    try {
                        for (const emote of (context === '_global' ? body : body.channelEmotes.concat(body.sharedEmotes))){
                            loadedAssets[context].emotes.push({
                                name: emote.code,
                                url: `https://cdn.betterttv.net/emote/${emote.id}/3x`,
                                type: 'bttv',
                                id: emote.id,
                            });
                        }

                        loadedAssets[context].loaded.bttv = true;
                    } catch (error) {
                        console.log(error);
                        exports.events.emit('error', {
                            channel: context,
                            error: "Failed to load BetterTTV emotes for " + context
                        });
                    }
                }),
        );
    }

    // Load Twitch channel badges
    pending.push(
        fetch(`https://badges.twitch.tv/v1/badges/${context === '_global' ? 'global' : `channels/${loadedAssets[context].uid}`}/display`)
            .then(response => response.json())
            .then(body => {
                try {
                    for (const set in body.badge_sets) {
                        for (const version in body.badge_sets[set].versions) {
                            loadedAssets[context].badges[set + "/" + version] = {
                                name: set + "/" + version,
                                url: body.badge_sets[set].versions[version].image_url_4x,
                            };
                        }
                    }

                    loadedAssets[context].loaded.badges = true;
                } catch (error) {
                    console.log(error);
                    exports.events.emit('error', {
                        channel: context,
                        error: "Failed to load Twitch badges for " + context
                    });
                }
            }),
    );

    return pending;
};

/**
 * Load emotes for a given channel name
 * @param {string} channel
 * @param {string} uid
 * @param {Object} args
 * @return {Promise<void>}
 */
module.exports.loadChannel = async (channel, uid, args = {}) => {
    channel = channel.replace(/^#/, '');

    // Apply default args
    args.ffz = args.ffz ?? true;
    args.bttv = args.bttv ?? true;

    // Create the empty struct
    if (!loadedAssets[channel]) {
        loadedAssets[channel] = {
            channel,
            uid,
            emotes: [],
            badges: {},
            loaded: {
                badges: false,
                bttv: false,
                ffz: false,
            },
        };
    }

    // Load the emotes
    await Promise.all(loadEmotes(channel, args).concat(loadEmotes('_global', args)));
};

module.exports.getBadges = (tags, channel) => (tags['badges-raw']?.split(',') || [])
    .map(badge => loadedAssets[channel.replace(/^#/, '')].badges[badge] || loadedAssets._global.badges[badge] || null)
    .filter(badge => badge !== null);

module.exports.handleEmotes = (message, tags, channel) => {
    channel = channel.replace(/^#/, '');
    if (!loadedAssets[channel]) return [ { type: 'text', content: message } ];

    // Get any emotes from twitch
    for (const emote in (tags.emotes || {})) {
        if (loadedAssets[channel].emotes.find(e => e.name === emote)) continue;

        const pos = tags.emotes[emote][0].split('-').map(Number);
        loadedAssets[channel].emotes.push({
            name: message.substring(pos[0], pos[1] + 1),
            url: `https://static-cdn.jtvnw.net/emoticons/v2/${emote}/default/dark/3.0`,
            type: 'twitch',
        });
    }

    // Get which emotes are used
    const found = [];
    for (const emote of loadedAssets[channel].emotes.concat(loadedAssets._global.emotes)) {
        const regex = new RegExp(`\\b${emote.name}\\b`, 'g');
        const matches = [...message.matchAll(regex)];
        for (const match of matches) {
            found.push({
                name: emote.name,
                url: emote.url,
                type: emote.type,
                start: match.index,
                end: match.index + emote.name.length,
            });
        }
    }

    // Sort the emotes by start position
    found.sort((a, b) => a.start - b.start);

    // Iterate over emotes and replace them
    const parts = [];
    let emoteIdx = 0;
    let stringIdx = 0;
    while (emoteIdx < found.length) {
        // Get any string up to the emote
        const part = message.substring(stringIdx, found[emoteIdx].start);
        if (part) parts.push({ type: 'text', content: part });

        // Replace the emote with an image
        parts.push({ type: 'emote', content: {
            name: found[emoteIdx].name,
            url: found[emoteIdx].url,
            type: found[emoteIdx].type,
        } });

        emoteIdx++;
        stringIdx = found[emoteIdx - 1].end;
    }

    // Get any trailing string
    const part = message.substring(stringIdx);
    if (part) parts.push({ type: 'text', content: part });

    return parts;
};
