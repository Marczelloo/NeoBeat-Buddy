const sessions = new Map();

function clear(guildId)
{
  sessions.delete(guildId);
}

function requiredVotes(count, threshold)
{
  const needed = Math.ceil(count * threshold);
  return Math.max(1, needed);
}

function registerVote({ guildId, userId, voiceChannelId, eligibleCount, threshold })
{
  if(!guildId || !userId)
  {
    throw new Error('registerVote requires guildId and userId');
  }

  const count = Math.max(0, Number(eligibleCount) || 0);
  const clampThreshold = Math.min(Math.max(Number(threshold) || 0.5, 0.1), 1);
  const needed = requiredVotes(count, clampThreshold);

  let session = sessions.get(guildId);
  if(!session || session.voiceChannelId !== voiceChannelId)
  {
    session = {
      voiceChannelId,
      voters: new Set(),
      eligibleCount: count,
      startedAt: Date.now(),
    };
  }
  else
  {
    session.eligibleCount = count;
  }

  if(session.voters.has(userId))
  {
    sessions.set(guildId, session);
    return { status: 'duplicate', votes: session.voters.size, required: needed };
  }

  session.voters.add(userId);
  session.updatedAt = Date.now();

  if(session.voters.size >= needed)
  {
    sessions.delete(guildId);
    return { status: 'passed', votes: session.voters.size, required: needed };
  }

  sessions.set(guildId, session);
  return { status: 'progress', votes: session.voters.size, required: needed };
}

function getSession(guildId)
{
  return sessions.get(guildId) ?? null;
}

module.exports = {
  registerVote,
  clear,
  getSession,
};

