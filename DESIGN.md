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

The first viewport is a two-column split. The left column holds the current artwork, title, source, progress, transport controls, volume, and autoplay state. The right column is a tabbed workspace for queue, search, sound, lyrics, and playlists. Below 1060px the layout becomes a single column. Below 680px controls and search collapse into touch-friendly rows with no horizontal overflow.

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
