# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: the existing Discord bot remains Node.js with discord.js and Poru/Lavalink; the new Discord Activity is a React + Vite web surface with a small realtime gateway owned by the bot

## Users

Discord users who listen together in a server voice channel and need to control shared music without leaving Discord.

## Product Purpose

MewBit is a Discord music bot. The Activity gives the listening group a shared, visual player for the current track, playback controls, search, queue management, lyrics, filters, equalizer, and playlists.

## Positioning

The Activity keeps the shared listening state visible and editable in one Discord-native surface while the existing bot and Lavalink remain the playback authority.

## Operating Context

The Activity runs inside Discord as an Embedded App. Users operate it while the bot is connected to a voice channel. The existing message embed remains available as a fallback and entry point.

## Capabilities and Constraints

- The existing bot already owns Discord commands, queue state, source-aware search, autoplay, lyrics, filters, equalizer settings, and playlist storage.
- The Activity must control the existing player instead of creating a second playback implementation.
- Activity clients must receive realtime guild player state and send authenticated actions back to the bot.
- The browser must never receive the Discord bot token or other server secrets.
- Hosting, HTTPS exposure, Discord Embedded App configuration, and production authentication are open deployment decisions to document at handoff.

## Brand Commitments

- The product name is MewBit.
- The established identity is a neon cyberpunk anime catgirl with music-player energy.
- The visual language may use electric cyan, hot magenta, and violet accents on a dark base, but the Activity must remain readable and operationally clear.
- Copy can be playful and anime or gaming aware, but control labels and errors must stay unambiguous.

## Evidence on Hand

- Existing Discord bot implementation in `index.js`, `commands/`, `events/`, and `helpers/`.
- Existing Lavalink integration and player state in `helpers/lavalink/`.
- Existing player embed and controls in `helpers/buttons.js` and `helpers/embeds.js`.
- Existing automated tests in `tests/` covering search, autoplay, queue ordering, lyrics, filters, volume, and branding.
- Existing repository brand assets and history documented in the project commits.
- No existing Activity frontend or Activity hosting configuration was found.

## Product Principles

- One playback authority: the bot and Lavalink remain the source of truth.
- Shared state is visible before actions are taken.
- Common listening actions should take one obvious interaction.
- Search results should preserve source and track identity.
- Personality belongs in the atmosphere and copy, never at the cost of control clarity.

## Accessibility & Inclusion

The Activity must support keyboard focus, readable contrast, labelled controls, reduced motion, responsive layouts, and clear loading, empty, and error states.
