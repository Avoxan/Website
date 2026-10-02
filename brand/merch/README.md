# Avoxan merch artwork: pins & hats

Every file here is built from the official logo (`/avoxan-logo.svg`, the copper
oval + A/X monogram). The "Avoxan" wordmark comes from the lockup in `/og-image.png`,
traced to vector. See `avoxan-merch-overview.jpg` for all designs on one page.

**Send vendors the `.svg` files.** They're true vector, sized to real inches
(viewBox units = 1/1000 in). The `.png` files are high-res transparent fallbacks,
and the `*-preview.jpg` files are mockups for you, not for production.

## Brand colors

| Use            | Hex       |
| -------------- | --------- |
| Copper (logo)  | `#CA5B2B` |
| Near-black     | `#14110E` |
| Cream          | `#F2EBDC` |

Ask the vendor to match the copper hex to their closest Pantone / thread color
and send a proof photo before production.

## Pins (`pins/`)

| File | What it's for | Size |
| --- | --- | --- |
| `avoxan-enamel-pin-copper-on-black-1.25in.svg` | Hard-enamel lapel pin, black fill | 1.25 in tall × 0.78 in |
| `avoxan-enamel-pin-copper-on-cream-1.25in.svg` | Hard-enamel lapel pin, cream fill | 1.25 in tall × 0.78 in |
| `avoxan-button-pin-2.25in-print.svg` / `.png` | Printed round button (pin-back badge) | 2.25 in face, 2.625 in cut circle (600 dpi PNG) |

**Enamel pin order notes**
- Style: hard enamel (soft enamel works too), die-cut to the oval.
- Metal plating: **copper** (rose gold is a close alternative). Everything in the
  `METAL_copper-plating` group is raised metal.
- Enamel fill: the `ENAMEL_black` or `ENAMEL_cream` group.
- Back: 2 rubber clutches or 1 locking clutch (stops it falling off a jacket).
  Backstamp: "AVOXAN" if the vendor offers it.
- Size: 1.25 in is the sweet spot. Don't go below 1 in or the hairlines in the A
  get too thin for metal lines.

**Button pin notes:** the 2.625 in circle is the cut size for a standard 2.25 in
button. The outer ~0.19 in wraps around the edge, so all artwork stays inside
the center ~2 in.

## Hats (`hats/`)

All hat art is single-color (copper thread), with strokes slightly thickened so
they hold up as stitches.

| File | Placement | Size |
| --- | --- | --- |
| `avoxan-hat-front-emblem-embroidery.svg` | Front center, the main hat logo | 2 in tall × 1.25 in |
| `avoxan-hat-front-lockup-embroidery.svg` | Front center, emblem + wordmark (wider caps / dad hats) | 4 in wide × 1.56 in |
| `avoxan-hat-back-wordmark-embroidery.svg` | Back above the strap, or left side panel | 2.25 in wide × 0.58 in |

**Embroidery order notes**
- Flat embroidery, 1 color. Copper thread on black, navy, or stone/khaki caps.
  On a copper or orange cap, switch the thread to cream `#F2EBDC`.
- Tell the digitizer: "keep the thin hairlines in the A and the wordmark as
  run/bean stitch, not satin."
- Want something premium? The front emblem also works as a laser-engraved
  leather patch or a 3D-puff embroidery (puff only at 2.5 in tall or bigger).

## Regenerating

The source paths come straight from `/avoxan-logo.svg`. If the logo changes, the
files need to be regenerated.
