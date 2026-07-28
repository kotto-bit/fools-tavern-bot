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
  ]
});

// ===================== CONFIG =====================

// category that gets opened/closed
const CATEGORY_ID = '1512558575501705296';

// main channel
const CHANNEL_ID = '1512559078864588913';

// Adult Swim role
const ROLE_ID = '1512557689815957695';

// Staff role allowed to use commands
const ADMIN_ROLE_ID = '905240429052698665';

// General chat announcement channel
const ANNOUNCEMENT_CHANNEL_ID = '683878059828576307';

// Tavern image
const TAVERN_IMAGE =
  'https://cdn.discordapp.com/attachments/326881404870852608/1531523106131148820/3IWrHVObIXLmAFo.gif?ex=6a69858a&is=6a68340a&hm=232ee4f78b4ffb1a428ce99842104032f26c5639eb1d2c00ebb45cfd2dd59928&';

// Tavern Close image
const TAVERN_IMAGE_CLOSE =
  'https://cdn.discordapp.com/attachments/326881404870852608/1512973310588096562/aha-aha-the-elation.gif';

// Schedule
const START_HOUR = 21; // 9 PM ET
const END_HOUR = 6;    // 6 AM ET
const TIMEZONE = 'America/New_York';

// ==================================================

let lastState = null;
let startupComplete = false;
let overrideMode = null;
let warningSentToday = false;

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

function getTimeRemaining() {

  const now = new Date();

  const currentHour =
    getCurrentHourET();

  let targetHour;

  const currentlyOpen =
    overrideMode === null
      ? isAdultSwimTime()
      : overrideMode;

  if (currentlyOpen) {

    targetHour = END_HOUR;

  } else {

    targetHour = START_HOUR;

  }

  let hoursRemaining =
    targetHour - currentHour;

  if (hoursRemaining < 0) {
    hoursRemaining += 24;
  }

  const currentMinute =
    Number(
      new Intl.DateTimeFormat(
        'en-US',
        {
          minute: 'numeric',
          timeZone: TIMEZONE
        }
      ).format(now)
    );

  let minutesRemaining =
    60 - currentMinute;

  if (minutesRemaining === 60) {
    minutesRemaining = 0;
  } else {
    hoursRemaining--;
  }

  if (hoursRemaining < 0) {
    hoursRemaining += 24;
  }

  return `${hoursRemaining}h ${minutesRemaining}m`;
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
        "The Fool's Tavern is open!"
      )
      .setDescription(
        "Aha invites you all to relish The Elation!\n\n- *Managed by Sparkle Bot.*"
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
        "The Fool's Tavern has closed for the morning.\n\nThe Elation will return soon!"
      )
      .setImage(TAVERN_IMAGE_CLOSE);

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

async function sendClosingWarning() {

  try {

    const tavernChannel =
      await client.channels.fetch(
        CHANNEL_ID
      );

    if (!tavernChannel) {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('⏳ Last Call!')
      .setDescription(
        "The Fool's Tavern closes in **30 minutes**.\n\nFinish up before **Aha** kicks you out!"
      )
      .setImage('https://cdn.discordapp.com/attachments/326881404870852608/1531523123243909250/7cKrgbAajmFNWb7.gif?ex=6a69858e&is=6a68340e&hm=bc41d008446e39c55fa03467adc2507cdf516276a1889c4ee25d9f19644b8422&');

    await tavernChannel.send({
      embeds: [embed]
    });

    console.log(
      `[${getCurrentTimeET()}] 30-minute closing warning sent.`
    );

  } catch (err) {

    console.error(
      'Closing warning failed:',
      err
    );

  }

}

async function updateChannel() {
  try {

    const category =
      await client.channels.fetch(
        CATEGORY_ID
      );

    if (!category) {
      console.log(
        'Adult Swim category not found.'
      );
      return;
    }

    const shouldBeVisible =
      overrideMode === null
        ? isAdultSwimTime()
        : overrideMode;
    
    const currentHour =
      getCurrentHourET();

    const currentMinute =
      Number(
        new Intl.DateTimeFormat(
          'en-US',
          {
            minute: 'numeric',
            timeZone: TIMEZONE
          }
        ).format(new Date())
      );

    // 5:30 AM warning
    if (
      shouldBeVisible &&
      currentHour === 5 &&
      currentMinute >= 30 &&
      !warningSentToday
    ) {

      await sendClosingWarning();

      warningSentToday = true;

    }

    // Reset after closing
    if (
      currentHour === 21 &&
      warningSentToday
    ) {
      warningSentToday = false;
    }

    // Startup sync
    if (lastState === null) {

      await category.permissionOverwrites.edit(
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

    await category.permissionOverwrites.edit(
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

const GUILD_ID = '347384047657287692';

// Delete old global commands
await rest.put(
  Routes.applicationCommands(
    client.user.id
  ),
  {
    body: []
  }
);

console.log(
  'Cleared old global commands.'
);

// Register guild commands
await rest.put(
  Routes.applicationGuildCommands(
    client.user.id,
    GUILD_ID
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

// PUBLIC STATUS COMMAND
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
          name: 'Status',
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
        },
        {
          name: 'Time Remaining',
          value: getTimeRemaining()
        }
      )
      .setImage(TAVERN_IMAGE);

  return interaction.reply({
    embeds: [embed]
  });

}

// STAFF-ONLY COMMANDS
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

  const category =
    await client.channels.fetch(CATEGORY_ID);

  await category.permissionOverwrites.edit(
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

    const category =
      await client.channels.fetch(CATEGORY_ID);

    await category.permissionOverwrites.edit(
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

});
client.login(process.env.TOKEN);
