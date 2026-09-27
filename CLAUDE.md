# Cool Slash Scary AI — website

Marketing and events site for Cool/Scary AI, a decentralized event platform
where mission-driven communities examine AI's impact. Run by Ben Childers,
powered by Stratovation Partners.

Live: https://coolslashscary.ai · Repo: ben-childers/coolslashscaryai

## Architecture — read this before changing anything

**This is a plain static site. There is no framework, no npm install, no
bundler, and no deploy-time build.** Netlify publishes the repo root as-is
(`netlify.toml` → `publish = "."`, no build command). Pushing to `main`
deploys.

```
index.html               home — hero, events, impact reports, about, mission, host, contact
bingo.html               2026 BINGO card
artist-in-residence.html artist residency page
styles.css               the entire stylesheet (CSS custom properties, no preprocessor)
build.js                 renders data/*.json into the pages (see below)
data/events.json         upcoming community events
data/reports.json        published impact reports
data/artwork.json        artist-in-residence gallery, grouped by city
tools/images.sh          regenerates assets/gallery/ from the artwork originals
assets/                  logos, impact report PDFs, artwork originals
assets/gallery/          generated WebP derivatives — do not hand-edit
```

## Editing content

**Do not hand-write event, impact-report or artwork cards into the HTML.**
Those sections are generated. The workflow is:

1. Edit the JSON in `data/`.
2. Run `node build.js`.
3. Commit both the JSON and the regenerated HTML.

`build.js` writes into marked regions:

| Data file            | Page                       | Region          |
| -------------------- | -------------------------- | --------------- |
| `data/events.json`   | `index.html`               | `BUILD:events`  |
| `data/reports.json`  | `index.html`               | `BUILD:reports` |
| `data/artwork.json`  | `artist-in-residence.html` | `BUILD:artwork` |

Everything outside those markers is hand-maintained — edit it directly.

Why generate rather than render client-side: the committed HTML stays real,
crawlable markup, and the site keeps working with JS disabled. The "build" is
a local convenience, not a deploy dependency.

`node build.js --check` exits non-zero if any generated page is stale.

### Past events and the impact-report pipeline

Events are **filtered by date automatically** — once an event's `end` time has
passed it stops rendering, so the live site can't show a stale event. Past
events stay in `data/events.json` as a record rather than being deleted.

Each past event should end up with a `reportId` pointing at its entry in
`data/reports.json`. `build.js` warns about any past event that doesn't have
one yet — that warning is the to-do list of impact reports owed. Clear it by
adding the report and setting `reportId` on the event.

### The two series

Events and impact reports both carry a **`series`**:

- **`field-day`** — *Field Days*. We host. A full day, one city. This is the
  flagship format.
- **`community`** — *Community Events*. A partner hosts, on their own ground
  and at their own scale — a library branch, an office, a neighbourhood.
- **`neighborhood-edition`** — *Neighborhood Editions*, on reports only. The
  DC Public Library run, which was a series of its own.

`series` is explicit in the data, never inferred from `source` — a Field Day
can be co-branded with a venue without ceasing to be ours. `build.js` renders
one `.series-block` per series into `BUILD:events`, each with its own heading,
blurb and empty state, and puts the singular label on report cards
("Field Day · Baltimore, Maryland · 2025").

A card shows its `source` badge only when the host is someone other than
Cool/Scary AI — under a "Field Days" heading a "Cool/Scary AI" badge on every
card is noise.

**The back catalogue keeps its original names.** Baltimore is still
"Cool AI Sh*t — Baltimore Summit 2025" on its card and its PDF cover, because
that is what it was called, what speakers list, and what is already in
circulation. The *series* name is new; the events are not renamed. Don't
"tidy" the old titles — the Field Days heading does that work.

### The next Field Day gets two treatments

The soonest upcoming `field-day` event is rendered twice, from the same data:

- **The masthead band** (`BUILD:band`, between `</header>` and `<main>`) — a
  gold full-bleed band every visitor meets before scrolling.
- **The cover slab** (inside `BUILD:events`) — a navy block with the gold
  square, echoing the impact report covers. It is the headline of the Field
  Days section; any *other* upcoming Field Days render as ordinary cards
  beneath it.

Neither needs a flag in the data — `nextFieldDay()` picks whichever is
soonest, so nothing has to be remembered when an event is added or passes.
With no upcoming Field Day, the band renders as nothing and the Field Days
block falls back to its empty state.

The two are deliberately independent: delete either the band region or the
slab branch and the other still works. Showing the same event twice above the
fold is a decision, not an accident — if it ever reads as nagging, drop one.

### Adding an event

```json
{
  "id": "city-venue-YYYY-MM-DD",
  "series": "community",
  "source": "DC Public Library",
  "accent": "library-green",
  "title": "Event title",
  "city": "Washington, DC",
  "start": "2026-03-25T17:00:00-04:00",
  "end": "2026-03-25T19:00:00-04:00",
  "venue": "Woodridge Neighborhood Library",
  "address": "1801 Hamlin St. NE, Washington, DC",
  "registerUrl": "https://...",
  "cta": "Register"
}
```

`venue` and `address` render as separate lines; `address` is optional and is
simply left out when we don't have a street. `registerUrl` may be `null` for
a past event that never had one — the button is then omitted rather than
rendered as a dead link.

`accent` maps to a CSS modifier `event-source--{accent}`; a new value needs a
matching rule in `styles.css`. It only shows when a badge does. Times are ISO 8601 with offset; display
formatting is America/New_York.

### Adding an impact report

Put the PDF in `assets/`, then add an entry to `data/reports.json` with
`series`, `location`, `year`, `title`, `summary`, `tags` (5 is the established
count), `pdf`, and `pages`.

`build.js` fails the build if a referenced PDF is missing, or if its actual
page count doesn't match `pages`. That second check exists because a report
canvas exports one artboard by default — a Denver report shipped as a single
cover page that way and the existence check happily let it through. Flagship
reports are 8 pages, neighborhood editions 6. Export with **"All artboards
(.pdf)"**.

### Adding artwork

Reports and artwork share the pattern; artwork adds an image step.

1. Drop the full-resolution originals in `assets/` (whatever Kam names them).
2. Add or extend a collection in `data/artwork.json`. Each piece needs
   `slug` (the derivative filename), `caption`, `alt`, `w`/`h` of the **grid
   tile**, and `source` (path to the original).
3. Run `bash tools/images.sh` — writes a 1100px tile and a 2000px lightbox
   version per piece into `assets/gallery/`.
4. Run `node build.js`.

Collections render newest-first, so a new city goes at the top of the array.
Each residency ships four crops of one illustration — banner, square, a detail,
and a mostly-empty "title field" used behind slide headlines. The title field
looks blank as a gallery tile; that's the artwork, not a broken image.

The originals stay in `assets/` as the archive and nothing on the site links
to them: the page serves only the generated WebP, which took the gallery from
~47 MB to ~3 MB. Never point an `<img>` at an original PNG.

## Voice

Thoughtful, grounded, invitational. Curious and warm, never breathless. The
site's own line is the standard: "No hype. No panic. Just community learning
and action." Avoid AI-industry boosterism and avoid doom. Name tensions
honestly rather than resolving them prematurely.

Event titles in the wild are irreverent ("Cool AI Sh*t", "Cool/Scary AI Sh!t")
— keep that as-is; it's the brand, not a typo.

## Forms

The host-interest and newsletter forms are Netlify Forms (the bare `netlify`
attribute on the `<form>` tag). Submissions land in the Netlify dashboard.
Don't wire them to a third-party endpoint without Ben deciding where
submissions should go.

## Conventions

- **Card information: one fact per line.** Date, time, venue, street, series,
  city, year — each gets its own row in a `<ul class="fact-lines">`. Never
  join them with middots or commas. Stacked facts are scannable and they wrap
  cleanly at phone width; a run-on line of separators does neither. This is
  why `data/events.json` carries `city`, `venue` and `address` as separate
  fields rather than one `location` string — the data has to be split before
  the presentation can be.
- Corner accents on cards run one nine-step cycle, shared by impact report
  cards and event cards through a single `:is(.card, .event-card)` rule:

  ```
  green  teal   gold
  gold   green  teal
  teal   gold   green
  ```

  It's a Latin square, so every column of the three-column grid gets all
  three colors and no color sits next to or above itself. Don't give the two
  grids separate rules again — they had separate ones, drifted, and the
  fourth report onward ended up with no corner at all.
- Vanilla JS only, inline at the bottom of the page. No dependencies.
- Keep `styles.css` as the single stylesheet.
- Explicit `width`/`height` on `<img>` to avoid layout shift.
- External links: `target="_blank" rel="noopener"`.
- **Two breakpoints, and only two.** `900px` is tablet (multi-column grids
  collapse, the event grid goes 3 → 2); `720px` is phone (nav becomes a
  hamburger, everything goes single column). Don't add a third. Anything
  needing to narrow between them should do it intrinsically — `clamp()`,
  `flex-wrap`, `grid auto-fit` — which adapts continuously rather than
  jumping at a number someone picked once. The masthead band is the worked
  example: given its own 780px breakpoint it rendered *taller* than when
  left to flex-wrap on its own.
- Test mobile after any header or grid change — it has regressed before.
- Anything clickable is a real `<button>` or `<a>`, never a `div` with a click
  handler. The gallery tiles used to be divs and were unreachable by keyboard.
- Images below the fold get `loading="lazy"`.

## Don'ts

- Don't add a framework, build step, or package manager.
- Don't inline event/report/artwork data back into the HTML.
- Don't hand-edit `assets/gallery/` — it's generated by `tools/images.sh`.
- Don't commit `.DS_Store` (it's gitignored; it used to be tracked).
- Don't edit anything between the BUILD markers — it will be overwritten.

## Contact address

The website always uses **`ben@coolslashscary.ai`** — that is the canonical
address for anything on the site. Impact report PDFs may use either that or
`ben@stratovation.digital` depending on the audience; don't "fix" a report to
match the site.
