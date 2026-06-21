const { Collection } = require('discord.js');

/**
 * Generates a beautiful HTML transcript of a text channel.
 * @param {import('discord.js').TextChannel} channel - The ticket channel
 * @returns {Promise<Buffer>} The HTML transcript compiled as a Buffer
 */
async function generateTranscript(channel) {
  try {
    // Fetch all messages (up to 300) in chronological order
    const fetched = await channel.messages.fetch({ limit: 100 });
    const messages = [...fetched.values()].reverse();

    const guild = channel.guild;
    const client = channel.client;

    // Build HTML header with styling (Discord Dark Theme)
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Transcript - ${channel.name}</title>
  <style>
    body {
      background-color: #313338;
      color: #dbdee1;
      font-family: 'gg sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
    }
    .header {
      border-bottom: 1px solid #3f4147;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .server-icon {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      float: left;
      margin-right: 15px;
    }
    .server-name {
      font-size: 20px;
      font-weight: 700;
      color: #f2f3f5;
      margin: 0;
    }
    .channel-name {
      font-size: 15px;
      color: #b5bac1;
      margin: 5px 0 0 0;
    }
    .message-container {
      display: flex;
      margin-bottom: 16px;
      line-height: 1.375rem;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      margin-right: 16px;
      flex-shrink: 0;
    }
    .message-content-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    .message-header {
      display: flex;
      align-items: baseline;
      margin-bottom: 4px;
    }
    .author-name {
      font-weight: 600;
      font-size: 1rem;
      margin-right: 8px;
      color: #f2f3f5;
    }
    .bot-tag {
      background-color: #5865f2;
      color: #ffffff;
      font-size: 0.625rem;
      padding: 1px 4px;
      border-radius: 3px;
      margin-right: 8px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .timestamp {
      font-size: 0.75rem;
      color: #949ba4;
    }
    .message-text {
      font-size: 0.9375rem;
      color: #dbdee1;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .mention {
      background-color: #3c4270;
      color: #c9cdfb;
      padding: 0 4px;
      border-radius: 3px;
      font-weight: 500;
    }
    .attachment-img {
      max-width: 400px;
      max-height: 300px;
      border-radius: 8px;
      margin-top: 8px;
    }
    .attachment-file {
      display: inline-flex;
      align-items: center;
      background-color: #2b2d31;
      border: 1px solid #1e1f22;
      border-radius: 4px;
      padding: 10px;
      margin-top: 8px;
      color: #00a8fc;
      text-decoration: none;
      font-size: 0.875rem;
    }
    .embed {
      background-color: #2b2d31;
      border-left: 4px solid #1e1f22;
      border-radius: 4px;
      padding: 12px 16px;
      margin-top: 8px;
      max-width: 520px;
    }
    .embed-title {
      font-weight: 600;
      color: #f2f3f5;
      font-size: 1rem;
      margin-bottom: 4px;
    }
    .embed-desc {
      font-size: 0.875rem;
      color: #dbdee1;
    }
    .embed-field {
      margin-top: 8px;
    }
    .embed-field-name {
      font-weight: 600;
      font-size: 0.875rem;
      color: #f2f3f5;
    }
    .embed-field-value {
      font-size: 0.875rem;
      color: #dbdee1;
    }
  </style>
</head>
<body>
  <div class="header">
    <img class="server-icon" src="${guild.iconURL({ dynamic: true }) || 'https://discord.com/assets/f9bbda527b3d5d9214b20902c0376b8d.png'}" alt="Server Icon">
    <h1 class="server-name">${escapeHtml(guild.name)}</h1>
    <p class="channel-name">Transcript for channel: #${escapeHtml(channel.name)}</p>
  </div>
`;

    // Process each message
    for (const msg of messages) {
      const author = msg.author;
      const member = msg.member;
      const avatarUrl = author.displayAvatarURL({ dynamic: true, size: 128 });
      const nameColor = member ? member.displayHexColor : '#f2f3f5';
      const formattedColor = nameColor === '#000000' ? '#f2f3f5' : nameColor;

      const dateStr = msg.createdAt.toLocaleString();

      html += `
  <div class="message-container">
    <img class="avatar" src="${avatarUrl}" alt="${author.username}">
    <div class="message-content-wrapper">
      <div class="message-header">
        <span class="author-name" style="color: ${formattedColor}">${escapeHtml(author.username)}</span>
        ${author.bot ? `<span class="bot-tag">Bot</span>` : ''}
        <span class="timestamp">${dateStr}</span>
      </div>
      <div class="message-text">${parseContent(msg.content, guild)}</div>
`;

      // Render Embeds
      if (msg.embeds && msg.embeds.length > 0) {
        msg.embeds.forEach(embed => {
          const borderHex = embed.hexColor || '#2b2d31';
          html += `
      <div class="embed" style="border-left-color: ${borderHex}">
        ${embed.title ? `<div class="embed-title">${escapeHtml(embed.title)}</div>` : ''}
        ${embed.description ? `<div class="embed-desc">${parseContent(embed.description, guild)}</div>` : ''}
`;
          if (embed.fields && embed.fields.length > 0) {
            embed.fields.forEach(f => {
              html += `
        <div class="embed-field">
          <div class="embed-field-name">${escapeHtml(f.name)}</div>
          <div class="embed-field-value">${parseContent(f.value, guild)}</div>
        </div>
`;
            });
          }
          html += `</div>`;
        });
      }

      // Render Attachments
      if (msg.attachments && msg.attachments.size > 0) {
        msg.attachments.forEach(attachment => {
          const isImg = attachment.contentType && attachment.contentType.startsWith('image/');
          if (isImg) {
            html += `<img class="attachment-img" src="${attachment.url}" alt="Image attachment">`;
          } else {
            html += `<a class="attachment-file" href="${attachment.url}" target="_blank">📄 ${escapeHtml(attachment.name)}</a>`;
          }
        });
      }

      html += `
    </div>
  </div>
`;
    }

    html += `
</body>
</html>
`;

    return Buffer.from(html, 'utf-8');
  } catch (err) {
    console.error('Failed to generate HTML transcript:', err);
    throw err;
  }
}

/**
 * Escapes special HTML characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resolves user/role/channel mentions in message content into styled HTML tags
 */
function parseContent(content, guild) {
  if (!content) return '';
  let escaped = escapeHtml(content);

  // 1. Resolve User Mentions: <@userId> -> <span class="mention">@Username</span>
  escaped = escaped.replace(/&lt;@!?(\d+)&gt;/g, (match, userId) => {
    const member = guild.members.cache.get(userId);
    const label = member ? member.user.username : `User-${userId}`;
    return `<span class="mention">@${escapeHtml(label)}</span>`;
  });

  // 2. Resolve Channel Mentions: <#channelId> -> <span class="mention">#Channel</span>
  escaped = escaped.replace(/&lt;#(\d+)&gt;/g, (match, channelId) => {
    const chan = guild.channels.cache.get(channelId);
    const label = chan ? chan.name : `channel-${channelId}`;
    return `<span class="mention">#${escapeHtml(label)}</span>`;
  });

  // 3. Resolve Role Mentions: <@&roleId> -> <span class="mention">@Role</span>
  escaped = escaped.replace(/&lt;@&amp;(\d+)&gt;/g, (match, roleId) => {
    const role = guild.roles.cache.get(roleId);
    const label = role ? role.name : `role-${roleId}`;
    return `<span class="mention">@${escapeHtml(label)}</span>`;
  });

  return escaped;
}

module.exports = {
  generateTranscript
};
