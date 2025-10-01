const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { CATEGORIES, DEFAULT_CATEGORY } = require("./categories")

const buildCategoryMenu  = (activeKey = DEFAULT_CATEGORY) => {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("help-category")
        .setPlaceholder("Select a command category");

    for(const [key, category] of Object.entries(CATEGORIES))
    {
        menu.addOptions({
            label: category.label,
            value: key,
            description: category.description.slice(0, 100),
            emoji: category.emoji,
            default: key === activeKey,
        })
    }

    return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
    buildCategoryMenu,
}