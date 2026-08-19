import os
import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

# Bilgisayarında test ederken .env dosyasını okuması için (Railway kendi ortamında otomatik görür)
load_dotenv()

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

# Yetkili kişinin Discord ID'si
OWNER_ID = 1417227496251981895


# 3. Adım: Kullanıcının girdi değerlerini işleyip menüyü oluşturan Select Sınıfı
class DynamicGuideSelect(discord.ui.Select):

  def __init__(self, g1_name, g1_text, g2_name, g2_text, g3_name, g3_text):
    self.guides = {
        g1_name: g1_text,
        g2_name: g2_text,
        g3_name: g3_text,
    }

    options = [
        discord.SelectOption(
            label=g1_name, description=f"{g1_name} detayını görüntüle"
        ),
        discord.SelectOption(
            label=g2_name, description=f"{g2_name} detayını görüntüle"
        ),
        discord.SelectOption(
            label=g3_name, description=f"{g3_name} detayını görüntüle"
        ),
    ]

    super().__init__(
        placeholder="Bir rehber (guide) seçin...",
        min_values=1,
        max_values=1,
        options=options,
    )

  async def callback(self, interaction: discord.Interaction):
    selected = self.values[0]
    content = self.guides.get(selected, "Rehber bulunamadı.")
    # Seçilen rehberin içeriğini sadece tıklayan kişiye gizli (ephemeral) olarak gösterir
    await interaction.response.send_message(content, ephemeral=True)


class DynamicGuideView(discord.ui.View):

  def __init__(self, g1_name, g1_text, g2_name, g2_text, g3_name, g3_text):
    super().__init__(timeout=None)
    self.add_item(
        DynamicGuideSelect(g1_name, g1_text, g2_name, g2_text, g3_name, g3_text)
    )


# 2. Adım: Modal (Açılan Form Penceresi)
class GuideModal(discord.ui.Modal, title="Özel Rehber Oluşturucu"):
  # Ana Embed içeriği
  embed_title = discord.ui.TextInput(
      label="Embed Başlığı",
      placeholder="Örn: Available Methods",
      default="Available Methods",
  )
  embed_desc = discord.ui.TextInput(
      label="Embed Açıklaması / Ana Metin",
      style=discord.TextStyle.paragraph,
      placeholder="Buraya ana bilgilendirme metnini yazın...",
  )

  # 1. Rehber Adı ve İçeriği
  guide1_name = discord.ui.TextInput(
      label="1. Guide Adı", placeholder="Örn: 123 Method"
  )
  guide1_text = discord.ui.TextInput(
      label="1. Guide İçeriği",
      style=discord.TextStyle.paragraph,
      placeholder="Bu seçeneğe basıldığında çıkacak yazı...",
  )

  async def on_submit(self, interaction: discord.Interaction):
    # İlk aşamada 1. guide alındı, şimdi 2. ve 3. guide'ları almak için ikinci bir Modal açıyoruz
    await interaction.response.send_modal(
        GuideModalPart2(
            self.embed_title.value,
            self.embed_desc.value,
            self.guide1_name.value,
            self.guide1_text.value,
        )
    )


# Ek Modal: 2. ve 3. Guide'ları toplamak için
class GuideModalPart2(discord.ui.Modal, title="Rehber Oluşturucu (Devam)"):

  def __init__(self, title_val, desc_val, g1_n, g1_t):
    super().__init__()
    self.t_val = title_val
    self.d_val = desc_val
    self.g1_n = g1_n
    self.g1_t = g1_t

  guide2_name = discord.ui.TextInput(
      label="2. Guide Adı", placeholder="Örn: Cross Method"
  )
  guide2_text = discord.ui.TextInput(
      label="2. Guide İçeriği", style=discord.TextStyle.paragraph
  )

  guide3_name = discord.ui.TextInput(
      label="3. Guide Adı", placeholder="Örn: Random Method"
  )
  guide3_text = discord.ui.TextInput(
      label="3. Guide İçeriği", style=discord.TextStyle.paragraph
  )

  async def on_submit(self, interaction: discord.Interaction):
    # Embed mesajını oluştur
    embed = discord.Embed(
        title=self.t_val, description=self.d_val, color=discord.Color.blurple()
    )

    view = DynamicGuideView(
        self.g1_n,
        self.g1_t,
        self.guide2_name.value,
        self.guide2_text.value,
        self.guide3_name.value,
        self.guide3_text.value,
    )

    # Hazırlanan mesajı kanala gönder
    await interaction.channel.send(embed=embed, view=view)
    await interaction.response.send_message(
        "Rehber başarıyla oluşturuldu!", ephemeral=True
    )


# 1. Adım: Slash Komutu (/guide)
@bot.tree.command(name="guide", description="İnteraktif rehber menüsü oluşturur.")
async def guide_command(interaction: discord.Interaction):
  # Sadece senin ID'nin kullanabilmesi için kontrol
  if interaction.user.id != OWNER_ID:
    await interaction.response.send_message(
        "Bu komutu kullanma yetkin yok!", ephemeral=True
    )
    return

  # Formu (Modal) kullanıcıya aç
  await interaction.response.send_modal(GuideModal())


@bot.event
async def on_ready():
  await bot.tree.sync()
  print(f"{bot.user} aktif ve slash komutları senkronize edildi!")


# Railway'deki DISCORD_TOKEN değişkenini güvenli şekilde okur
bot.run(os.getenv("DISCORD_TOKEN"))
