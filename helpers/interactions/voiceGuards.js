const { errorEmbed } = require('../embeds');

async function requireSharedVoice(interaction, { ephermal = true } = {})
{
    const userChannel = interaction.member?.voice?.channel;

    if(!userChannel)
    {
        return {
            ok: false,
            response: { embeds: [errorEmbed('You must be in a voice channel to use this command.')], ephemeral: ephermal }
        }
    }

    const botChannel = interaction.guild.members.me?.voice?.channel;

    if(botChannel && botChannel.id !== userChannel.id)
    {
        return {
            ok: false,
            response: { embeds: [errorEmbed('You must be in the same voice channel as the bot to use this command.')], ephemeral: ephermal }
        }
    }

    return { ok: true, channel: userChannel };
}

module.exports = { requireSharedVoice  };