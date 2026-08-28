import { useEffect, useRef, useState } from "react";
import Field from "../controls/Field.jsx";
import { BandSliders, Select } from "../controls/Inputs.jsx";

/**
 * The server's stored equalizer.
 *
 * It is not the live player's: the bot restores this on the next player it
 * creates, and pushes it to a running one when there is one. That distinction
 * is the whole point of the section, so the copy says it rather than implying
 * the sliders only matter while something is playing.
 */
export default function EqualizerSection({ settings, commit, savedField }) {
  const eq = settings.equalizer;

  // Dragging a slider has to feel continuous while only the release is sent,
  // so the bands are held locally between commits.
  const [draft, setDraft] = useState(eq.bands);
  const dirty = useRef(false);
  // The commit reads this rather than `draft`. A keyboard adjustment fires its
  // change and its keyup in the same tick, and the state update has not landed
  // by then — reading the closure would save the value from one step ago.
  const latest = useRef(eq.bands);

  useEffect(() => {
    // Adopt server state only when this panel is not mid-drag, or a save
    // landing would snap the slider out from under the pointer.
    if (dirty.current) return;
    setDraft(eq.bands);
    latest.current = eq.bands;
  }, [eq.bands]);

  const presetOptions = eq.presets.map((name) => ({
    value: name,
    label: name === "flat" ? "Flat — no shaping" : name.charAt(0).toUpperCase() + name.slice(1),
  }));

  const isCustom = eq.preset === "custom";

  return (
    <>
      <Field
        label="Preset"
        describe="The same presets /equalizer offers. Choosing one replaces every band below."
        note={isCustom ? "Bands have been set by hand, so no preset is selected." : null}
        saved={savedField === "preset"}
      >
        <Select
          value={isCustom ? null : eq.preset}
          onChange={(value) => {
            dirty.current = false;
            commit({ equalizer: { preset: value || "flat" } }, "preset");
          }}
          options={presetOptions}
          placeholder={isCustom ? "Custom — set by hand" : undefined}
        />
      </Field>

      <Field
        label="Bands"
        describe="Fifteen Lavalink bands. This is the server's stored equalizer: it is applied to the player running now, and restored the next time MewBit starts playing."
        saved={savedField === "bands"}
        wide
      >
        <BandSliders
          bands={draft}
          frequencies={eq.frequencies}
          minGain={eq.minGain}
          maxGain={eq.maxGain}
          onChange={(index, value) => {
            dirty.current = true;
            latest.current = latest.current.map((gain, at) => (at === index ? value : gain));
            setDraft(latest.current);
          }}
          onCommit={() => {
            if (!dirty.current) return;
            dirty.current = false;
            commit({ equalizer: { bands: latest.current } }, "bands");
          }}
        />
      </Field>
    </>
  );
}
