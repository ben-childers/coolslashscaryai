#!/usr/bin/env node
/**
 * build.js — renders data/*.json into index.html.
 *
 * Why this exists: events, impact reports and the artwork gallery used to be
 * hand-written HTML cards. Now they live in data/*.json and this script writes
 * them into the marked regions of the pages. The committed HTML stays real,
 * crawlable markup — Netlify publishes the repo root with no build command.
 *
 *   data/events.json   -> index.html               BUILD:events
 *   data/reports.json  -> index.html               BUILD:reports
 *   data/artwork.json  -> artist-in-residence.html BUILD:artwork
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

function formatWhen(startISO, endISO) {
  const start = new Date(startISO);
  const date = start.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ,
  });
  const time = (d) =>
    new Date(d).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
    });
  if (!endISO) return `${date} · ${time(startISO)}`;
  return `${date} · ${time(startISO)} – ${time(endISO)}`;
}

function isPast(e, now = new Date()) {
  return new Date(e.end || e.start) < now;
}

function renderEvents(events) {
  const upcoming = events
    .filter((e) => !isPast(e))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  if (!upcoming.length) {
    return '            <p class="quiet">No events on the calendar right now — ' +
           '<a class="text-link" href="#host">host one</a>.</p>';
  }
  return upcoming
    .map((e) => {
      const accent = e.accent ? ` event-source--${esc(e.accent)}` : '';
      return `            <article class="event-card">
              <span class="event-source${accent}">${esc(e.source)}</span>
              <h3>${esc(e.title)}</h3>
              <p class="event-meta">${esc(formatWhen(e.start, e.end))}</p>
              <p class="event-location">${esc(e.location)}</p>
              <a href="${esc(e.registerUrl)}" target="_blank" rel="noopener" class="button event-button">${esc(e.cta || 'Register')}</a>
            </article>`;
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
              <p class="card-meta">${esc(r.location)} · ${esc(r.year)}</p>
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
  built.index = html;
  built.artist = replaceRegion(originals.artist, 'artwork', renderArtwork(artwork));

  // Past events stay in events.json as a record but stop rendering. Any past
  // event without a reportId is one we owe an impact report.
  const owed = events.filter((e) => isPast(e) && !e.reportId);
  if (owed.length) {
    console.warn(`\n  --  ${owed.length} past event(s) awaiting an impact report:`);
    owed.forEach((e) =>
      console.warn(`      - ${e.title} (${e.location}) on ${formatWhen(e.start, e.end)}`)
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
