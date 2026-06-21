const { EmbedBuilder } = require('discord.js');
const config = require('../config');

function createEmbed(options = {}) {
  const embed = new EmbedBuilder();
  
  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  
  // Resolve Color (Red, Green, Dark or Hex)
  let embedColor = config.colors.green;
  if (options.color) {
    if (options.color === 'red') {
      embedColor = config.colors.red;
    } else if (options.color === 'green') {
      embedColor = config.colors.green;
    } else if (options.color === 'dark') {
      embedColor = config.colors.dark;
    } else if (typeof options.color === 'number') {
      embedColor = options.color;
    } else if (typeof options.color === 'string') {
      if (options.color.startsWith('#')) {
        embedColor = parseInt(options.color.replace('#', ''), 16);
      } else {
        const parsed = parseInt(options.color, 16);
        if (!isNaN(parsed)) embedColor = parsed;
      }
    }
  }
  embed.setColor(embedColor);

  if (options.thumbnail) {
    const thumbUrl = typeof options.thumbnail === 'string' ? options.thumbnail : options.thumbnail.url;
    if (thumbUrl) embed.setThumbnail(thumbUrl);
  }
  if (options.image) {
    const imageUrl = typeof options.image === 'string' ? options.image : options.image.url;
    if (imageUrl) embed.setImage(imageUrl);
  }
  
  if (options.fields && Array.isArray(options.fields)) {
    embed.addFields(options.fields.map(f => ({
      name: f.name || '\u200b',
      value: f.value || '\u200b',
      inline: !!f.inline
    })));
  }
  
  if (options.author) {
    embed.setAuthor({
      name: options.author.name,
      iconURL: options.author.iconURL || undefined,
      url: options.author.url || undefined
    });
  }
  
  embed.setFooter({
    text: options.footer || config.footer
  });
  
  if (options.timestamp) {
    embed.setTimestamp(options.timestamp === true ? new Date() : new Date(options.timestamp));
  }
  
  return embed;
}

module.exports = {
  createEmbed,
  success: (description, title = '✅ Success', options = {}) => createEmbed({ color: 'green', title, description, timestamp: true, ...options }),
  error: (description, title = '❌ Error', options = {}) => createEmbed({ color: 'red', title, description, timestamp: true, ...options }),
  info: (description, title = '☁️ Information', options = {}) => createEmbed({ color: 'green', title, description, timestamp: true, ...options })
};
