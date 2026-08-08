# MewBit Activity Design

## Surface

Operate mode. This is a dense shared music cockpit inside a Discord Activity. The interface is designed for people already listening together, so state, controls, and recovery paths outrank decoration.

## World

MewBit extends the existing neon cyberpunk anime catgirl identity into dark interface chrome. The system uses a quiet near-black base, electric cyan for primary control and realtime state, hot magenta for media energy, and violet for secondary source emphasis. The palette stays consistent across the surface. There are no light-mode sections inside the Activity.

## Typography

The Activity uses an Avenir Next and Segoe system stack for readable UI copy. Monospace is reserved for measurements, provider labels, time, and connection state. Dynamic values use tabular numerals. Headings use tight tracking and balanced wrapping instead of decorative type effects.

## Shape and surfaces

Panels use an 18px radius. Controls use a 12px radius. Artwork uses a 12px radius for queue rows and an 18px radius for the main cover. Borders communicate structure and selected state. Shadows are soft, tinted by the dark surface, and never used as a zero-offset glow.

## Composition

The first viewport follows a Spotify-like player shell. A dynamic center is surrounded by a slide-out playlist library on the left and an always-ready queue on the right. The center opens on Home when nothing is playing and becomes the full player when a track is active. Search, sound, lyrics, and playlist editing replace the center content without leaving the room. A sticky bottom player bar keeps the current track, transport, seek, volume, provider, and expand-to-full-player action available across every view. The queue is open by default on desktop; the library is closed by default. Below 900px the sidebars become drawers, and on narrow/short Discord windows the dedicated compact player takes over.

## Discord compact mode

When the Activity viewport is both narrow and short, it switches composition instead of compressing the desktop cockpit. The compact surface keeps only the artwork banner, track identity, provider, progress and time, previous/play/skip/lyrics/mute controls, and volume when vertical space allows. Queue and secondary workspaces remain available in the full Activity view. The trigger is content-driven at `max-width: 620px` and `max-height: 420px`, matching Discord's minimized Activity panel rather than ordinary phone portrait use.

## Motion

Motion communicates live playback and feedback. The cover signal animates only while a track is playing. Search loading uses a restrained skeleton. Toasts enter with a short vertical settle. `prefers-reduced-motion` disables looping and transition-heavy effects.

## Interaction rules

- Every control has a visible label, tooltip, or accessible name.
- Queue rows support native drag-and-drop reordering and explicit remove actions.
- Search results show the resolved provider beside the track identity.
- Lyrics keep the active line separate from static text and expose a refresh action.
- EQ uses native range inputs for keyboard and pointer access.
- Empty, loading, error, offline preview, and live states are explicit.

## Implementation boundary

The Activity never becomes a second playback engine. It reads state from the bot gateway and sends authenticated actions back to the existing Poru and Lavalink helpers. The browser never receives the Discord bot token or client secret.
