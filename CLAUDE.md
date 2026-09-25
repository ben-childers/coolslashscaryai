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

### Adding an event

```json
{
  "id": "city-venue-YYYY-MM-DD",
  "source": "DC Public Library",
  "accent": "library-green",
  "title": "Event title",
  "start": "2026-03-25T17:00:00-04:00",
  "end": "2026-03-25T19:00:00-04:00",
  "location": "Venue, City, ST",
  "registerUrl": "https://...",
  "cta": "Register"
}
```

`accent` maps to a CSS modifier `event-source--{accent}`; a new value needs a
matching rule in `styles.css`. Times are ISO 8601 with offset; display
formatting is America/New_York.

### Adding an impact report

Put the PDF in `assets/`, then add an entry to `data/reports.json` with
`location`, `year`, `title`, `summary`, `tags` (5 is the established count),
`pdf`, and `pages`.

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

- Vanilla JS only, inline at the bottom of the page. No dependencies.
- Keep `styles.css` as the single stylesheet.
- Explicit `width`/`height` on `<img>` to avoid layout shift.
- External links: `target="_blank" rel="noopener"`.
- Mobile-first; the nav collapses to a hamburger under the breakpoint. Test
  mobile after any header or grid change — it has regressed before.
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
