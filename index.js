const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  Partials,
  ChannelType
} = require("discord.js");

const { Manager } = require("erela.js");
const config = require("./config");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.manager = new Manager({
  nodes: [
    {
      host: config.lavalink.host,
      port: config.lavalink.port,
      password: config.lavalink.password,
      secure: config.lavalink.secure
    }
  ],
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  }
});

client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);
  client.manager.init(client.user.id);
});

client.on("raw", d => client.manager.updateVoiceState(d));

client.manager.on("nodeConnect", () => {
  console.log("Lavalink connected successfully!");
});

client.manager.on("nodeError", (node, error) => {
  console.log("Lavalink Error:", error.message);
});

client.manager.on("trackStart", (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) {
    channel.send(`🎵 Now Playing: **${track.title}**`);
  }
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ================= MUSIC =================

  if (command === "play") {
    if (!message.member.voice.channel)
      return message.reply("❌ Join a voice channel first.");

    const query = args.join(" ");
    if (!query) return message.reply("❌ Give song name or URL.");

    let player = client.manager.players.get(message.guild.id);

    if (!player) {
      player = client.manager.players.create({
        guild: message.guild.id,
        voiceChannel: message.member.voice.channel.id,
        textChannel: message.channel.id,
        selfDeafen: true
      });

      player.connect();
    }

    const res = await client.manager.search(query, message.author);

    if (!res || !res.tracks.length)
      return message.reply("❌ No results found.");

    player.queue.add(res.tracks[0]);

    if (!player.playing && !player.paused)
      player.play();

    message.reply(`✅ Queued: **${res.tracks[0].title}**`);
  }

  if (command === "skip") {
    const player = client.manager.players.get(message.guild.id);

    if (!player)
      return message.reply("❌ Nothing playing.");

    player.stop();
    message.reply("⏭️ Song skipped.");
  }

  if (command === "stop") {
    const player = client.manager.players.get(message.guild.id);

    if (!player)
      return message.reply("❌ Nothing playing.");

    player.destroy();
    message.reply("🛑 Music stopped.");
  }

  if (command === "pause") {
    const player = client.manager.players.get(message.guild.id);

    if (!player)
      return message.reply("❌ Nothing playing.");

    player.pause(true);
    message.reply("⏸️ Music paused.");
  }

  if (command === "resume") {
    const player = client.manager.players.get(message.guild.id);

    if (!player)
      return message.reply("❌ Nothing playing.");

    player.pause(false);
    message.reply("▶️ Music resumed.");
  }

  if (command === "queue") {
    const player = client.manager.players.get(message.guild.id);

    if (!player || !player.queue.current)
      return message.reply("❌ Queue empty.");

    const tracks = player.queue.map((t, i) => `${i + 1}. ${t.title}`).slice(0, 10);

    message.reply(`🎶 Queue:\n${tracks.join("\n")}`);
  }

  // ================= VOICE MODERATION =================

  if (command === "voice") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.MoveMembers))
      return message.reply("❌ You need Move Members permission.");

    const sub = args.shift()?.toLowerCase();

    const vc = message.member.voice.channel;

    if (!vc)
      return message.reply("❌ Join VC first.");

    let target =
      message.mentions.members.first() ||
      (message.reference
        ? await message.channel.messages
            .fetch(message.reference.messageId)
            .then(m => m.member)
            .catch(() => null)
        : null);

    // MUTE
    if (sub === "mute") {
      if (!target) return message.reply("❌ Mention user.");

      await target.voice.setMute(true);
      return message.reply(`🔇 ${target.user.tag} muted.`);
    }

    if (sub === "unmute") {
      if (!target) return message.reply("❌ Mention user.");

      await target.voice.setMute(false);
      return message.reply(`🔊 ${target.user.tag} unmuted.`);
    }

    if (sub === "muteall") {
      for (const [, member] of vc.members) {
        await member.voice.setMute(true).catch(() => {});
      }

      return message.reply("🔇 Everyone muted.");
    }

    if (sub === "unmuteall") {
      for (const [, member] of vc.members) {
        await member.voice.setMute(false).catch(() => {});
      }

      return message.reply("🔊 Everyone unmuted.");
    }

    // DEAFEN
    if (sub === "deafen") {
      if (!target) return message.reply("❌ Mention user.");

      await target.voice.setDeaf(true);
      return message.reply(`🎧 ${target.user.tag} deafened.`);
    }

    if (sub === "undeafen") {
      if (!target) return message.reply("❌ Mention user.");

      await target.voice.setDeaf(false);
      return message.reply(`🎧 ${target.user.tag} undeafened.`);
    }

    if (sub === "deafenall") {
      for (const [, member] of vc.members) {
        await member.voice.setDeaf(true).catch(() => {});
      }

      return message.reply("🎧 Everyone deafened.");
    }

    if (sub === "undeafenall") {
      for (const [, member] of vc.members) {
        await member.voice.setDeaf(false).catch(() => {});
      }

      return message.reply("🎧 Everyone undeafened.");
    }

    // KICK
    if (sub === "kick") {
      if (!target) return message.reply("❌ Mention user.");

      await target.voice.disconnect();
      return message.reply(`👢 ${target.user.tag} kicked from VC.`);
    }

    if (sub === "kickall") {
      for (const [, member] of vc.members) {
        await member.voice.disconnect().catch(() => {});
      }

      return message.reply("👢 Everyone kicked.");
    }

    // MOVE
    if (sub === "move") {
      if (!target) return message.reply("❌ Mention user.");

      const channel = message.mentions.channels.last();

      if (!channel || channel.type !== ChannelType.GuildVoice)
        return message.reply("❌ Mention target VC.");

      await target.voice.setChannel(channel);
      return message.reply(`➡️ ${target.user.tag} moved.`);
    }

    if (sub === "moveall") {
      const targetChannel = message.mentions.channels.first();

      if (!targetChannel || targetChannel.type !== ChannelType.GuildVoice)
        return message.reply("❌ Mention target VC.");

      for (const [, member] of vc.members) {
        await member.voice.setChannel(targetChannel).catch(() => {});
      }

      return message.reply("➡️ Everyone moved.");
    }
  }
});

client.login(config.token);