# Activity screenshots

Drop the files below into this folder. The landing page detects them and
renders the screenshot strip automatically — no code change needed. Until
`search.png` exists, the whole strip stays out of the document, so the page is
correct either way.

| File | What it should show |
|---|---|
| `search.png` | The search view with results listed — the "Find a track" header visible, several rows with covers, durations and the row actions. |
| `lyrics.png` | The lyrics view mid-song, so the dimmed past lines, the highlighted current line and the upcoming lines are all visible. |
| `filters.png` | The "Shape the sound" panel on the **Effects** tab, showing the Fun Filters grid. |
| `equalizer.png` | The same panel on the **Equalizer** tab, showing the 15-band sliders. |
| `embed.png` | The Discord text-channel embed — "Now Playing" with the field grid and both button rows. |

## Capture settings

- **Scale:** 2× (device pixel ratio 2) if your display allows it, otherwise 1× is fine.
- **Width:** capture the Activity at roughly 1400px wide so the three-column
  layout is intact. For `embed.png`, crop tightly to the embed itself.
- **Format:** PNG.
- **Chrome:** no browser toolbar, address bar, taskbar or desktop behind the
  window — crop to the app surface only. The current screenshots include the
  Windows window edge and a sliver of the desktop on the left; crop that out.
- **Theme:** dark, as shipped.
- **State:** something is playing, with a couple of tracks queued, so the
  surface does not look empty.

## Note on the EQ labels

`equalizer.png` will show the band labels the Activity currently renders
(`60 … 1m`). Those are wrong — `BAND_FREQUENCIES` in
`helpers/equalizer/panel.js` is `25 Hz … 16 kHz`, and frequencies above 20 kHz
are inaudible. Worth fixing in the Activity before capturing this one, or the
screenshot will publish the bug.
