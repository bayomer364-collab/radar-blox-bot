const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');

// Bot client setup
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Authorized User ID (Sadece bu ID komutu ve paneli kullanabilir)
const ALLOWED_USER_ID = '1417227496251981895';

// When the bot is ready
client.once('ready', async () => {
    console.log(`Bot is online: ${client.user.tag}`);

    // Registering the /guide slash command
    const commands = [
        new SlashCommandBuilder()
            .setName('guide')
            .setDescription('Creates the guide message sending panel.')
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Refreshing application (/) commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// Interaction handler
client.on('interactionCreate', async interaction => {
    
    // 1. When the /guide command is executed
    if (interaction.isChatInputCommand() && interaction.commandName === 'guide') {
        // Security check: Only the specified user can use this
        if (interaction.user.id !== ALLOWED_USER_ID) {
            return interaction.reply({ content: '❌ You do not have permission to use this command!', ephemeral: true });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('send_guide_btn')
                    .setLabel('Send Guide Message')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📩')
            );

        await interaction.reply({
            content: 'Click the button below to create and send your guide message:',
            components: [row],
            ephemeral: true
        });
    }

    // 2. When the button is clicked to open the modal
    if (interaction.isButton() && interaction.customId === 'send_guide_btn') {
        // Security check for button click as well
        if (interaction.user.id !== ALLOWED_USER_ID) {
            return interaction.reply({ content: '❌ You do not have permission to use this button!', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId('guide_modal')
            .setTitle('Create Guide Message');

        const messageInput = new TextInputBuilder()
            .setCustomId('guide_text')
            .setLabel('What is your guide message?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Type your guide message here...')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    }

    // 3. When the modal form is submitted
    if (interaction.isModalSubmit() && interaction.customId === 'guide_modal') {
        // Final security check
        if (interaction.user.id !== ALLOWED_USER_ID) {
            return interaction.reply({ content: '❌ You do not have permission to submit this form!', ephemeral: true });
        }

        const enteredText = interaction.fields.getTextInputValue('guide_text');

        // Target channel ID where the message will be sent:
        const targetChannelId = '1538525897005473812';
        const channel = interaction.guild.channels.cache.get(targetChannelId);

        if (!channel) {
            return interaction.reply({ content: '❌ Error: Target channel not found!', ephemeral: true });
        }

        // Send the message to the target channel
        await channel.send({
            content: `📢 **New Guide / Announcement:**\n\n${enteredText}`
        });

        // Confirm success to the user privately
        await interaction.reply({ content: '✅ Your guide message has been successfully sent to the channel!', ephemeral: true });
    }
});

// Log in using Railway's environment variable
client.login(process.env.DISCORD_TOKEN);
