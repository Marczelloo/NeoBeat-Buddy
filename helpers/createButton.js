const { ButtonBuilder } = require('discord.js');

module.exports = {
   createButton: function(id, style, emoji, disabled = false) {
      return new ButtonBuilder()
         .setCustomId(id)
         .setStyle(style)
         .setEmoji(emoji)
         .setDisabled(disabled);
   }
}