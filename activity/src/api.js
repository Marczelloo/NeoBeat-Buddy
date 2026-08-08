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

  const response = await fetch(apiUrl(path), { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Activity request failed (${response.status}).`);
  return payload;
}

export function fetchActivityState({ guildId, accessToken }) {
  return request(`/api/activity/state?guildId=${encodeURIComponent(guildId)}`, {}, accessToken);
}

export function searchActivity({ guildId, accessToken, query, source }) {
  return request(
    "/api/activity/search",
    { method: "POST", body: JSON.stringify({ guildId, query, source }) },
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
  const socket = new WebSocket(websocketUrl("/api/activity/ws"));
  socket.addEventListener("open", () => {
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
  socket.addEventListener("error", () => onError?.(new Error("Realtime Activity connection failed.")));
  return () => socket.close();
}
