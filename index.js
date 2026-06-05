require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===================== CONFIG =====================

// Channel that gets opened/closed
const CHANNEL_ID = '1512559078864588913';

// Adult Swim role
const ROLE_ID = '1512557689815957695';

// General chat announcement channel
const ANNOUNCEMENT_CHANNEL_ID = '683878059828576307';

// Tavern image
const TAVERN_IMAGE =
  'https://cdn.discordapp.com/attachments/326881404870852608/1512578646978724012/1edab9ff0ac690ce24ae6b21b844ce74de18098a.png';

// Schedule
const START_HOUR = 21; // 9 PM ET
const END_HOUR = 6;    // 6 AM ET
const TIMEZONE = 'America/New_York';

// ==================================================

let lastState = null;
let startupComplete = false;
let overrideMode = null;

// null = automatic schedule
// true = forced open
// false = forced closed

function getCurrentHourET() {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: TIMEZONE
    }).format(new Date())
  );
}

function isAdultSwimTime() {
  const hour = getCurrentHourET();
  return hour >= START_HOUR || hour < END_HOUR;
}

function getCurrentTimeET() {
  return new Date().toLocaleString('en-US', {
    timeZone: TIMEZONE
  });
}

function getStatusText() {

  const currentTime =
    getCurrentTimeET();

  let mode;

  if (overrideMode === true) {
    mode = 'Forced Open';
  } else if (overrideMode === false) {
    mode = 'Forced Closed';
  } else {
    mode = 'Automatic';
  }

  const currentlyOpen =
    overrideMode === null
      ? isAdultSwimTime()
      : overrideMode;

  const nextEvent =
    currentlyOpen
      ? 'Closes at 6:00 AM ET'
      : 'Opens at 9:00 PM ET';

  return {
    mode,
    currentlyOpen,
    nextEvent,
    currentTime
  };
}

async function sendOpeningAnnouncement() {
  try {
    const announcementChannel =
      await client.channels.fetch(
        ANNOUNCEMENT_CHANNEL_ID
      );

    if (!announcementChannel) {
      console.log(
        'Announcement channel not found.'
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(
        "🌙 The Fool's Tavern is open!"
      )
      .setDescription(
        "Pull up a chair, grab a drink, and enjoy the late-night hours.\n\nDoors close at 6:00 AM ET."
      )
      .setImage(TAVERN_IMAGE);

    await announcementChannel.send({
      content: `<@&${ROLE_ID}>`,
      embeds: [embed],
      allowedMentions: {
        roles: [ROLE_ID]
      }
    });

    console.log(
      `[${getCurrentTimeET()}] Opening announcement sent.`
    );

  } catch (err) {
    console.error(
      'Opening announcement failed:',
      err
    );
  }
}

async function sendClosingAnnouncement() {
  try {
    const announcementChannel =
      await client.channels.fetch(
        ANNOUNCEMENT_CHANNEL_ID
      );

    if (!announcementChannel) {
      console.log(
        'Announcement channel not found.'
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('☀️ Last call.')
      .setDescription(
        "The Fool's Tavern has closed for the morning.\n\nWe'll reopen tonight at 9:00 PM ET."
      )
      .setImage(TAVERN_IMAGE);

    await announcementChannel.send({
      embeds: [embed]
    });

    console.log(
      `[${getCurrentTimeET()}] Closing announcement sent.`
    );

  } catch (err) {
    console.error(
      'Closing announcement failed:',
      err
    );
  }
}

async function updateChannel() {
  try {

    const channel =
      await client.channels.fetch(
        CHANNEL_ID
      );

    if (!channel) {
      console.log(
        'Adult Swim channel not found.'
      );
      return;
    }

    const shouldBeVisible =
      overrideMode === null
        ? isAdultSwimTime()
        : overrideMode;

    // Startup sync
    if (lastState === null) {

      await channel.permissionOverwrites.edit(
        ROLE_ID,
        {
          ViewChannel: shouldBeVisible
        }
      );

      lastState = shouldBeVisible;
      startupComplete = true;

      console.log(
        `[${getCurrentTimeET()}] Startup Sync → Adult Swim ${
          shouldBeVisible ? 'ON' : 'OFF'
        }`
      );

      return;
    }

    // No state change
    if (shouldBeVisible === lastState) {
      return;
    }

    await channel.permissionOverwrites.edit(
      ROLE_ID,
      {
        ViewChannel: shouldBeVisible
      }
    );

    if (startupComplete) {

      if (shouldBeVisible) {
        await sendOpeningAnnouncement();
      } else {
        await sendClosingAnnouncement();
      }

    }

    lastState = shouldBeVisible;

    console.log(
      `[${getCurrentTimeET()}] Adult Swim ${
        shouldBeVisible ? 'ON' : 'OFF'
      }`
    );

  } catch (err) {

    console.error(
      'Error updating channel:',
      err
    );

  }
}

client.once('clientReady', async () => {

  console.log(
    `Logged in as ${client.user.tag}`
  );

  const commands = [

    new SlashCommandBuilder()
      .setName('forceopen')
      .setDescription(
        'Force open The Fool\'s Tavern'
      ),

    new SlashCommandBuilder()
      .setName('forceclose')
      .setDescription(
        'Force close The Fool\'s Tavern'
      ),

    new SlashCommandBuilder()
      .setName('auto')
      .setDescription(
        'Return to automatic schedule'
      ),
    
    new SlashCommandBuilder()
    .setName('status')
    .setDescription(
      'Show current tavern status'
    )

  ].map(cmd => cmd.toJSON());

  const rest =
    new REST({ version: '10' })
      .setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationCommands(
      client.user.id
    ),
    {
      body: commands
    }
  );

  console.log(
    'Slash commands registered.'
  );

  await updateChannel();

  setInterval(
    updateChannel,
    60 * 1000
  );

});

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (
    !interaction.member.roles.cache.has(
      ADMIN_ROLE_ID
    )
  ) {
    return interaction.reply({
      flags: 64,
      content:
        '❌ Only Tavern Staff may use this command.'
    });
  }

  if (interaction.commandName === 'forceopen') {

    overrideMode = true;

    const channel =
      await client.channels.fetch(CHANNEL_ID);

    await channel.permissionOverwrites.edit(
      ROLE_ID,
      {
        ViewChannel: true
      }
    );

    await sendOpeningAnnouncement();

    lastState = true;

    await interaction.reply({
      ephemeral: true,
      content:
        '🌙 The Fool\'s Tavern forced open. Use /auto to return to the schedule.'
    });

  }

  if (interaction.commandName === 'forceclose') {

    overrideMode = false;

    const channel =
      await client.channels.fetch(CHANNEL_ID);

    await channel.permissionOverwrites.edit(
      ROLE_ID,
      {
        ViewChannel: false
      }
    );

    await sendClosingAnnouncement();

    lastState = false;

    await interaction.reply({
      ephemeral: true,
      content:
        '☀️ The Fool\'s Tavern forced closed. Use /auto to return to the schedule.'
    });

  }

  if (interaction.commandName === 'auto') {

    overrideMode = null;

    lastState = null;

    await updateChannel();

    await interaction.reply({
      ephemeral: true,
      content:
        '⏰ Automatic schedule restored.'
    });

  }

  if (interaction.commandName === 'status') {

    const status =
      getStatusText();

    const embed =
      new EmbedBuilder()
        .setTitle(
          "🍻 The Fool's Tavern Status"
        )
        .addFields(
          {
            name: 'Mode',
            value: status.mode,
            inline: true
          },
          {
            name: 'State',
            value:
              status.currentlyOpen
                ? '🟢 Open'
                : '🔴 Closed',
            inline: true
          },
          {
            name: 'Current Time (ET)',
            value: status.currentTime
          },
          {
            name: 'Next Event',
            value: status.nextEvent
          }
        )
        .setImage(TAVERN_IMAGE);

    return interaction.reply({
      flags: 64,
      embeds: [embed]
    });

  }

});
client.login(process.env.TOKEN);
