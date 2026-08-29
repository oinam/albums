---
title: Design
description: The rules the interface follows, and why.
---

# Design

One stylesheet, `assets/site.css`, no framework and no build step for it. Everything
below is a rule the pages actually follow, not an aspiration.

## The chrome is grayscale; the pictures are the colour

Every colour token in the palette has **zero chroma** — they are `oklch()` greys and
nothing else. Type, rules, borders, backgrounds, the video badge: all neutral.

That is the whole point. A photo archive that tints its own furniture ends up
competing with the work on the wall. The only saturated pixels on any page belong
to the media.

If you ever add an accent colour, add it knowing it will be the single loudest
non-photographic thing on the site.

## The page has no width limit

There is no `max-width` on `body`. Gutters come from
`padding-inline: clamp(1rem, 3vw, 3.25rem)`, so they grow with the viewport, and the
thumbnail lattice keeps adding columns for as long as there is room. A wider monitor
shows more photographs rather than more empty margin.

Prose is the exception. Captions and the tagline cap at `68ch`, because a line of
text three thousand pixels wide is unreadable no matter how much room exists. Grids
expand; sentences do not.

## The lattice

Thumbnails are 4:3 or 3:4 and nothing else, which is what makes a pure-CSS masonry
possible — see [URLs and sizes](/urls/). The grid is an 80px lattice, wide tiles
span 4 × 3 cells and tall tiles 3 × 4, with `grid-auto-flow: dense` to pack them.

Below 400px the cell drops to 64px, because a wide tile spans four of them and four
80px cells will not fit a small phone.

## Spacing and type

Spacing is a golden-ratio scale carried over from the site's first version:
`--space` is `1.618rem`, with a smaller and a larger step derived from it. The
typeface is the system UI stack — nothing is downloaded, so there is no font flash
and no third-party request.

Headings scale with the viewport through `clamp()` rather than at breakpoints.

## Dark mode

`prefers-color-scheme: dark` swaps the grey tokens and nothing else. Because the
palette is neutral, the dark theme needed no separate design pass — the same rules
hold with the values inverted.

## Motion

Almost none. Thumbnails dim slightly on hover, and that is the extent of it.
`prefers-reduced-motion: reduce` removes even that, along with smooth scrolling.
