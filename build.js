#!/usr/bin/env node
/**
 * build.js — renders data/*.json into index.html.
 *
 * Why this exists: events and impact reports used to be hand-written HTML cards.
 * Now they live in data/events.json and data/reports.json, and this script writes
 * them into the marked regions of index.html. The committed HTML stays real,
 * crawlable markup — Netlify publishes the repo root with no build command.
 *
 * Usage:  node build.js          (rewrites index.html in place)
 *         node build.js --check  (exits 1 if index.html is stale — for CI)
 *
 * No dependencies. Node 18+.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TZ = 'America/New_York';
const INDEX = path.join(ROOT, 'index.html');

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

function renderEvents(events) {
  const upcoming = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
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

  const missing = reports.filter((r) => !fs.existsSync(path.join(ROOT, r.pdf)));
  if (missing.length) {
    console.error('ERROR: missing PDFs -> ' + missing.map((r) => r.pdf).join(', '));
    process.exit(1);
  }

  const original = fs.readFileSync(INDEX, 'utf8');
  let html = replaceRegion(original, 'events', renderEvents(events));
  html = replaceRegion(html, 'reports', renderReports(reports));

  const stale = events.filter((e) => new Date(e.end || e.start) < new Date());
  if (stale.length) {
    console.warn(
      `\n  !!  ${stale.length} event(s) already happened and are still listed publicly:`
    );
    stale.forEach((e) =>
      console.warn(`      - ${e.title} (${e.location}) on ${formatWhen(e.start, e.end)}`)
    );
    console.warn('      Remove them from data/events.json or move them to an archive.\n');
  }

  if (check) {
    if (html !== original) {
      console.error('index.html is out of date. Run: node build.js');
      process.exit(1);
    }
    console.log('index.html is up to date.');
    return;
  }

  fs.writeFileSync(INDEX, html);
  console.log(
    `Built index.html — ${events.length} event(s), ${reports.length} impact report(s).`
  );
}

main();
