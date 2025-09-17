const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const desc = {
    Staff: 'Discord staff',
	Partner: "Discord partner",
	Hypesquad: "Events member",
	BugHunterLevel1: "BugHunter level 1",
	MFASMS : "MFASMS",
	PremiumPromoDismissed: "Premium promo",
	HypeSquadOnlineHouse1: "HypeSqad - Bravery",
	HypeSquadOnlineHouse2: "HypeSqad - Briliance",
	HypeSquadOnlineHouse3: "HypeSqad - Balance",
	PremiumEarlySupporter: "Early Nitor Supporter",
	TeamPseudoUser: "User is a team",
	HasUnreadUrgentMessages: 'Has unread messages',
	BugHunterLevel2: "BugHunter level 2",
	VerifiedBot: "Verified Bot",
	VerifiedDeveloper: "Early Verified Bot Developer",
	CertifiedModerator: "Moderator",
	BotHTTPInteractions: "Bot only HTTP interactions",
	Spammer: "Spammer",
	DisablePremium: "Disable premium",
	ActiveDeveloper: "Active Developer",
	Quarantined: "Quarantined",
	Collaborator: "Collaborator",
	RestrictedCollaborator: "Restricted Collaborator"
}


module.exports = {
    data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Provides infromation about the user')
    .addUserOption(option => option
        .setName('user')
        .setDescription('user about which you want to display info') 
        .setRequired(true)
    ),

    async execute(interaction) {
        const user = await interaction.options.getUser('user');
        const nickname = await interaction.guild.members.fetch(user.id);
        const banner = user.fetch(user.banner);
        let flags = user.flags.toArray();
        if (flags.length === 0) {
            flags = "This user doesn't have any flags.";
        } else {
            flags = flags.map(flag => desc[flag] || flag).join(", ");
        }

        let statusString;
        const status = interaction.guild.members.cache.filter(member => {
            if(member.user.id === user.id){
                statusString = member.presence.status;
                statusString.toString();
            }
        })

        const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('User: ' + user.tag)
        .setThumbnail(user.avatarURL())
        .addFields(
            { name: "Username 👤", value: user.username, inline: true},
            { name: "Nickname 🕵🏿", value: nickname.toString() , inline: true},
            { name: "Tag 🏷️", value: user.tag.toString(), inline: true},
            { name: "Status 🟢", value: statusString, inline: true},
            { name: "Bot 🤖", value: user.bot ? "Yes" : "No", inline: true},
            { name: "Flags 🏴", value: flags , inline: true},
            { name: "Creation Date 📆", value: user.createdAt.toDateString(), inline: true },
        )
        .setTimestamp();

        await interaction.reply({ embeds: [embed]});
    } 
}