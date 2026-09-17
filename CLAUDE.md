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
build.js                 renders data/*.json into index.html (see below)
data/events.json         upcoming community events
data/reports.json        published impact reports
assets/                  logos + impact report PDFs
```

## Editing content

**Do not hand-write event or impact-report cards into `index.html`.** Those
sections are generated. The workflow is:

1. Edit `data/events.json` or `data/reports.json`.
2. Run `node build.js`.
3. Commit both the JSON and the regenerated `index.html`.

`build.js` writes into the regions marked by `<!-- BUILD:events start/end -->`
and `<!-- BUILD:reports start/end -->`. Everything outside those markers is
hand-maintained — edit it directly.

Why generate rather than render client-side: the committed HTML stays real,
crawlable markup, and the site keeps working with JS disabled. The "build" is
a local convenience, not a deploy dependency.

`node build.js --check` exits non-zero if `index.html` is stale.

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
and `pdf`. `build.js` fails the build if a referenced PDF is missing.

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

## Don'ts

- Don't add a framework, build step, or package manager.
- Don't inline event/report data back into `index.html`.
- Don't commit `.DS_Store` (it's gitignored; it used to be tracked).
- Don't edit `index.html` between the BUILD markers — it will be overwritten.

## Contact address

The website always uses **`ben@coolslashscary.ai`** — that is the canonical
address for anything on the site. Impact report PDFs may use either that or
`ben@stratovation.digital` depending on the audience; don't "fix" a report to
match the site.
