const configuredGateway = String(import.meta.env.VITE_ACTIVITY_GATEWAY_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  return `${configuredGateway}${path}`;
}

function websocketUrl(path) {
  if (configuredGateway) {
    return configuredGateway.replace(/^http/i, "ws") + path;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

async function request(path, options = {}, accessToken = null) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(new Error("Activity request timed out.")), 12_000);
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(apiUrl(path), { ...options, headers, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Activity request failed (${response.status}).`);
    return payload;
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) throw new Error("Activity request timed out. Please try again.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export function fetchActivityState({ guildId, accessToken }) {
  return request(`/api/activity/state?guildId=${encodeURIComponent(guildId)}`, {}, accessToken);
}

export function searchActivity({ guildId, accessToken, query, source, signal }) {
  return request(
    "/api/activity/search",
    { method: "POST", body: JSON.stringify({ guildId, query, source }), signal },
    accessToken
  );
}

export function sendActivityAction({ guildId, accessToken, action, payload }) {
  return request(
    "/api/activity/action",
    { method: "POST", body: JSON.stringify({ guildId, action, payload }) },
    accessToken
  );
}

export function connectActivitySocket({ guildId, accessToken, onState, onReady, onError }) {
  let socket = null;
  let reconnectTimer = null;
  let stopped = false;
  let retryCount = 0;

  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(websocketUrl("/api/activity/ws"));
    socket.addEventListener("open", () => {
      retryCount = 0;
      socket.send(JSON.stringify({ type: "auth", guildId, token: accessToken }));
    });
    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "state") onState(payload.state);
        if (payload.type === "ready") onReady?.(payload.identity);
        if (payload.type === "error") onError?.(new Error(payload.error));
      } catch (error) {
        onError?.(error);
      }
    });
    socket.addEventListener("close", () => {
      if (stopped) return;
      const baseDelay = Math.min(5000, 600 * (2 ** Math.min(retryCount, 3)));
      const delay = Math.round(baseDelay * (0.75 + Math.random() * 0.5));
      retryCount += 1;
      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connect, delay);
    });
    socket.addEventListener("error", () => onError?.(new Error("Realtime Activity connection interrupted. Reconnecting…")));
  };

  connect();
  return () => {
    stopped = true;
    window.clearTimeout(reconnectTimer);
    socket?.close();
  };
}
