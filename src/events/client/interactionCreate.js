const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { createEmbed, error } = require('../../utils/embedBuilder');
const Payment = require('../../database/models/Payment');
const PaymentConfig = require('../../database/models/PaymentConfig');

module.exports = {
  once: false,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      const command = client.commands.get(commandName);

      if (!command) {
        return interaction.reply({ embeds: [error('This command is no longer registered.')], ephemeral: true });
      }

      try {
        await command.executeSlash(interaction, client);
      } catch (err) {
        logger.error(`Error executing slash command ${commandName}`, err);
        const errEmbed = error('An unexpected error occurred while executing this command.');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
        } else {
          await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
        }
      }
    } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      
      // Delegate Embed Builder interactions
      if (customId.startsWith('embed_')) {
        const embedCmd = client.commands.get('embed');
        if (embedCmd && typeof embedCmd.handleInteraction === 'function') {
          try {
            await embedCmd.handleInteraction(interaction, client);
          } catch (err) {
            logger.error(`Error handling embed builder interaction ${customId}`, err);
          }
        }
      }
      
      // Delegate Owner DMAll interactions
      if (customId.startsWith('dmall_')) {
        const dmallCmd = client.commands.get('dmall');
        if (dmallCmd && typeof dmallCmd.handleInteraction === 'function') {
          try {
            await dmallCmd.handleInteraction(interaction, client);
          } catch (err) {
            logger.error(`Error handling dmall interaction ${customId}`, err);
          }
        }
      }

      // Delegate Help command interactions
      if (customId.startsWith('help_')) {
        const helpCmd = client.commands.get('help');
        if (helpCmd && typeof helpCmd.handleInteraction === 'function') {
          try {
            await helpCmd.handleInteraction(interaction, client);
          } catch (err) {
            logger.error(`Error handling help interaction ${customId}`, err);
          }
        }
      }

      // --- GIVEAWAY JOIN BUTTON ---
      if (customId === 'ga_join' && interaction.isButton()) {
        try {
          const Giveaway = require('../../database/models/Giveaway');
          const giveawayManager = require('../../utils/giveawayManager');
          
          const giveaway = await Giveaway.findOne({ messageId: interaction.message.id, ended: false });
          if (!giveaway) {
            return interaction.reply({ content: '❌ This giveaway has already ended or does not exist.', ephemeral: true });
          }

          if (giveaway.participants.includes(interaction.user.id)) {
            return interaction.reply({ content: 'ℹ️ You have already joined this giveaway!', ephemeral: true });
          }

          const member = interaction.member;
          const qual = await giveawayManager.checkQualification(member, giveaway);
          if (!qual.qualified) {
            return interaction.reply({ content: `❌ You do not qualify to join this giveaway.\nReason: ${qual.reason}`, ephemeral: true });
          }

          giveaway.participants.push(interaction.user.id);
          await giveaway.save();

          return interaction.reply({ content: `🎉 You have successfully joined the giveaway for **${giveaway.prize}**!`, ephemeral: true });

        } catch (err) {
          logger.error('Error handling giveaway join button click:', err);
          return interaction.reply({ content: '❌ Failed to process your entry.', ephemeral: true }).catch(() => null);
        }
      }

      // --- PAYMENT PROOF UPLOAD BUTTON CLICKED ---
      if (customId.startsWith('pay_proof_upload:') && interaction.isButton()) {
        try {
          
          const parts = customId.split(':');
          const paymentId = parts[1];
          const method = parts[2];
          const requestedAmount = parts[3];
          const targetUserId = parts[4] || 'none';   // who QR was generated for
          const requestedById = parts[5] || 'none';  // who ran the command

          // Check if already pending/approved
          const existing = await Payment.findOne({ paymentId, status: { $in: ['pending', 'approved'] } });
          if (existing) {
            return interaction.reply({ content: `❌ A payment verification request for Payment ID **${paymentId}** is already pending or approved. You cannot submit multiple proofs for the same Payment ID.`, ephemeral: true });
          }

          const hasRequestedAmount = requestedAmount && requestedAmount !== 'none';
          // Pass target + requester info through modal customId
          const modalCustomId = `pay_modal_submit:${paymentId}:${method}:${requestedAmount}:${targetUserId}:${requestedById}`;

          const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle('📸 Upload Payment Proof');

          const txIdInput = new TextInputBuilder()
            .setCustomId('tx_id_input')
            .setLabel('Transaction ID (Optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the transaction reference / hash')
            .setRequired(false);

          const notesInput = new TextInputBuilder()
            .setCustomId('notes_input')
            .setLabel('Additional Notes (Optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Any extra details for the staff')
            .setRequired(false);

          if (hasRequestedAmount) {
            modal.addComponents(
              new ActionRowBuilder().addComponents(txIdInput),
              new ActionRowBuilder().addComponents(notesInput)
            );
          } else {
            const amountInput = new TextInputBuilder()
              .setCustomId('amount_input')
              .setLabel('Payment Amount')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Enter the exact amount paid (e.g. 149 or 0.005)')
              .setRequired(true);

            modal.addComponents(
              new ActionRowBuilder().addComponents(amountInput),
              new ActionRowBuilder().addComponents(txIdInput),
              new ActionRowBuilder().addComponents(notesInput)
            );
          }

          await interaction.showModal(modal);
        } catch (err) {
          logger.error('Error opening payment modal:', err);
          return interaction.reply({ content: '❌ Failed to open modal.', ephemeral: true }).catch(() => null);
        }
      }

      // --- PAYMENT MODAL SUBMITTED ---
      if (customId.startsWith('pay_modal_submit:') && interaction.isModalSubmit()) {
        try {
          
          const parts = customId.split(':');
          const paymentId = parts[1];
          const method = parts[2];
          const requestedAmount = parts[3];
          const targetUserId = parts[4] || 'none';
          const requestedById = parts[5] || 'none';

          let amount = requestedAmount;
          if (amount === 'none') {
            amount = interaction.fields.getTextInputValue('amount_input');
          }

          const txIdInput = interaction.fields.getTextInputValue('tx_id_input') || 'None';
          const notesInput = interaction.fields.getTextInputValue('notes_input') || 'None';

          // Ephemerally prompt user to upload image
          await interaction.reply({
            content: `💬 **Information Recorded!** Please upload your payment proof screenshot as an image in this channel now (within 5 minutes).\n*Your upload will be removed from chat immediately for privacy.*`,
            flags: 64 // ephemeral
          });

          const channel = interaction.channel;
          const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
          const collector = channel.createMessageCollector({ filter, max: 1, time: 300000 });

          collector.on('collect', async (msg) => {
            try {
              const attachment = msg.attachments.first();
              const isImage = attachment.contentType?.startsWith('image/') || attachment.url.match(/\.(jpeg|jpg|gif|png|webp)$/i);

              if (!isImage) {
                await channel.send({ content: `<@${interaction.user.id}> ❌ Invalid file. Please upload a valid image (screenshot) file.` }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
                collector.resetTimer();
                return;
              }

              // ✅ Download image as buffer BEFORE deleting the message
              // This ensures the image is fully available for re-upload to the log channel
              let imageBuffer;
              try {
                const imgRes = await fetch(attachment.url);
                const arrayBuffer = await imgRes.arrayBuffer();
                imageBuffer = Buffer.from(arrayBuffer);
              } catch (fetchErr) {
                logger.error('Failed to download screenshot buffer:', fetchErr);
                // Fallback: use URL directly
                imageBuffer = null;
              }

              // Check for duplicate (by URL before deletion)
              const isDuplicate = await Payment.findOne({ screenshotUrl: attachment.url });
              if (isDuplicate) {
                await channel.send({ content: `<@${interaction.user.id}> ❌ This screenshot has already been submitted. Duplicates are blocked.` }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
                collector.stop('duplicate');
                return;
              }

              // Now delete the user's upload message from the channel
              if (channel.permissionsFor(interaction.guild.members.me).has('ManageMessages')) {
                await msg.delete().catch(() => null);
              }

              // Resolve target user and requester
              let targetUser = null;
              let requesterUser = null;
              try {
                if (targetUserId && targetUserId !== 'none') {
                  targetUser = await client.users.fetch(targetUserId).catch(() => null);
                }
                if (requestedById && requestedById !== 'none') {
                  requesterUser = await client.users.fetch(requestedById).catch(() => null);
                }
              } catch (_) {}

              // Save to DB
              const newPayment = await Payment.create({
                paymentId,
                guildId: interaction.guild.id,
                guildName: interaction.guild.name,
                userId: interaction.user.id,
                username: interaction.user.username,
                requestedById: requestedById !== 'none' ? requestedById : interaction.user.id,
                requestedByUsername: requesterUser?.username || interaction.user.username,
                targetUserId: targetUserId !== 'none' ? targetUserId : null,
                targetUsername: targetUser?.username || null,
                channelId: interaction.channel.id,
                method,
                amount,
                notes: notesInput,
                transactionId: txIdInput,
                screenshotUrl: attachment.url,
                status: 'pending'
              });

              collector.stop('success');
              await channel.send({ content: `<@${interaction.user.id}> ✅ Payment proof for **${paymentId}** submitted for verification!` }).then(m => setTimeout(() => m.delete().catch(() => null), 10000));

              // Log to payment logs channel
              const config = await PaymentConfig.findOne({ guildId: interaction.guild.id });
              if (config && config.paymentChannelId) {
                const logChannel = await interaction.guild.channels.fetch(config.paymentChannelId).catch(() => null);
                if (logChannel) {
                  const fileExtension = (attachment.name || 'screenshot.png').split('.').pop() || 'png';
                  const fileName = `proof_${paymentId}.${fileExtension}`;

                  // Build the file attachment from the buffer (or URL as fallback)
                  const file = imageBuffer
                    ? new AttachmentBuilder(imageBuffer, { name: fileName })
                    : new AttachmentBuilder(attachment.url, { name: fileName });

                  // Build rich log embed
                  const payer = interaction.user;
                  const forUser = targetUser || payer;
                  const generatedBy = requesterUser || payer;

                  const logEmbed = createEmbed({
                    title: `💳 New Payment Submission`,
                    description: `Payment proof submitted and awaiting staff verification.`,
                    color: 0x2ECC71,
                    timestamp: true
                  })
                  .setImage(`attachment://${fileName}`)
                  .addFields([
                    { name: '📸 Submitted By', value: `${payer} (\`${payer.username}\`)`, inline: true },
                    { name: '🆔 Payer ID', value: `\`${payer.id}\``, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '🎯 Payment For', value: targetUser ? `${targetUser} (\`${targetUser.username}\`)` : `${payer} (\`${payer.username}\`)`, inline: true },
                    { name: '🧑‍💼 QR Generated By', value: generatedBy !== payer ? `${generatedBy} (\`${generatedBy.username}\`)` : '`Same as payer`', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '💰 Amount', value: `\`${amount}\``, inline: true },
                    { name: '💳 Payment Method', value: `\`${method}\``, inline: true },
                    { name: '🧾 Payment ID', value: `\`${paymentId}\``, inline: true },
                    { name: '🧾 Tx / Reference ID', value: `\`${txIdInput}\``, inline: true },
                    { name: '📝 Notes', value: notesInput !== 'None' ? `\`${notesInput}\`` : '`None`', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true }
                  ]);

                  const verifyRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`pay_verify_approve:${paymentId}`).setLabel('✅ Approve Payment').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`pay_verify_reject:${paymentId}`).setLabel('❌ Reject Payment').setStyle(ButtonStyle.Danger)
                  );

                  const logMessage = await logChannel.send({ embeds: [logEmbed], components: [verifyRow], files: [file] });
                  const permanentUrl = logMessage.attachments.first()?.url;
                  if (permanentUrl) {
                    newPayment.screenshotUrl = permanentUrl;
                    await newPayment.save();
                  }
                }
              }

              // Guild audit log
              logger.logToGuild(
                interaction.guild,
                'Payment Submission',
                `💳 Payment proof submitted by ${interaction.user} for Payment ID: \`${paymentId}\` (Amount: \`${amount}\`, Method: \`${method}\`${
                  targetUser ? `, For: ${targetUser}` : ''
                })`
              );

            } catch (err) {
              logger.error('Error capturing screenshot in collector:', err);
            }
          });

        } catch (err) {
          logger.error('Error handling payment modal submit:', err);
        }
      }

      // --- STAFF VERIFICATION: APPROVE BUTTON ---
      if (customId.startsWith('pay_verify_approve:') && interaction.isButton()) {
        try {
          
          // Verify permissions
          const hasPerms = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
          if (!hasPerms) {
            return interaction.reply({ content: '❌ You do not have permission to verify payments.', ephemeral: true });
          }

          const paymentId = customId.split(':')[1];
          const payment = await Payment.findOne({ paymentId });

          if (!payment) {
            return interaction.reply({ content: '❌ Payment record not found.', ephemeral: true });
          }

          if (payment.status !== 'pending') {
            return interaction.reply({ content: `❌ This payment has already been resolved (\`${payment.status.toUpperCase()}\`).`, ephemeral: true });
          }

          // Approve payment
          payment.status = 'approved';
          payment.verifiedBy = interaction.user.tag;
          await payment.save();

          await interaction.reply({ content: `✅ Payment ID **${paymentId}** approved successfully!`, ephemeral: true });

          // Notify User via DM
          const user = await client.users.fetch(payment.userId).catch(() => null);
          if (user) {
            const dmEmbed = createEmbed({
              title: `☁️ Ren Helper`,
              description: `Your payment has been verified successfully.\n\n` +
                           `• **Payment ID:** \`${paymentId}\`\n` +
                           `• **Amount:** \`${payment.amount}\`\n` +
                           `• **Verified By:** ${interaction.user.tag}\n\n` +
                           `Thank you for choosing Ren Cloud.`,
              color: 'green'
            });
            await user.send({ embeds: [dmEmbed] }).catch(() => null);
          }

          // Send approval message to the origin channel where the QR was generated
          if (payment.channelId) {
            const originChannel = await client.channels.fetch(payment.channelId).catch(() => null);
            if (originChannel) {
              await originChannel.send({
                content: `✅ <@${payment.userId}> Your payment got approved. Wait for your order, our staff will message you shortly.`
              }).catch(() => null);
            }
          }

          // Update verification log embed in log channel (clone existing embed, mark as approved)
          const logEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setTitle('✅ Payment Approved')
            .setColor(0x2ECC71)
            .addFields([{ name: '🛡️ Verified By', value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true }]);

          await interaction.message.edit({ embeds: [logEmbed], components: [] });

          // Guild audit log
          logger.logToGuild(
            interaction.guild,
            'Payment Approved',
            `🟢 Payment ID: \`${paymentId}\` submitted by <@${payment.userId}> has been approved by ${interaction.user}.`
          );

        } catch (err) {
          logger.error('Error approving payment:', err);
        }
      }

      // --- STAFF VERIFICATION: REJECT BUTTON ---
      if (customId.startsWith('pay_verify_reject:') && interaction.isButton()) {
        try {
          // Verify permissions
          const hasPerms = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
          if (!hasPerms) {
            return interaction.reply({ content: '❌ You do not have permission to verify payments.', ephemeral: true });
          }

          const paymentId = customId.split(':')[1];
          const payment = await Payment.findOne({ paymentId });

          if (!payment) {
            return interaction.reply({ content: '❌ Payment record not found.', ephemeral: true });
          }

          if (payment.status !== 'pending') {
            return interaction.reply({ content: `❌ This payment has already been resolved (\`${payment.status.toUpperCase()}\`).`, ephemeral: true });
          }

          // Open reject modal
          const modal = new ModalBuilder()
            .setCustomId(`pay_reject_submit:${paymentId}`)
            .setTitle('❌ Reject Payment Submission');

          const reasonInput = new TextInputBuilder()
            .setCustomId('reason_input')
            .setLabel('Rejection Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter the reason for rejection (e.g. Invalid screenshot or unpaid status)')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          await interaction.showModal(modal);

        } catch (err) {
          logger.error('Error opening reject modal:', err);
        }
      }

      // --- STAFF REJECT MODAL SUBMITTED ---
      if (customId.startsWith('pay_reject_submit:') && interaction.isModalSubmit()) {
        try {
          
          const paymentId = customId.split(':')[1];
          const reasonInput = interaction.fields.getTextInputValue('reason_input');

          const payment = await Payment.findOne({ paymentId });
          if (!payment) {
            return interaction.reply({ content: '❌ Payment record not found.', ephemeral: true });
          }

          // Reject payment
          payment.status = 'rejected';
          payment.verifiedBy = interaction.user.tag;
          payment.rejectionReason = reasonInput;
          await payment.save();

          await interaction.reply({ content: `❌ Payment ID **${paymentId}** rejected.`, ephemeral: true });

          // Notify User via DM
          const user = await client.users.fetch(payment.userId).catch(() => null);
          if (user) {
            const dmEmbed = createEmbed({
              title: `☁️ Ren Helper`,
              description: `Your payment submission was rejected.\n\n` +
                           `• **Payment ID:** \`${paymentId}\`\n` +
                           `• **Reason:** \`${reasonInput}\`\n\n` +
                           `Please submit a valid payment screenshot and try again.`,
              color: 'red'
            });
            await user.send({ embeds: [dmEmbed] }).catch(() => null);
          }

          // Update verification log embed (clone existing embed, mark as rejected)
          const logEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setTitle('❌ Payment Rejected')
            .setColor(0xE74C3C)
            .addFields([
              { name: '🛡️ Rejected By', value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
              { name: '📝 Rejection Reason', value: `\`${reasonInput}\``, inline: false }
            ]);

          await interaction.message.edit({ embeds: [logEmbed], components: [] });

          // Guild audit log
          logger.logToGuild(
            interaction.guild,
            'Payment Rejected',
            `🔴 Payment ID: \`${paymentId}\` submitted by <@${payment.userId}> has been rejected by ${interaction.user}. Reason: ${reasonInput}`
          );

        } catch (err) {
          logger.error('Error submitting reject modal:', err);
        }
      }


    }
  }
};
