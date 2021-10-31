const Chat = require('../src');

document.addEventListener('DOMContentLoaded', () => {
    const elm = document.createElement('div');
    document.body.appendChild(elm);
    new Chat(elm, { channels: [ '#MattIPv4' ] });
});
