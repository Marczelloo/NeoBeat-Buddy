const proposals = new Map();
const counters = new Map();

function nextId(guildId)
{
  const current = counters.get(guildId) ?? 0;
  const next = current + 1;
  counters.set(guildId, next);
  return String(next);
}

function ensureStore(guildId)
{
  if(!proposals.has(guildId))
  {
    proposals.set(guildId, new Map());
  }

  return proposals.get(guildId);
}

function clone(payload)
{
  if(payload == null) return payload;
  try
  {
    return structuredClone(payload);
  }
  catch(error)
  {
    return JSON.parse(JSON.stringify(payload));
  }
}

function createProposal(guildId, data)
{
  const store = ensureStore(guildId);
  const id = nextId(guildId);
  const entry = {
    id,
    status: 'pending',
    createdAt: Date.now(),
    ...clone(data),
  };

  store.set(id, entry);
  return entry;
}

function getProposal(guildId, proposalId)
{
  return proposals.get(guildId)?.get(proposalId) ?? null;
}

function listProposals(guildId)
{
  const store = proposals.get(guildId);
  return store ? Array.from(store.values()) : [];
}

function setMessageReference(guildId, proposalId, messageId, channelId)
{
  const entry = getProposal(guildId, proposalId);
  if(!entry) return null;

  entry.messageId = messageId;
  entry.channelId = channelId;
  return entry;
}

function resolveProposal(guildId, proposalId, status)
{
  const entry = getProposal(guildId, proposalId);
  if(!entry) return null;

  entry.status = status;
  entry.resolvedAt = Date.now();

  const store = proposals.get(guildId);
  store?.delete(proposalId);

  return entry;
}

function deleteProposal(guildId, proposalId)
{
  const store = proposals.get(guildId);
  if(!store) return false;
  return store.delete(proposalId);
}

function clearGuild(guildId)
{
  proposals.delete(guildId);
  counters.delete(guildId);
}

module.exports = {
  createProposal,
  getProposal,
  listProposals,
  setMessageReference,
  resolveProposal,
  deleteProposal,
  clearGuild,
};

