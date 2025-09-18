const { ButtonStyle } = require("discord.js");
const { ButtonBuilder } = require("discord.js");

function createButton(id, style, emoji, disabled = false) {
    return new ButtonBuilder()
        .setCustomId(id)
        .setStyle(style)
        .setEmoji(emoji)
        .setDisabled(disabled);
}

module.exports = {
    skipButton: function(disabled = false)
    {
        return createButton('skip-button', ButtonStyle.Secondary, '1198248590087307385', disabled);
    },
    rewindButton: function(disabled = false)
    {
        return createButton('rewind-button', ButtonStyle.Secondary, '1198248587369386134', disabled);
    },
    pauseButton: function(disabled = false)
    {
        return createButton('pause-button', ButtonStyle.Danger, '1198248585624571904', disabled);
    },
    resumeButton: function(disabled = false)
    {
        return createButton('resume-button', ButtonStyle.Success, '1198248583162511430', disabled);
    },
    loopButton: function(disabled = false)
    {
        return createButton('loop-button', ButtonStyle.Primary, '1198248581304418396', disabled);
    },
    shuffleButton: function(disabled = false)
    {
        return createButton('shuffle-button', ButtonStyle.Primary, '1198248578146115605', disabled);
    }
}