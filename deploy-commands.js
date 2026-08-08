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
const PRIMARY_ENTRY_POINT = 4;

function serializePrimaryEntryPoint(command) {
  const payload = {
    type: PRIMARY_ENTRY_POINT,
    name: command.name,
    description: command.description,
    handler: command.handler,
  };

  for (const key of ["default_member_permissions", "dm_permission", "contexts", "integration_types", "nsfw"]) {
    if (command[key] !== undefined) payload[key] = command[key];
  }

  return payload;
}

(async () => {
  try {
    const existing = await rest.get(Routes.applicationCommands(clientId));
    const entryPoints = existing
      .filter((command) => command.type === PRIMARY_ENTRY_POINT)
      .map(serializePrimaryEntryPoint);
    const commandPayload = [...commands, ...entryPoints];

    Log.info(`Started refreshing ${commands.length} application (/) commands. Preserving ${entryPoints.length} Entry Point command(s).`);

    const data = await rest.put(Routes.applicationCommands(clientId), { body: commandPayload });

    Log.success(`Successfully reloaded ${data.length} application (/) commands.`);
    process.exit(0);
  } catch (error) {
    Log.error("An error occurred while refreshing application (/) commands:", error);
    process.exit(1);
  }
})();
