# GhostFour

Four-bar live ghost note desk for bedroom producers and AI-music finishers.

AI tools and loop DAWs write static pockets that never finish. Session players drop quiet anticipatory notes and light fills — nylon ghosts on the and-of-4, piano whispers, kit ghosts — so the loop breathes and the ear can land the next section.

Live samples only — FluidR3 acoustic grand, upright bass, nylon guitar, trumpet, violin, and kit from `soundfont-for-samplers@0.0.3`. No oscillators. Audio never leaves the tab.

## Distinct from yesterday and the rest of the line

| Tool | Job |
| --- | --- |
| SpaceFour | Four bars of air so the hook can slam |
| ArcEight | Eight-bar energy arc that builds density |
| RoomFour | Four bars of room |
| PunchFour | Four-bar live punch hits |
| **GhostFour** | Four bars of quiet ghost notes so the pocket finishes |

Yesterday's ship was SpaceFour (air). GhostFour is the subtle notes that make a loop feel alive without adding height.

## Form

1–4 pocket with ghosts · the quiet notes finish the loop

## Pricing and license

One-time **$19** on Gumroad. Mirror on Lemon Squeezy. Optional $9 add-on inside Forge Pass ($24/mo).

This is a finite desk, not a recurring studio. Do not subscribe it standalone. Sell next to the other live-chair desks. Bedroom finishers already buy $9–$29 one-shots.

Best place to sell: Gumroad (producers buy one-time tools there) + Lemon Squeezy as merchant of record. Link from workinwithai.com beside the Forge line.

**License gate connected.** Enter a key starting with GF-, LS-, or GUM- to unlock play and exports (demo client-side check; replace with real Lemon Squeezy / Gumroad license API verification for production sales). MIT source, commercial desk gated.

## Acceptance (section 9)

1. Export at 92 BPM, 4 bars, 48 kHz → exactly 500,870 samples (4 × 4 × 60/92 × 48000, rounded); first transient within 1 ms of sample 0.
2. Import WAV at bar 1 of 92 BPM DAW, loop 4× — no clicks at seam, no drift.
3. Play, switch tab 30 s, return — stopped cleanly, no stacked notes.
4. Change recipe / BPM while playing — heard within one bar, no restart.
5. Block sample host, reload — UI names missing instruments.
6. Longest pad sustains to end of note.
7. Grep: no @main / @gh-pages, no Math.random in export path, voice names match samples.

## License

MIT source. workinwithai-create. Commercial use requires valid license key (Gumroad/Lemon Squeezy).

## Stack

Static HTML/CSS/JS. Deploy on Vercel team `release-forge`.

Permanent live: https://ghostfour.vercel.app/
