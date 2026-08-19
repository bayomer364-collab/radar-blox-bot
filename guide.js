const { 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    StringSelectMenuBuilder, 
    EmbedBuilder 
} = require('discord.js');

const OWNER_ID = "1417227496251981895";

// Bu fonksiyonu ana index.js dosyamızdan çağıracağız
function setupGuideSystem(client) {

    // Global rehber hafızası yoksa oluşturalım
    if (!client.guideStorage) {
        client.guideStorage = {};
    }

    // Komut kaydedildikten sonra interaction'ları dinleme
    client.on('interactionCreate', async interaction => {
        
        // 1. /guide komutu tetiklendiğinde
        if (interaction.isChatInputCommand() && interaction.commandName === 'guide') {
            if (interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: 'Bu komutu kullanma yetkin yok!', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('guideModal1')
                .setTitle('Özel Rehber Oluşturucu (1/2)');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('embedTitle').setLabel('Embed Başlığı').setStyle(TextInputStyle.Short).setValue('Available Methods').setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('embedDesc').setLabel('Embed Açıklaması / Ana Metin').setStyle(TextInputStyle.Paragraph).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('g1Name').setLabel('1. Guide Adı').setMaxLength(100).setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('g1Text').setLabel('1. Guide İçeriği').setStyle(TextInputStyle.Paragraph).setRequired(true)
                )
            );

            return await interaction.showModal(modal);
        }

        // 2. Modaller ve Menü Seçimleri
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'guideModal1') {
                const data = {
                    title: interaction.fields.getTextInputValue('embedTitle'),
                    desc: interaction.fields.getTextInputValue('embedDesc'),
                    g1Name: interaction.fields.getTextInputValue('g1Name'),
                    g1Text: interaction.fields.getTextInputValue('g1Text')
                };

                const modal2 = new ModalBuilder()
                    .setCustomId(`guideModal2_${Buffer.from(JSON.stringify(data)).toString('base64')}`)
                    .setTitle('Rehber Oluşturucu (Devam 2/2)');

                modal2.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('g2Name').setLabel('2. Guide Adı').setMaxLength(100).setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('g2Text').setLabel('2. Guide İçeriği').setStyle(TextInputStyle.Paragraph).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('g3Name').setLabel('3. Guide Adı').setMaxLength(100).setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('g3Text').setLabel('3. Guide İçeriği').setStyle(TextInputStyle.Paragraph).setRequired(true)
                    )
                );

                return await interaction.showModal(modal2);
            } 
            else if (interaction.customId.startsWith('guideModal2_')) {
                try {
                    const encodedData = interaction.customId.split('_')[1];
                    const data = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf8'));

                    const g2Name = interaction.fields.getTextInputValue('g2Name');
                    const g2Text = interaction.fields.getTextInputValue('g2Text');
                    const g3Name = interaction.fields.getTextInputValue('g3Name');
                    const g3Text = interaction.fields.getTextInputValue('g3Text');

                    // Benzersiz bir ID üretelim ki çakışma olmasın
                    const menuId = `guide_select_${Date.now()}`;

                    const guides = {
                        [data.g1Name]: data.g1Text,
                        [g2Name]: g2Text,
                        [g3Name]: g3Text
                    };

                    const embed = new EmbedBuilder()
                        .setTitle(data.title)
                        .setDescription(data.desc)
                        .setColor(0x5865F2);

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(menuId)
                        .setPlaceholder('Bir rehber (guide) seçin...')
                        .addOptions([
                            { label: data.g1Name, description: `${data.g1Name} detayını görüntüle`, value: data.g1Name.substring(0, 100) },
                            { label: g2Name, description: `${g2Name} detayını görüntüle`, value: g2Name.substring(0, 100) },
                            { label: g3Name, description: `${g3Name} detayını görüntüle`, value: g3Name.substring(0, 100) }
                        ]);

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    // Belirtilen kanala mesajı gönder
                    await interaction.channel.send({ embeds: [embed], components: [row] });

                    // Belleğe kaydet
                    client.guideStorage[menuId] = guides;

                    return await interaction.reply({ content: 'Rehber başarıyla oluşturuldu!', ephemeral: true });
                } catch (error) {
                    console.error("Guide oluşturulurken hata:", error);
                    return await interaction.reply({ content: 'Rehber oluşturulurken bir hata oluştu!', ephemeral: true });
                }
            }
        }

        // 3. Menüden seçim yapıldığında (Kullanıcı menüden bir seçenek seçtiğinde)
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('guide_select_')) {
            const guides = client.guideStorage[interaction.customId];
            const selectedValue = interaction.values[0];
            const content = guides && guides[selectedValue] ? guides[selectedValue] : 'Rehber içeriği bulunamadı veya süre aşımına uğradı.';

            return await interaction.reply({ content: content, ephemeral: true });
        }
    });
}

module.exports = { setupGuideSystem };
