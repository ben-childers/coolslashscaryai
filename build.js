#!/usr/bin/env node
/**
 * build.js — renders data/*.json into index.html.
 *
 * Why this exists: events, impact reports and the artwork gallery used to be
 * hand-written HTML cards. Now they live in data/*.json and this script writes
 * them into the marked regions of the pages. The committed HTML stays real,
 * crawlable markup — Netlify publishes the repo root with no build command.
 *
 *   data/events.json   -> index.html               BUILD:band, BUILD:events
 *   data/reports.json  -> index.html               BUILD:reports
 *   data/artwork.json  -> artist-in-residence.html BUILD:artwork
 *
 * Events and reports both carry a "series". Field Days are the ones we host;
 * Community Events are hosted by partners on their own ground. The series is
 * an explicit field, not inferred from "source" — a Field Day can be
 * co-branded with a venue without stopping being ours.
 *
 * Usage:  node build.js          (rewrites the pages in place)
 *         node build.js --check  (exits 1 if any page is stale — for CI)
 *
 * No dependencies. Node 18+.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TZ = 'America/New_York';
const PAGES = {
  index: path.join(ROOT, 'index.html'),
  artist: path.join(ROOT, 'artist-in-residence.html'),
};

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

function formatDate(startISO) {
  return new Date(startISO).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ,
  });
}

function formatTime(startISO, endISO) {
  const t = (d) =>
    new Date(d).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
    });
  return endISO ? `${t(startISO)} – ${t(endISO)}` : t(startISO);
}

function isPast(e, now = new Date()) {
  return new Date(e.end || e.start) < now;
}

const SERIES = {
  'field-day': {
    label: 'Field Days',
    blurb: 'A full day, one city, the whole community in a room. We host these.',
    empty: 'The next Field Day will be announced soon.',
  },
  community: {
    label: 'Community Events',
    blurb: 'Hosted by partners on their own ground, at their own scale — libraries, offices, neighborhoods.',
    empty: 'Nothing on the community calendar right now — <a class="text-link" href="#host">host one</a>.',
  },
};

// Card labels for a single instance of a series, used on report cards.
const SERIES_ONE = {
  'field-day': 'Field Day',
  'neighborhood-edition': 'Neighborhood Edition',
  community: 'Community Event',
};

// The soonest upcoming Field Day. It is the one that gets the masthead band
// and the slab; any others fall back to ordinary cards. Nothing to flag in the
// data — being next is what makes an event the headline.
function nextFieldDay(events, now = new Date()) {
  return (
    events
      .filter((e) => e.series === 'field-day' && !isPast(e, now))
      .sort((a, b) => new Date(a.start) - new Date(b.start))[0] || null
  );
}

// One fact per line. `parts` is [className, value]; empty values drop out.
function factLines(parts, indent) {
  const pad = ' '.repeat(indent);
  return parts
    .filter(([, v]) => v)
    .map(([cls, v]) => `${pad}<li${cls ? ` class="${cls}"` : ''}>${esc(v)}</li>`)
    .join('\n');
}

function renderBand(e) {
  if (!e) return '';
  const lines = factLines(
    [
      ['band-date', formatDate(e.start)],
      ['band-venue', e.venue],
      ['band-address', e.address],
    ],
    12
  );
  const cta = e.registerUrl
    ? `\n          <a class="band-cta" href="${esc(e.registerUrl)}" target="_blank" rel="noopener">${esc(e.cta || 'Register')}</a>`
    : '';
  return `    <aside class="band" aria-label="Next Field Day">
      <div class="container">
        <div class="band-main">
          <span class="band-eyebrow">Next Field Day</span>
          <span class="band-city">${esc(e.city)}</span>
          <ul class="fact-lines band-facts">
${lines}
          </ul>
        </div>${cta}
      </div>
    </aside>`;
}

function renderSlab(e) {
  const lines = factLines(
    [
      ['slab-date', formatDate(e.start)],
      ['slab-time', formatTime(e.start, e.end)],
      ['slab-venue', e.venue],
      ['slab-address', e.address],
    ],
    16
  );
  const cta = e.registerUrl
    ? `\n              <a class="slab-cta" href="${esc(e.registerUrl)}" target="_blank" rel="noopener">${esc(e.cta || 'Register')}</a>`
    : '';
  return `            <article class="slab">
              <span class="slab-eyebrow">Next Field Day</span>
              <h3 class="slab-city">${esc(e.city)}</h3>
              <ul class="fact-lines slab-facts">
${lines}
              </ul>${cta}
            </article>`;
}

function renderEventCard(e) {
  const accent = e.accent ? ` event-source--${esc(e.accent)}` : '';
  // Under a "Field Days" heading, a "Cool/Scary AI" badge on every card is
  // noise. Show the badge only when someone else is named as the host.
  const badge =
    e.source && e.source !== 'Cool/Scary AI'
      ? `\n                <span class="event-source${accent}">${esc(e.source)}</span>`
      : '';
  // One fact per line — date, time, venue, street each get their own row.
  // Never join them with separators; see "Card information" in CLAUDE.md.
  const lines = [
    ['event-date', formatDate(e.start)],
    ['event-time', formatTime(e.start, e.end)],
    ['event-venue', e.venue],
    ['event-address', e.address],
  ]
    .filter(([, v]) => v)
    .map(([cls, v]) => `                  <li class="${cls}">${esc(v)}</li>`)
    .join('\n');
  const cta = e.registerUrl
    ? `\n                <a href="${esc(e.registerUrl)}" target="_blank" rel="noopener" class="button event-button">${esc(e.cta || 'Register')}</a>`
    : '';
  return `              <article class="event-card">${badge}
                <h3>${esc(e.title)}</h3>
                <ul class="fact-lines">
${lines}
                </ul>${cta}
              </article>`;
}

function renderEvents(events) {
  const upcoming = events
    .filter((e) => !isPast(e))
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  return Object.entries(SERIES)
    .map(([key, s]) => {
      let mine = upcoming.filter((e) => e.series === key);
      let lead = '';
      if (key === 'field-day' && mine.length) {
        // The next Field Day is the headline, not a card in a row of three.
        lead = renderSlab(mine[0]) + '\n';
        mine = mine.slice(1);
      }
      const grid = mine.length
        ? `            <div class="event-card-grid">\n${mine.map(renderEventCard).join('\n')}\n            </div>`
        : '';
      const body =
        lead || grid
          ? (lead + grid).replace(/\n$/, '')
          : `            <p class="series-empty">${s.empty}</p>`;
      return `          <section class="series-block" aria-labelledby="series-${key}">
            <h3 class="series-title" id="series-${key}">${esc(s.label)}</h3>
            <p class="series-blurb">${esc(s.blurb)}</p>
${body}
          </section>`;
    })
    .join('\n');
}

function renderReports(reports) {
  return reports
    .map((r) => {
      const tags = r.tags
        .map((t) => `                <li>${esc(t)}</li>`)
        .join('\n');
      return `            <article class="card">
              <ul class="fact-lines card-meta">
                <li>${esc(SERIES_ONE[r.series] || 'Event')}</li>
                <li>${esc(r.location)}</li>
                <li>${esc(r.year)}</li>
              </ul>
              <h3>${esc(r.title)}</h3>
              <p>${esc(r.summary)}</p>
              <ul class="tag-list">
${tags}
              </ul>
              <a class="text-link" href="${esc(r.pdf)}" target="_blank">Download impact summary (PDF)</a>
            </article>`;
    })
    .join('\n');
}

/**
 * How many pages a PDF declares. Reads /Count off the page tree — enough to
 * catch the real failure mode here, which is exporting one artboard from a
 * report canvas instead of all of them and shipping a one-page "report".
 */
function pdfPageCount(file) {
  const raw = fs.readFileSync(file).toString('latin1');
  const counts = [...raw.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : null;
}

function renderArtwork(collections) {
  return collections
    .map((c) => {
      const id = c.collection.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const tiles = c.pieces
        .map(
          (p) => `              <li class="gallery-item">
                <button type="button" class="gallery-open" data-full="assets/gallery/${esc(p.slug)}-full.webp" data-alt="${esc(p.alt)}">
                  <img src="assets/gallery/${esc(p.slug)}.webp" alt="${esc(p.alt)}" width="${p.w}" height="${p.h}" loading="lazy" decoding="async" />
                  <span class="gallery-caption">${esc(p.caption)}</span>
                </button>
              </li>`
        )
        .join('\n');
      return `          <section class="collection" aria-labelledby="${esc(id)}">
            <h2 class="collection-title" id="${esc(id)}">${esc(c.collection)}</h2>
            <p class="collection-blurb">${esc(c.blurb)}</p>
            <ul class="gallery-grid">
${tiles}
            </ul>
          </section>`;
    })
    .join('\n');
}

function replaceRegion(html, name, body) {
  const re = new RegExp(
    `([ \\t]*<!-- BUILD:${name} start -->\\n)[\\s\\S]*?([ \\t]*<!-- BUILD:${name} end -->)`
  );
  if (!re.test(html)) {
    throw new Error(`index.html is missing the BUILD:${name} markers.`);
  }
  return html.replace(re, `$1${body}\n$2`);
}

function main() {
  const check = process.argv.includes('--check');
  const events = read('data/events.json');
  const reports = read('data/reports.json');
  const artwork = read('data/artwork.json');

  const missing = reports.filter((r) => !fs.existsSync(path.join(ROOT, r.pdf)));
  if (missing.length) {
    console.error('ERROR: missing PDFs -> ' + missing.map((r) => r.pdf).join(', '));
    process.exit(1);
  }

  // A report whose PDF has the wrong number of pages is a bad export, not a
  // broken link — it would sail past the existence check above and go live.
  const truncated = reports
    .filter((r) => r.pages)
    .map((r) => ({ r, got: pdfPageCount(path.join(ROOT, r.pdf)) }))
    .filter(({ r, got }) => got !== null && got !== r.pages);
  if (truncated.length) {
    console.error('ERROR: PDF page count does not match data/reports.json:');
    truncated.forEach(({ r, got }) =>
      console.error(`       ${r.pdf} — expected ${r.pages} pages, found ${got}`)
    );
    console.error('       Re-export from the report canvas with "All artboards (.pdf)".');
    process.exit(1);
  }

  // Every gallery piece needs both derivatives. Regenerate with tools/images.sh.
  const noImage = [];
  artwork.forEach((c) =>
    c.pieces.forEach((p) => {
      [`assets/gallery/${p.slug}.webp`, `assets/gallery/${p.slug}-full.webp`].forEach((f) => {
        if (!fs.existsSync(path.join(ROOT, f))) noImage.push(f);
      });
    })
  );
  if (noImage.length) {
    console.error('ERROR: missing gallery images -> ' + noImage.join(', '));
    console.error('       Run: bash tools/images.sh');
    process.exit(1);
  }

  const originals = {};
  const built = {};
  for (const [key, file] of Object.entries(PAGES)) {
    originals[key] = fs.readFileSync(file, 'utf8');
  }

  let html = replaceRegion(originals.index, 'events', renderEvents(events));
  html = replaceRegion(html, 'reports', renderReports(reports));
  html = replaceRegion(html, 'band', renderBand(nextFieldDay(events)));
  built.index = html;
  built.artist = replaceRegion(originals.artist, 'artwork', renderArtwork(artwork));

  // Past events stay in events.json as a record but stop rendering. Any past
  // event without a reportId is one we owe an impact report.
  const owed = events.filter((e) => isPast(e) && !e.reportId);
  if (owed.length) {
    console.warn(`\n  --  ${owed.length} past event(s) awaiting an impact report:`);
    owed.forEach((e) =>
      console.warn(`      - ${e.title} (${e.city}) on ${formatDate(e.start)}`)
    );
    console.warn(
      '      Add the report to data/reports.json, then set "reportId" on the event.\n'
    );
  }

  const stale = Object.keys(PAGES).filter((k) => built[k] !== originals[k]);

  if (check) {
    if (stale.length) {
      console.error(
        `Out of date: ${stale.map((k) => path.basename(PAGES[k])).join(', ')}. Run: node build.js`
      );
      process.exit(1);
    }
    console.log('All pages are up to date.');
    return;
  }

  for (const key of stale) fs.writeFileSync(PAGES[key], built[key]);

  const shown = events.filter((e) => !isPast(e)).length;
  const pieces = artwork.reduce((n, c) => n + c.pieces.length, 0);
  console.log(
    `Built — ${shown} upcoming event(s) of ${events.length} on file, ` +
      `${reports.length} impact report(s), ` +
      `${pieces} artwork piece(s) in ${artwork.length} collection(s).`
  );
}

main();
