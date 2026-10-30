/* Bump VERSION when changing application files, libraries, templates, or icons.
   Spreadsheet uploads need no version change: SYNC checks them independently. */
const VERSION = '2026-10-30.1';
const PREFIX = 'cwags-beta-' + new URL(self.registration.scope).pathname.replace(/[^a-z0-9]/gi, '-') + '-';
const SHELL = PREFIX + 'app-' + VERSION;
const META = PREFIX + 'metadata';
const ROOT = self.registration.scope;
const url = path => new URL(path, ROOT).href;
const CURRENT = url('_offline/current');
const DATA = ['DogInfo.xlsx', 'Data for Tracker web.xlsx', 'Title Placement.xlsx'];
const STATIC = ['index.html', 'pwa.js', 'pwa.css', 'registration-pdf.js', 'manifest.webmanifest',
  'icons/icon-192-v5.png', 'icons/icon-512-v5.png', 'icons/apple-touch-icon-v5.png', 'cwags-logo.png',
  'vendor/xlsx-0.20.3.full.min.js', 'vendor/pdf-lib.min.js', 'vendor/fontkit.umd.min.js',
  'fonts/Maiandra GD.TTF', 'templates/Scent.pdf', 'templates/Obedience.pdf',
  'templates/Rally.pdf', 'templates/Games.pdf', 'templates/Ace.pdf'];
const STATIC_URLS = new Set(STATIC.map(url));
importScripts('./vendor/xlsx-0.20.3.full.min.js');

async function download(path, previous) {
  const headers = {};
  if (previous?.etag) headers['If-None-Match'] = previous.etag;
  else if (previous?.lastModified) headers['If-Modified-Since'] = previous.lastModified;
  const response = await fetch(url(path), {cache:'no-cache', headers, signal:AbortSignal.timeout(90000)});
  if (response.status === 304 && previous) return null;
  if (!response.ok) throw new Error(path + ': HTTP ' + response.status);
  return response;
}
async function current() {
  const response = await (await caches.open(META)).match(CURRENT);
  return response ? response.json() : null;
}
async function status() {
  const state = await current();
  const shell = await caches.open(SHELL);
  const assets = await Promise.all(STATIC.map(path => shell.match(url(path))));
  const dataCache = state ? await caches.open(state.cache) : null;
  const data = dataCache ? await Promise.all(DATA.map(path => dataCache.match(url(path)))) : [];
  return {...state, ready:assets.every(Boolean) && data.length === DATA.length && data.every(Boolean), version:VERSION};
}
async function validate(path, buffer) {
  if (new Uint8Array(buffer)[0] !== 0x50 || new Uint8Array(buffer)[1] !== 0x4b) throw new Error(path + ' is not an XLSX file');
  const workbook = XLSX.read(buffer, {type:'array'});
  const sheet = workbook.Sheets[path === DATA[1] && workbook.Sheets.Data ? 'Data' : workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {header:1});
  const registration = value => /^(?:\d{2}-\d{4}-\d{2}|\d{8})$/.test(String(value || '').trim());
  const valid = path === DATA[0] ? rows.some(row => registration(row[0]) && row[1] && row[3])
    : path === DATA[1] ? rows.slice(1).some(row => registration(row[0]) && row[3])
    : rows.slice(1).some(row => row[1] && row[2] && row[3]);
  if (!valid) throw new Error(path + ' does not contain the expected tracker columns');
}
async function syncData() {
  const old = await current();
  const oldCache = old ? await caches.open(old.cache) : null;
  const files = {};
  const staged = [];
  let changed = !old;
  // Download/validate all files before changing the single active-snapshot pointer.
  for (const path of DATA) {
    const previous = old?.files?.[path];
    const cached = oldCache ? await oldCache.match(url(path)) : null;
    let response = await download(path, cached ? previous : null);
    if (!response) response = cached;
    const buffer = await response.clone().arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), n=>n.toString(16).padStart(2,'0')).join('');
    if (hash !== previous?.hash) { await validate(path, buffer); changed = true; }
    files[path] = {hash, bytes:buffer.byteLength, etag:response.headers.get('etag'), lastModified:response.headers.get('last-modified')};
    staged.push([path, response]);
  }
  const now = new Date().toISOString();
  const name = changed ? PREFIX + 'data-' + Date.now() + '-' + Math.random().toString(36).slice(2) : old.cache;
  if (changed) {
    const target = await caches.open(name);
    try { for (const [path, response] of staged) await target.put(url(path), response.clone()); }
    catch(error) { await caches.delete(name); throw error; }
  }
  const state = {cache:name, savedAt:changed ? now : old.savedAt, checkedAt:now, files};
  await (await caches.open(META)).put(CURRENT, new Response(JSON.stringify(state), {headers:{'Content-Type':'application/json'}}));
  // Keep the preceding snapshot as a fallback; do not accumulate every upload.
  for (const key of await caches.keys()) if (key.startsWith(PREFIX+'data-') && key !== name && key !== old?.cache) await caches.delete(key);
  return {...await status(), changed};
}
let syncing;
self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache = await caches.open(SHELL);
  await Promise.all(STATIC.map(async path => { const response=await download(path); await cache.put(url(path),response); }));
  if (!self.registration.active) await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  await self.clients.claim();
  for (const name of await caches.keys()) if (name.startsWith(PREFIX+'app-') && name !== SHELL) await caches.delete(name);
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  const port = event.ports[0];
  if (!port) return;
  event.waitUntil((async()=>{
    try {
      if (event.data.type === 'SYNC') {
        if (!syncing) syncing=syncData().finally(()=>{syncing=null;});
        port.postMessage({ok:true, state:await syncing});
      } else port.postMessage({ok:true,state:await status()});
    } catch(error) { port.postMessage({ok:false,error:error.message,state:await status()}); }
  })());
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if (request.method !== 'GET') return;
  const parsed=new URL(request.url);
  const path=decodeURIComponent(parsed.pathname.slice(new URL(ROOT).pathname.length));
  if (parsed.origin === new URL(ROOT).origin && DATA.includes(path)) {
    event.respondWith((async()=>{
      const state=await current();
      const cached=state ? await (await caches.open(state.cache)).match(url(path)) : null;
      return cached || fetch(request);
    })());return;
  }
  if (request.mode === 'navigate' && (parsed.href === ROOT || parsed.pathname === new URL(url('index.html')).pathname)) {
    event.respondWith((async()=> (await (await caches.open(SHELL)).match(url('index.html'))) || fetch(request))());return;
  }
  if (STATIC_URLS.has(request.url)) event.respondWith((async()=> (await (await caches.open(SHELL)).match(request.url)) || fetch(request))());
});
