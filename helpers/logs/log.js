const fs = require("fs");
const path = require("path");

const fsp = fs.promises;

const LogTextColor = {
  BLACK: "\x1b[30m",
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  WHITE: "\x1b[37m",
};

const LogBackgroundColor = {
  BLACK: "\x1b[40m",
  RED: "\x1b[41m",
  GREEN: "\x1b[42m",
  YELLOW: "\x1b[43m",
  BLUE: "\x1b[44m",
  MAGENTA: "\x1b[45m",
  CYAN: "\x1b[46m",
  WHITE: "\x1b[47m",
  GRAY: "\x1b[100m",
};

const Blocks = {
  FULL: "█",
  HALF: "▓",
  QUARTER: "▒",
  EMPTY: "░",
  LEFTHALF: "▌",
  RIGHTHALF: "▐",
};

const ProgressBarBlocks = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];

const bright = "\x1b[1m";

const spacer = "     ";
const spacerHalf = "  ";

const reset = "\x1b[0m";

const fastLogsEnabled = () => process.env.FAST_LOGS !== "0";

const getLogLevel = () => {
  const level = parseInt(process.env.LOG_LEVEL, 10);
  return isNaN(level) ? 2 : level;
};

const isJsonLogEnabled = () => process.env.JSON_LOGS === "1";

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;

class Log {
  static info(message, arg, ...additionalInfo) {
    if (getLogLevel() < 2) return;

    const now = new Date();
    const currentDate = now.toLocaleDateString();
    const currentTime = now.toLocaleTimeString();
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    const time = `${currentDate} ${currentTime}.${ms}`;
    const callerFile = fastLogsEnabled() ? "-" : Log.getCallerFile();
    let formattedMessage = "";
    formattedMessage += `${bright}${LogTextColor.WHITE}${LogBackgroundColor.CYAN} ${Blocks.LEFTHALF}INFO${spacer}   ${reset}`;
    formattedMessage += `${LogTextColor.WHITE}${LogBackgroundColor.GRAY} ${time} ${Blocks.FULL} ${callerFile} `;
    if (additionalInfo.length != 0) {
      formattedMessage += `${Blocks.FULL} `;
      const infoString = additionalInfo
        .map((info, index) => {
          if (index === additionalInfo.length - 1) {
            return `${info} ${reset}`;
          } else {
            return `${info} ${Blocks.FULL} `;
          }
        })
        .join("");

      formattedMessage += infoString;
    }
    formattedMessage += `${LogBackgroundColor.CYAN} ${reset}`;
    formattedMessage += `${bright}${LogTextColor.CYAN} ${spacerHalf} ${message}${arg ? ` ${arg}` : ""}${reset}`;
    console.log(formattedMessage);
  }

  static debug(message, arg, ...additionalInfo) {
    if (getLogLevel() < 3) return;

    const now = new Date();
    const currentDate = now.toLocaleDateString();
    const currentTime = now.toLocaleTimeString();
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    const time = `${currentDate} ${currentTime}.${ms}`;
    const callerFile = fastLogsEnabled() ? "-" : Log.getCallerFile();
    let formattedMessage = "";
    formattedMessage += `${bright}${LogTextColor.WHITE}${LogBackgroundColor.MAGENTA} ${Blocks.LEFTHALF}DEBUG${spacer}  ${reset}`;
    formattedMessage += `${LogTextColor.WHITE}${LogBackgroundColor.GRAY} ${time} ${Blocks.FULL} ${callerFile} `;
    if (additionalInfo.length != 0) {
      formattedMessage += `${Blocks.FULL} `;
      const infoString = additionalInfo
        .map((info, index) => {
          if (index === additionalInfo.length - 1) {
            return `${info} ${reset}`;
          } else {
            return `${info} ${Blocks.FULL} `;
          }
        })
        .join("");

      formattedMessage += infoString;
    }
    formattedMessage += `${LogBackgroundColor.MAGENTA} ${reset}`;
    formattedMessage += `${bright}${LogTextColor.MAGENTA} ${spacerHalf} ${message}${arg ? ` ${arg}` : ""}${reset}`;
    console.log(formattedMessage);
  }

  static success(message, arg, ...additionalInfo) {
    if (getLogLevel() < 2) return;

    const now = new Date();
    const currentDate = now.toLocaleDateString();
    const currentTime = now.toLocaleTimeString();
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    const time = `${currentDate} ${currentTime}.${ms}`;
    const callerFile = fastLogsEnabled() ? "-" : Log.getCallerFile();
    let formattedMessage = "";
    formattedMessage += `${bright}${LogTextColor.WHITE}${LogBackgroundColor.GREEN} ${Blocks.LEFTHALF}SUCCESS${spacer}${reset}`;
    formattedMessage += `${LogTextColor.WHITE}${LogBackgroundColor.GRAY} ${time} ${Blocks.FULL} ${callerFile} `;
    if (additionalInfo.length != 0) {
      formattedMessage += `${Blocks.FULL} `;
      const infoString = additionalInfo
        .map((info, index) => {
          if (index === additionalInfo.length - 1) {
            return `${info} ${reset}`;
          } else {
            return `${info} ${Blocks.FULL} `;
          }
        })
        .join("");

      formattedMessage += infoString;
    }
    formattedMessage += `${LogBackgroundColor.GREEN} ${reset}`;
    formattedMessage += `${bright}${LogTextColor.GREEN} ${spacerHalf} ${message}${arg ? ` ${arg}` : ""}${reset}`;
    console.log(formattedMessage);
  }

  static warning(message, arg = null, ...additionalInfo) {
    if (getLogLevel() < 1) return;

    const now = new Date();
    const currentDate = now.toLocaleDateString();
    const currentTime = now.toLocaleTimeString();
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    const time = `${currentDate} ${currentTime}.${ms}`;
    const callerFile = fastLogsEnabled() ? "-" : Log.getCallerFile();
    let formattedMessage = "";
    formattedMessage += `${bright}${LogTextColor.WHITE}${LogBackgroundColor.YELLOW} ${Blocks.LEFTHALF}WARNING${spacer}${reset}`;
    formattedMessage += `${LogTextColor.WHITE}${LogBackgroundColor.GRAY} ${time} ${Blocks.FULL} ${callerFile} `;
    if (additionalInfo.length != 0) {
      formattedMessage += `${Blocks.FULL} `;
      const infoString = additionalInfo
        .map((info, index) => {
          if (index === additionalInfo.length - 1) {
            return `${info} ${reset}`;
          } else {
            return `${info} ${Blocks.FULL} `;
          }
        })
        .join("");

      formattedMessage += infoString;
    }
    formattedMessage += `${LogBackgroundColor.YELLOW} ${reset}`;
    formattedMessage += `${bright}${LogTextColor.YELLOW} ${spacerHalf} ${message}${arg ? ` ${arg}` : ""}${reset}`;
    console.log(formattedMessage);

    Log.saveLogsToFile(formattedMessage);
    Log.logJson("WARNING", message, { arg, additionalInfo });
  }

  static error(message, arg = null, ...additionalInfo) {
    const now = new Date();
    const currentDate = now.toLocaleDateString();
    const currentTime = now.toLocaleTimeString();
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    const time = `${currentDate} ${currentTime}.${ms}`;
    const callerFile = fastLogsEnabled() ? "-" : Log.getCallerFile();
    let formattedMessage = "";
    formattedMessage += `${bright}${LogTextColor.WHITE}${LogBackgroundColor.RED} ${Blocks.LEFTHALF}ERROR${spacer}  ${reset}`;
    formattedMessage += `${LogTextColor.WHITE}${LogBackgroundColor.GRAY} ${time} ${Blocks.FULL} ${callerFile} `;
    if (additionalInfo.length != 0) {
      formattedMessage += `${Blocks.FULL} `;
      const infoString = additionalInfo
        .map((info, index) => {
          if (index === additionalInfo.length - 1) {
            return `${info} ${reset}`;
          } else {
            return `${info} ${Blocks.FULL} `;
          }
        })
        .join("");

      formattedMessage += infoString;
    }
    formattedMessage += `${LogBackgroundColor.RED} ${reset}`;
    formattedMessage += `${bright}${LogTextColor.RED} ${spacerHalf} ${message}${arg ? ` ${arg}` : ""}${reset}`;
    console.log(formattedMessage);

    Log.saveLogsToFile(formattedMessage);
    Log.logJson("ERROR", message, {
      arg,
      additionalInfo,
      error: arg instanceof Error ? { message: arg.message, stack: arg.stack } : null,
    });

    // Record error in health monitoring if available
    try {
      const health = require("../monitoring/health");
      // Only pass simple context to avoid circular references
      const simpleContext = {
        message,
        caller: Log.getCallerFile(),
      };
      health.recordError(arg instanceof Error ? arg : new Error(message), simpleContext);
    } catch (err) {
      // Health monitoring not available or failed - don't log to prevent infinite loop
    }
  }

  static progress(message, progress, ...additionalInfo) {
    if (fastLogsEnabled()) return;
    if (progress > 100) {
      progress = 100;
    }

    if (process.stdout.isTTY && process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    } else {
      const readline = require("readline");
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }

    const progressBarLength = 20;
    let progressBar;

    if (progress === 100) {
      progressBar = ProgressBarBlocks[8].repeat(progressBarLength);
    } else {
      const totalBlocks = progressBarLength * 8;
      const filledBlocks = Math.floor((totalBlocks * progress) / 100);
      const fullBlockCount = Math.floor(filledBlocks / 8);
      const partialBlockIndex = filledBlocks % 8;
      const emptyBlockCount = progressBarLength - fullBlockCount - (partialBlockIndex > 0 ? 1 : 0);

      progressBar = `${ProgressBarBlocks[8].repeat(fullBlockCount)}${
        ProgressBarBlocks[partialBlockIndex]
      }${ProgressBarBlocks[0].repeat(Math.max(0, emptyBlockCount))}`;
    }

    const now = new Date();
    const currentDate = now.toLocaleDateString();
    const currentTime = now.toLocaleTimeString();
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    const time = `${currentDate} ${currentTime}.${ms}`;
    const callerFile = Log.getCallerFile();

    let formattedMessage = "";
    formattedMessage += `${bright}${LogTextColor.WHITE}${LogBackgroundColor.BLUE} ${
      Blocks.LEFTHALF
    }PROGRESS${spacer.substring(1, 5)}${reset}`;
    formattedMessage += `${LogTextColor.WHITE}${LogBackgroundColor.GRAY} ${time} ${Blocks.FULL} ${callerFile} `;
    if (additionalInfo.length != 0) {
      formattedMessage += `${Blocks.FULL} `;
      const infoString = additionalInfo
        .map((info, index) => {
          if (index === additionalInfo.length - 1) {
            return `${info} ${reset}`;
          } else {
            return `${info} ${Blocks.FULL} `;
          }
        })
        .join("");

      formattedMessage += infoString;
    }
    formattedMessage += `${LogBackgroundColor.BLUE} ${reset}`;
    formattedMessage += `${bright}${LogTextColor.BLUE} ${spacerHalf} `;
    const progressBarWithPercentage = `${formattedMessage}${message}: [${progressBar}] ${progress.toFixed(2)}%`;

    process.stdout.write(progressBarWithPercentage);

    if (progress === 100) {
      process.stdout.write("\n");
    }
  }

  static getCallerFile() {
    if (fastLogsEnabled()) return "n/a";
    const originalPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const error = new Error();
    const currentFile = error.stack.shift().getFileName();
    while (error.stack.length) {
      const stackFrame = error.stack.shift();
      const fileName = stackFrame.getFileName();
      if (fileName !== currentFile) {
        Error.prepareStackTrace = originalPrepareStackTrace;
        return path.basename(fileName);
      }
    }
    Error.prepareStackTrace = originalPrepareStackTrace;
    return "unknown";
  }

  static saveLogsToFile(log) {
    if (process.env.LOG_TO_FILE === "0") return;
    const logWithoutFormatting = log.replace(/\x1b\[\d+m/g, "");
    const logsPath = path.resolve(__dirname, "../../logs/logs.txt");
    const logsFolder = path.dirname(logsPath);
    (async () => {
      try {
        await fsp.mkdir(logsFolder, { recursive: true });

        // Check log file size and rotate if needed
        try {
          const stats = await fsp.stat(logsPath);
          if (stats.size >= MAX_LOG_SIZE) {
            await Log.rotateLogs(logsPath);
          }
        } catch (err) {
          // File doesn't exist yet, no need to rotate
        }

        await fsp.appendFile(logsPath, logWithoutFormatting + "\n");
      } catch (error) {
        console.error("Error saving logs to file", error?.message || error);
      }
    })();
  }

  static async rotateLogs(logsPath) {
    try {
      const logsFolder = path.dirname(logsPath);
      const baseName = path.basename(logsPath, ".txt");

      // Delete oldest log if we have MAX_LOG_FILES
      const oldestLog = path.join(logsFolder, `${baseName}.${MAX_LOG_FILES}.txt`);
      try {
        await fsp.unlink(oldestLog);
      } catch (err) {
        // File doesn't exist, that's fine
      }

      // Rotate existing logs
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const oldPath = path.join(logsFolder, `${baseName}.${i}.txt`);
        const newPath = path.join(logsFolder, `${baseName}.${i + 1}.txt`);

        try {
          await fsp.rename(oldPath, newPath);
        } catch (err) {
          // File doesn't exist, continue
        }
      }

      // Rotate current log
      const rotatedPath = path.join(logsFolder, `${baseName}.1.txt`);
      await fsp.rename(logsPath, rotatedPath);

      console.log(`Logs rotated: ${logsPath} -> ${rotatedPath}`);
    } catch (error) {
      console.error("Error rotating logs", error?.message || error);
    }
  }

  static logJson(level, message, data = {}) {
    if (!isJsonLogEnabled()) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      caller: fastLogsEnabled() ? "n/a" : Log.getCallerFile(),
      ...data,
    };

    const logsPath = path.resolve(__dirname, "../../logs/logs.json");
    const logsFolder = path.dirname(logsPath);

    (async () => {
      try {
        await fsp.mkdir(logsFolder, { recursive: true });

        // Check log file size and rotate if needed
        try {
          const stats = await fsp.stat(logsPath);
          if (stats.size >= MAX_LOG_SIZE) {
            await Log.rotateLogs(logsPath.replace(".json", ".txt"));
          }
        } catch (err) {
          // File doesn't exist yet
        }

        await fsp.appendFile(logsPath, JSON.stringify(entry) + "\n");
      } catch (error) {
        console.error("Error saving JSON logs", error?.message || error);
      }
    })();
  }

  static metric(metricName, value, tags = {}) {
    if (getLogLevel() < 3) return;

    const data = {
      metric: metricName,
      value,
      tags,
    };

    Log.logJson("METRIC", metricName, data);

    if (getLogLevel() >= 3) {
      const tagsStr = Object.entries(tags)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      Log.debug(`Metric: ${metricName}=${value}`, tagsStr ? `(${tagsStr})` : "");
    }
  }
}

module.exports = Log;
