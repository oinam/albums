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

## One spacing value

`--gap` is the distance between two thumbnails **and** the distance from a
thumbnail to the edge of the viewport. The media sits just off the edge rather
than against it, and the two spacings cannot drift apart because they are the same
declaration. Text keeps a wider margin of its own (`--edge`) — prose needs more
room than pictures do.

## The media reaches both edges, and the rows are flush

The grid is a justified gallery — the shape Flickr and Google Photos use — and it
needs no JavaScript.

Each item carries its aspect ratio as `--ar`, and gets a `flex-basis` and a
`flex-grow` both proportional to it. Flexbox hands a row's free space out in
proportion to grow factors, so each item's final width stays proportional to its
ratio, which means **every item in a row resolves to the same height**. Rows come
out flush left and flush right, and the bottom of the grid is flush with them.

Two details make it work:

- Separation is `gap`, not padding. Padding sits inside the border-box basis and
  breaks the proportionality, leaving rows a few pixels uneven.
- `.grid::after` has an enormous `flex-grow`, which absorbs the last row's free
  space so a half-full final row keeps its natural size instead of stretching one
  picture across the viewport.

This replaced a column-based masonry, which filled the width but flowed top-to-
bottom down each column. The justified layout reads left to right, the way the
items are actually ordered.

## No header; one footer

There is no header bar. A page opens with its content — pictures on the home page,
the album's own title on an album page — because a bar carrying the site name above
every one of them repeated what the tab title and the footer already say.

The footer is the only chrome: the site name on the left, and RSS, About, Contact,
oinam.com and the theme control on the right. It sits on the page background with a
border doing the separating, and it is not fixed — `margin-top: auto` pushes it
down rather than pinning it.

The theme control has three states, not two. `auto` stamps nothing on the document
and lets `prefers-color-scheme` decide; light and dark set `data-theme` explicitly
and win over the system in both directions. The stored choice is applied by a small
script in the head, before first paint, so a chosen theme never flashes the other.

Colours are `oklch(L% 0 0)` — plain numbers rather than percentage chroma and a
degree hue. Both of those are valid CSS and both are the least widely implemented
corners of `oklch()`, and a token that fails to parse leaves a background unpainted.
Chroma is zero throughout, so the hue never carried any information anyway.

## Images load eagerly above the fold

The first eight tiles carry `loading="eager"`, the first of each grid also
`fetchpriority="high"`, and everything past that is lazy.

Marking every tile lazy is the obvious default and it is wrong twice over. It delays
the largest contentful paint for no saving, since those images are needed
immediately. And the deferral decision is not dependable: on the live site a tile
sitting at `top: 262` in an 861px viewport was never fetched at all, while a forced
`Image()` with the same source loaded instantly. Content blockers make it worse.

Lazy loading is for what is genuinely off-screen.

## Alt text is empty rather than wrong

`alt` falls back to the item's title, and then to the empty string — never to the
filename. A screen reader announcing "dsc_0142.jpg" is worse than announcing nothing,
and an empty `alt` is the correct markup for an image with no caption. Write one by
hand in `photos.json` when the picture carries meaning the title does not.

## Keyboard shortcuts sit on top of the links

`←` and `→` follow the pager, `R` takes the random link, `H` goes home. They are a
shortcut over hrefs that are already on the page, not a second way to navigate:
every target is a real `<a>`, so Tab and Enter reach all of them with no script at
all, and the script only saves the tabbing.

Bare keys, no modifier. That is what Flickr, Google Photos and every lightbox use,
and it is what a visitor tries first. The modified forms are the ones to leave alone
— `Alt`/`Cmd` + `←` is browser history — so the handler returns the moment any
modifier is held.

Random is `R` and not `Space`. Space is page-down. Taking it would break scrolling on
exactly the long pages where the shortcuts are worth having, and a shortcut bought
with a browser default is a bad trade.

Typing is exempt: an `input`, `textarea`, `select` or anything `contenteditable`
swallows the key first, so a search field added later needs no change here. The pager
icons carry their key in the `title` attribute, because a shortcut nobody can
discover is a shortcut nobody uses.

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
