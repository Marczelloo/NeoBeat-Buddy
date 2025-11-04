const os = require("os");
const Log = require("../logs/log");

const metrics = {
  startTime: Date.now(),
  errors: [],
  warnings: [],
  commands: {
    total: 0,
    successful: 0,
    failed: 0,
  },
  tracks: {
    played: 0,
    failed: 0,
    skipped: 0,
  },
  lavalink: {
    connected: false,
    lastCheck: null,
    reconnects: 0,
    latency: null,
  },
  performance: {
    lastMemoryUsage: null,
    lastCpuUsage: null,
    eventLoopLag: null,
  },
};

let eventLoopTimer = null;
let performanceTimer = null;
let lavalinkTimer = null;

// Monitor event loop lag
function measureEventLoopLag() {
  const start = process.hrtime.bigint();
  setImmediate(() => {
    const lag = Number(process.hrtime.bigint() - start) / 1_000_000; // Convert to ms
    metrics.performance.eventLoopLag = lag;
  });
}

// Update Lavalink latency periodically
async function updateLavalinkLatency() {
  try {
    const { getPoru } = require("../lavalink/players");
    const poru = getPoru();
    if (poru && poru.nodes && poru.nodes.size > 0) {
      const node = Array.from(poru.nodes.values())[0];
      if (node && node.connected && node.rest) {
        try {
          const start = Date.now();
          await node.rest.get(`/v4/info`);
          const latency = Date.now() - start;

          if (!isNaN(latency) && latency >= 0) {
            metrics.lavalink.latency = Math.round(latency);
            metrics.lavalink.connected = true;
          }
        } catch (err) {
          // Request failed, node might be disconnecting
        }
      }
    }
  } catch (err) {
    // Poru not available yet
  }
}

function startMonitoring() {
  // Measure event loop lag every 30 seconds
  eventLoopTimer = setInterval(measureEventLoopLag, 30_000);
  measureEventLoopLag(); // Initial measurement

  // Update performance metrics every minute
  performanceTimer = setInterval(() => {
    updatePerformanceMetrics();
  }, 60_000);

  // Update Lavalink latency every 30 seconds
  lavalinkTimer = setInterval(() => {
    updateLavalinkLatency();
  }, 30_000);

  Log.info("Health monitoring started");
}

function stopMonitoring() {
  if (eventLoopTimer) {
    clearInterval(eventLoopTimer);
    eventLoopTimer = null;
  }
  if (performanceTimer) {
    clearInterval(performanceTimer);
    performanceTimer = null;
  }
  if (lavalinkTimer) {
    clearInterval(lavalinkTimer);
    lavalinkTimer = null;
  }
  Log.info("Health monitoring stopped");
}

function updatePerformanceMetrics() {
  const memUsage = process.memoryUsage();
  metrics.performance.lastMemoryUsage = {
    heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2), // MB
    heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2), // MB
    rss: (memUsage.rss / 1024 / 1024).toFixed(2), // MB
    external: (memUsage.external / 1024 / 1024).toFixed(2), // MB
  };

  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  metrics.performance.lastCpuUsage = {
    usage: (((totalTick - totalIdle) / totalTick) * 100).toFixed(2),
    cores: cpus.length,
  };
}

function recordError(error, context = {}) {
  try {
    // Sanitize context to prevent circular references
    const sanitizedContext = {};
    for (const key in context) {
      if (context.hasOwnProperty(key)) {
        const value = context[key];
        // Only include simple values
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          sanitizedContext[key] = value;
        } else if (value === null || value === undefined) {
          sanitizedContext[key] = value;
        }
      }
    }

    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack,
      context: sanitizedContext,
    };

    metrics.errors.push(errorEntry);

    // Keep only last 100 errors
    if (metrics.errors.length > 100) {
      metrics.errors.shift();
    }

    // DO NOT call Log.error here - it creates infinite loop!
  } catch (err) {
    // Failed to record error - silently fail to prevent infinite loops
  }
}

function recordWarning(message, context = {}) {
  const warningEntry = {
    timestamp: new Date().toISOString(),
    message,
    context,
  };

  metrics.warnings.push(warningEntry);

  // Keep only last 100 warnings
  if (metrics.warnings.length > 100) {
    metrics.warnings.shift();
  }
}

function recordCommand(success = true) {
  metrics.commands.total += 1;
  if (success) {
    metrics.commands.successful += 1;
  } else {
    metrics.commands.failed += 1;
  }
}

function recordTrackPlayed() {
  metrics.tracks.played += 1;
}

function recordTrackFailed() {
  metrics.tracks.failed += 1;
}

function recordTrackSkipped() {
  metrics.tracks.skipped += 1;
}

function updateLavalinkStatus(connected, latency = null) {
  const wasConnected = metrics.lavalink.connected;
  metrics.lavalink.connected = connected;
  metrics.lavalink.lastCheck = new Date().toISOString();

  if (latency !== null) {
    metrics.lavalink.latency = latency;
  }

  // Track reconnects
  if (!wasConnected && connected) {
    metrics.lavalink.reconnects += 1;
    Log.info("Lavalink reconnected", "", `reconnects=${metrics.lavalink.reconnects}`);
  } else if (wasConnected && !connected) {
    Log.warning("Lavalink disconnected");
  }
}

function getUptime() {
  const uptimeMs = Date.now() - metrics.startTime;
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function getMetrics() {
  return {
    uptime: getUptime(),
    uptimeMs: Date.now() - metrics.startTime,
    ...metrics,
  };
}

function getRecentErrors(limit = 10) {
  return metrics.errors.slice(-limit).reverse();
}

function getRecentWarnings(limit = 10) {
  return metrics.warnings.slice(-limit).reverse();
}

function getHealthStatus() {
  updatePerformanceMetrics();

  const status = {
    healthy: true,
    issues: [],
  };

  // Check memory usage
  if (metrics.performance.lastMemoryUsage) {
    const heapUsedMB = parseFloat(metrics.performance.lastMemoryUsage.heapUsed);
    const heapTotalMB = parseFloat(metrics.performance.lastMemoryUsage.heapTotal);
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

    if (heapUsagePercent > 90) {
      status.healthy = false;
      status.issues.push(`High memory usage: ${heapUsagePercent.toFixed(1)}%`);
    } else if (heapUsagePercent > 75) {
      status.issues.push(`Elevated memory usage: ${heapUsagePercent.toFixed(1)}%`);
    }
  }

  // Check event loop lag
  if (metrics.performance.eventLoopLag !== null && metrics.performance.eventLoopLag > 100) {
    status.healthy = false;
    status.issues.push(`High event loop lag: ${metrics.performance.eventLoopLag.toFixed(2)}ms`);
  } else if (metrics.performance.eventLoopLag !== null && metrics.performance.eventLoopLag > 50) {
    status.issues.push(`Elevated event loop lag: ${metrics.performance.eventLoopLag.toFixed(2)}ms`);
  }

  // Check Lavalink connection
  if (!metrics.lavalink.connected) {
    status.healthy = false;
    status.issues.push("Lavalink not connected");
  }

  // Check error rate
  const recentErrors = getRecentErrors(10);
  if (recentErrors.length >= 10) {
    status.healthy = false;
    status.issues.push(`High error rate: ${recentErrors.length} errors in recent history`);
  } else if (recentErrors.length >= 5) {
    status.issues.push(`Elevated error rate: ${recentErrors.length} recent errors`);
  }

  // Check command success rate
  const totalCommands = metrics.commands.total;
  if (totalCommands > 0) {
    const successRate = (metrics.commands.successful / totalCommands) * 100;
    if (successRate < 90) {
      status.healthy = false;
      status.issues.push(`Low command success rate: ${successRate.toFixed(1)}%`);
    } else if (successRate < 95) {
      status.issues.push(`Reduced command success rate: ${successRate.toFixed(1)}%`);
    }
  }

  return status;
}

function resetMetrics() {
  metrics.errors = [];
  metrics.warnings = [];
  metrics.commands = { total: 0, successful: 0, failed: 0 };
  metrics.tracks = { played: 0, failed: 0, skipped: 0 };
  Log.info("Health metrics reset");
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  recordError,
  recordWarning,
  recordCommand,
  recordTrackPlayed,
  recordTrackFailed,
  recordTrackSkipped,
  updateLavalinkStatus,
  getMetrics,
  getRecentErrors,
  getRecentWarnings,
  getHealthStatus,
  resetMetrics,
  getUptime,
};
