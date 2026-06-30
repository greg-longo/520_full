# Jamie avatar — drop your still frames here

No GIF needed. Provide **still PNG images** with different expressions and the engine animates Jamie by cycling between them: gentle idle motion, occasional blinks, faster "talking" motion while her dialogue types, and an expression change to match each beat.

## Naming scheme (exact)

```
jamie-<emotion>-<frame>.png      ← idle frames (1, 2, 3, ...)
jamie-<emotion>-blink.png        ← optional eyes-closed frame (for blinking)
```

**Emotions:** `neutral`, `approve`, `concern`, `disappoint`, `warm`

| Emotion | When it shows |
|---|---|
| `neutral` | Default — talking / idle (most beats) |
| `approve` | Student gets a decision or code task right |
| `concern` | The ethics beat + the "pause and think" interstitial |
| `disappoint` | Student gets a decision wrong |
| `warm` | Finale / encouragement (once the finale is built) |

## How many frames?

You said "as many as appropriate" — here's the guide:

- **Minimum per emotion:** 1 frame (`jamie-neutral-1.png`). Works, but static for that emotion.
- **To get gentle idle motion:** 2–3 idle frames (`jamie-neutral-1.png`, `-2.png`, `-3.png`). The engine slowly cycles them. Make them *slightly* different (tiny head tilt, small mouth/brow change) — subtle is better than busy.
- **To get blinking:** add `jamie-neutral-blink.png` (same pose, eyes closed). The engine flashes it for ~130 ms every few seconds.
- **To get a "talking" feel:** give `neutral` 2–4 frames with small mouth differences (open/closed/slightly-open). While Jamie's text types out, the engine cycles these faster, so she looks like she's speaking; then it slows to idle.

**Most impactful, least work:** focus your frames on `neutral` (where she spends most time) — say `neutral-1/2/3` + `neutral-blink`. The reaction emotions (`approve`, `concern`, `disappoint`, `warm`) can be a single frame each and still read great, since they only flash briefly.

The engine probes up to **6 idle frames** per emotion (`-1` … `-6`) plus one `-blink`.

## Example file set (a good starting point)
```
jamie-neutral-1.png      jamie-neutral-2.png    jamie-neutral-3.png    jamie-neutral-blink.png
jamie-approve-1.png      jamie-approve-blink.png
jamie-concern-1.png
jamie-disappoint-1.png
jamie-warm-1.png
```

## Specs
- **Size:** ~256×256 px, square. Displayed in a circle (42px header, 48px in dialogue), so keep the face centered.
- **Consistent framing across frames** — same crop/position, only the expression changes. Otherwise she'll appear to jump.
- **PNG** (transparent or solid background both fine). Keep each well under ~150 KB.

## Fallbacks (all safe)
- Missing emotion entirely → the built-in SVG portrait shows. Add emotions one at a time.
- One frame only → static for that emotion (no idle cycle).
- No `-blink` frame → she just doesn't blink for that emotion.
- `prefers-reduced-motion` users → a single static frame, no cycling/blinking.
