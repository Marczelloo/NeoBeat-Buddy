export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function call(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || "Something went wrong.", response.status);
  }
  return payload;
}

export const getMe = () => call("/api/dashboard/me");
export const getSettings = (guildId) => call(`/api/dashboard/guilds/${guildId}/settings`);
export const patchSettings = (guildId, patch) =>
  call(`/api/dashboard/guilds/${guildId}/settings`, { method: "PATCH", body: patch });
export const getAccess = (guildId) => call(`/api/dashboard/guilds/${guildId}/access`);
export const putAccess = (guildId, operators) =>
  call(`/api/dashboard/guilds/${guildId}/access`, { method: "PUT", body: { operators } });
export const getEmbedOptions = (guildId) => call(`/api/dashboard/guilds/${guildId}/embed`);
export const postEmbed = (guildId, embed) =>
  call(`/api/dashboard/guilds/${guildId}/embed`, { method: "POST", body: embed });
export const getInstance = () => call("/api/dashboard/instance");
export const getPublicStats = () => call("/api/dashboard/public/stats");
export const logout = () => call("/api/dashboard/logout", { method: "POST" });

export const loginUrl = "/api/dashboard/login";
export const repoUrl = "https://github.com/Marczelloo/NeoBeat-Buddy";
