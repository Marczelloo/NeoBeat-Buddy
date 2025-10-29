require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");
const Log = require("./helpers/logs/log");

const commands = [];
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      Log.warning(`The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    Log.info(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });

    Log.success(`Successfully reloaded ${data.length} application (/) commands.`);
    process.exit(0);
  } catch (error) {
    Log.error("An error occurred while refreshing application (/) commands:", error);
    process.exit(1);
  }
})();
