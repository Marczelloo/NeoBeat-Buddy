const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const PROPOSAL_COLOR = 0x5865f2;
const MAX_SUMMARY_LINES = 5;
const MAX_FIELD_LENGTH = 1024;

function formatProposalDescription(proposal) {
  const preview = proposal?.preview ?? {};
  const lines = [];

  if (preview.isPlaylist) {
    const trackCount = Number(preview.trackCount) || 0;
    lines.push("Playlist suggestion");
    if (trackCount > 0) {
      lines.push(`Tracks: ${trackCount}`);
    }
  } else {
    lines.push("Single track suggestion");
  }

  if (typeof preview.source === "string" && preview.source.trim()) {
    lines.push(`Source: ${preview.source}`);
  }

  if (proposal.prepend) {
    lines.push("Requested to play next");
  }

  return lines.join("\n") || "New track suggestion";
}

function resolveRequesterLabel(requester) {
  if (requester?.id) return `<@${requester.id}>`;
  if (requester?.tag) return requester.tag;
  return "Unknown listener";
}

function buildProposalEmbed(proposal, { statusLabel = "Pending DJ approval" } = {}) {
  const preview = proposal?.preview ?? {};
  const title = preview.title ?? proposal.query ?? "Track suggestion";

  const embed = new EmbedBuilder()
    .setColor(PROPOSAL_COLOR)
    .setTitle(title)
    .setDescription(formatProposalDescription(proposal))
    .addFields(
      { name: "Requested by", value: resolveRequesterLabel(proposal.requester) },
      { name: "Status", value: statusLabel }
    )
    .setFooter({ text: `Suggestion #${proposal.id}` });

  if (preview.url) {
    embed.setURL(preview.url);
  }

  return embed;
}

function buildProposalComponents(guildId, proposalId) {
  const approve = new ButtonBuilder()
    .setCustomId(`dj|proposal|${guildId}|${proposalId}|approve`)
    .setStyle(ButtonStyle.Success)
    .setLabel("Approve");

  const reject = new ButtonBuilder()
    .setCustomId(`dj|proposal|${guildId}|${proposalId}|reject`)
    .setStyle(ButtonStyle.Danger)
    .setLabel("Reject");

  return [new ActionRowBuilder().addComponents(approve, reject)];
}

function buildProposalAnnouncement(proposal, roleId) {
  const base = "New suggestion awaiting DJ approval.";
  const mention = roleId ? `<@&${roleId}> ` : "";

  return {
    content: `${mention}${base}`,
    allowedMentions: roleId ? { roles: [roleId] } : { parse: [] },
  };
}

function buildPendingSuggestionsField(proposals) {
  if (!Array.isArray(proposals) || proposals.length === 0) return null;

  const lines = proposals.slice(0, MAX_SUMMARY_LINES).map((proposal) => {
    const preview = proposal.preview ?? {};
    const title = preview.title ?? proposal.query ?? "Pending suggestion";
    const trackCount = Number(preview.trackCount) || null;
    const playlistSuffix = preview.isPlaylist && trackCount ? " (" + trackCount + " tracks)" : "";
    return "- " + title + playlistSuffix + " - requested by " + resolveRequesterLabel(proposal.requester);
  });

  let value = lines.join("\n");
  const remaining = proposals.length - lines.length;
  if (remaining > 0) {
    value += "\n...and " + remaining + " more suggestion(s) pending approval.";
  }

  if (value.length > MAX_FIELD_LENGTH) {
    value = value.slice(0, MAX_FIELD_LENGTH - 3) + "...";
  }

  return { name: "Pending suggestions", value };
}

function disableComponents(rows) {
  if (!Array.isArray(rows)) return [];

  const normalized = rows
    .map((row) => {
      const builder = new ActionRowBuilder();

      if (Array.isArray(row.components)) {
        row.components.forEach((component) => {
          try {
            builder.addComponents(ButtonBuilder.from(component).setDisabled(true));
          } catch {
            // ignore components that cannot be cloned as buttons
          }
        });
      }

      return builder.components.length ? builder : null;
    })
    .filter(Boolean);

  return normalized;
}

module.exports = {
  buildProposalEmbed,
  buildProposalComponents,
  buildProposalAnnouncement,
  buildPendingSuggestionsField,
  disableComponents,
};
