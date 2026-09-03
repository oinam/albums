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

## Prose links are underlined; chrome links are not

`--link-color` and `--text-color` are the same grey, so a link inside an album's
description has nothing but its position to mark it — and inside a paragraph,
position marks nothing. Those get an underline.

The footer, the pager and the breadcrumb do not. What they are is obvious from
where they sit, and underlining them would draw rules across a page whose whole
job is to stay out of the pictures' way.

## The page has no width limit

There is no `max-width` on `body`. Gutters come from
`padding-inline: clamp(1rem, 3vw, 3.25rem)`, so they grow with the viewport, and the
thumbnail lattice keeps adding columns for as long as there is room. A wider monitor
shows more photographs rather than more empty margin.

Prose is the exception. Captions and the tagline cap at `68ch`, because a line of
text three thousand pixels wide is unreadable no matter how much room exists. Grids
expand; sentences do not.

## Two shapes, and only two

Thumbnails are 4:3 or 3:4 and nothing else. Wide and tall have identical area —
320 × 240 and 240 × 320 are both 76,800 px — so a portrait carries the same visual
weight as a landscape beside it, and a grid of mixed shapes still reads as one
wall. Only a photo taller than it is wide gets the tall crop; video and audio are
always wide. See [URLs and sizes](/urls/) for the rendition sizes behind them.

Two shapes is also what makes the layout below possible without JavaScript.

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

The way home rides on that title instead. An album page's `h1` reads
`Albums / Amsterdam 2024JUN`, and the item pager carries the same crumb above its
album link — so every page below the root shows a link back without a bar to hold
one. It is a breadcrumb rather than a button: the crumb is muted, the current page
is plain text, and both sit at the size the title was already set in.

The footer is the only chrome: the site name on the left, and RSS, Contact,
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

## The album title's line carries the tools

An album page opens with `Albums / Amsterdam 2024JUN` and, on the same rule, a
toolbar on the right. It is not the header bar the site does without: it belongs to
the album, it appears on no other page, and it holds controls for the thing directly
below it rather than links away from it.

Sorting is the only tool so far, and it is an icon in a fixed square — bars that
shorten under a downward arrow for newest first, lengthen under an upward one for
oldest. It says the order the album is currently in rather than the order it would
switch to: a control labelled with its destination reads as a command, one labelled
with its state reads as a fact, and a fact is what you want when you glanced up to
check which way the album runs. The words are still there, in `title` and the
`aria-label`.

They are not on the button because they moved it. "Newest first" and "Oldest first"
set to different widths, so pressing the button resized it and the icon jumped
sideways under the cursor that had just clicked it. A control that will be pressed
twice in a row has to be the same size both times, which is why the square is fixed
rather than fitted.

An album of one item gets no toolbar. There is nothing to reorder, and a control
that cannot change anything is worse than an empty corner.

### It moves the tiles, it does not restyle them

The toggle reorders the DOM rather than setting `order` on the flex items. `order`
is visual only: the tab sequence would keep running the other way, so a keyboard
visitor reversing the album would find the focus ring jumping from the first tile
they see to the far end of the page.

Reordering does invalidate what the build decided about loading, so the tiles that
land at the top are marked eager afterwards — without that, a reversed album opens
with a screenful of images the browser has been told it may defer, which is the
failure described below.

The choice is kept in `localStorage` and applies to every album. Someone who wants
to read one album oldest first almost certainly wants the next one that way too. It
does not reach the item pages: their `prev` and `next` are baked into static HTML
and follow the album's default order.

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
