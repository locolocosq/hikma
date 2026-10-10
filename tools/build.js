// Erzeugt data/fragen.js aus daten.js + fragen-hand.js
// Aufruf: node tools/build.js
const fs = require('fs');
const path = require('path');
const D = require('./daten');
const HAND = require('./fragen-hand') + require('./fragen-hand2');

// ---------- Zufall mit festem Startwert (gleiche Ausgabe bei jedem Build) ----------
let seed = 20261010;
function rnd() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sample(arr, n, exclude = []) {
  const pool = shuffle(arr.filter((x) => !exclude.includes(x)));
  return pool.slice(0, n);
}

// Ablenker mit ähnlicher Länge wählen, damit die Länge nichts verrät
function aehnlich(pool, richtig, n, txt = (x) => x) {
  const L = txt(richtig).length;
  const kand = shuffle(pool.filter((x) => txt(x) !== txt(richtig)))
    .map((x) => ({ x, d: Math.abs(txt(x).length - L) / Math.max(L, 4) + rnd() * 0.25 }))
    .sort((a, b) => a.d - b.d);
  const out = [];
  for (const { x } of kand) { if (!out.some((y) => txt(y) === txt(x))) out.push(x); if (out.length === n) break; }
  return out;
}

// Verrät die Form (Länge, Schrift) die richtige Antwort?
const arabisch = /[؀-ۿ]/;
function auffaellig([r, ...w]) {
  if ([r, ...w].every((x) => /^[\d.,\s%n.H-]+$/.test(x))) return false; // Zahlen sind unproblematisch
  const L = (x) => x.length;
  const maxW = Math.max(...w.map(L)), minW = Math.min(...w.map(L));
  return (L(r) > maxW * 1.6 && L(r) - maxW > 6) || (L(r) < minW * 0.55 && minW - L(r) > 6) ||
    (L(r) < minW * 0.6 && L(r) <= 4) || arabisch.test(r) !== arabisch.test(w[0]);
}

let hand = true;
const fragen = [];
const gesehen = new Set();
function add(k, q, richtig, falsch, score) {
  richtig = String(richtig); falsch = falsch.map(String);
  const opts = [richtig, ...falsch];
  if (falsch.length !== 3 || new Set(opts).size !== 4) throw new Error('Ungültige Optionen: ' + q + ' -> ' + opts.join(' / '));
  if (!hand && auffaellig(opts)) return false;
  const key = q + '§' + [...opts].sort().join('|');
  if (gesehen.has(key)) return false;
  gesehen.add(key);
  fragen.push({ k, q, a: opts, s: score });
  return true;
}

// Zahlen-Ablenker in der Nähe der richtigen Zahl
function zahlenNah(n, min = 1, max = Infinity, spanne) {
  spanne = spanne || Math.max(3, Math.round(n * 0.18));
  const set = new Set();
  let tries = 0;
  while (set.size < 3 && tries++ < 500) {
    let d = Math.ceil(rnd() * spanne) * (rnd() < 0.5 ? -1 : 1);
    const v = n + d;
    if (v !== n && v >= min && v <= max) set.add(v);
  }
  return [...set];
}

// ---------- Handgeschriebene Fragen ----------
for (const zeile of HAND.split('\n')) {
  const t = zeile.trim();
  if (!/^[1-4]\|/.test(t)) continue;
  const [st, k, q, r, f1, f2, f3] = t.split('|');
  add(k, q, r, [f1, f2, f3], Number(st) + rnd() * 0.95);
}

hand = false;
// ---------- Suren ----------
const S = D.SUREN;
const byNr = (n) => S[n - 1];
const obs = (s) => (3 - s.bek) / 3; // 0 = sehr bekannt, 1 = unbekannt
let summe = S.reduce((a, s) => a + s.verse, 0);
if (summe !== 6236) throw new Error('Verssumme stimmt nicht: ' + summe);

function nachbarSuren(nr, n, ohne = []) {
  const kand = [];
  for (let d = 1; kand.length < 12 && d < 114; d++) {
    for (const x of [nr - d, nr + d]) if (x >= 1 && x <= 114 && x !== nr && !ohne.includes(x)) kand.push(x);
  }
  const richtig = byNr(nr).name;
  return aehnlich(kand.slice(0, 10).map((x) => byNr(x).name), richtig, n);
}

for (const s of S) {
  const o = obs(s);
  add('K', `Welche Nummer hat die Sure ${s.name} im Koran?`, s.nr, zahlenNah(s.nr, 1, 114, 6), 1.4 + 2.6 * o);
  add('K', `Welche Sure steht im Koran an Position ${s.nr}?`, s.name, nachbarSuren(s.nr, 3), 1.9 + 2.6 * o);
  add('K', `Wie viele Verse hat die Sure ${s.name}?`, s.verse, zahlenNah(s.verse, 3, 300), 2.0 + 2.6 * o);
  if (s.bed) {
    const andere = S.filter((x) => x.bed && x.nr !== s.nr);
    add('K', `Was bedeutet der Surenname „${s.name}“?`, s.bed, aehnlich(andere, s, 3, (x) => x.bed).map((x) => x.bed), 1.1 + 2.6 * o);
    add('K', `Welche Sure heißt übersetzt „${s.bed}“?`, s.name, aehnlich(andere, s, 3, (x) => x.name).map((x) => x.name), 1.3 + 2.6 * o);
  }
  // eindeutige Verszahl -> Rückfrage
  if (S.filter((x) => x.verse === s.verse).length === 1) {
    const nah = S.filter((x) => x.nr !== s.nr).sort((a, b) => Math.abs(a.verse - s.verse) - Math.abs(b.verse - s.verse)).slice(0, 6);
    add('K', `Welche Sure hat genau ${s.verse} Verse?`, s.name, sample(nah, 3).map((x) => x.name), 2.4 + 2.2 * o);
  }
  if (s.nr < 114) {
    const n = byNr(s.nr + 1);
    add('K', `Welche Sure folgt im Koran direkt auf ${s.name}?`, n.name, nachbarSuren(s.nr + 1, 3, [s.nr]), 2.2 + 1.3 * o + 1.3 * obs(n));
  }
  if (s.nr > 1) {
    const v = byNr(s.nr - 1);
    add('K', `Welche Sure steht im Koran direkt vor ${s.name}?`, v.name, nachbarSuren(s.nr - 1, 3, [s.nr]), 2.4 + 1.3 * o + 1.3 * obs(v));
  }
  if (s.nr > 1 && s.nr < 114) {
    const a = byNr(s.nr - 1), b = byNr(s.nr + 1);
    add('K', `Welche Sure steht zwischen ${a.name} und ${b.name}?`, s.name, nachbarSuren(s.nr, 3, [a.nr, b.nr]), 2.3 + 1.2 * o + 0.6 * (obs(a) + obs(b)));
  }
}

// Dschuz', in dem eine Sure beginnt
const DSCHUZ = [[1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6], [12, 53],
  [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]];
for (const s of S) {
  let j = 1;
  DSCHUZ.forEach(([sn, v], i) => { if (sn < s.nr || (sn === s.nr && v === 1)) j = i + 1; });
  add('K', `In welchem Dschuz' (Teil) beginnt die Sure ${s.name}?`, j, zahlenNah(j, 1, 30, 3), 2.9 + 1.5 * obs(s));
}

// Mekka / Medina
const mekk = S.filter((s) => s.ort === 'M'), med = S.filter((s) => s.ort === 'D');
for (let i = 0; i < 130; i++) {
  const r = pick(med), f = sample(mekk, 3);
  add('K', 'Welche dieser Suren wurde in Medina offenbart?', r.name, f.map((x) => x.name), 2.5 + 1.0 * obs(r) + 0.4 * f.reduce((a, x) => a + obs(x), 0) / 3);
}
for (let i = 0; i < 90; i++) {
  const r = pick(mekk), f = sample(med, 3);
  add('K', 'Welche dieser Suren wurde in Mekka offenbart?', r.name, f.map((x) => x.name), 2.6 + 1.0 * obs(r) + 0.4 * f.reduce((a, x) => a + obs(x), 0) / 3);
}

// Vergleiche
function vergleich(anzahl, frage, wert, richtungMax, basis) {
  let n = 0, tries = 0;
  while (n < anzahl && tries++ < anzahl * 20) {
    const vier = sample(S, 4);
    const werte = vier.map(wert);
    if (new Set(werte).size !== 4) continue;
    const sortiert = [...vier].sort((a, b) => richtungMax ? wert(b) - wert(a) : wert(a) - wert(b));
    const r = sortiert[0], z = sortiert[1];
    const naehe = 1 - Math.min(1, Math.abs(wert(r) - wert(z)) / Math.max(wert(r), wert(z)));
    const score = basis + 1.6 * naehe + 0.6 * vier.reduce((a, x) => a + obs(x), 0) / 4;
    if (add('K', frage, r.name, sortiert.slice(1).map((x) => x.name), score)) n++;
  }
}
vergleich(175, 'Welche dieser Suren hat die meisten Verse?', (s) => s.verse, true, 1.6);
vergleich(135, 'Welche dieser Suren hat die wenigsten Verse?', (s) => s.verse, false, 1.7);
vergleich(110, 'Welche dieser Suren steht im Koran am weitesten vorne?', (s) => s.nr, false, 1.5);
vergleich(80, 'Welche dieser Suren steht im Koran am weitesten hinten?', (s) => s.nr, true, 1.5);

// Muqatta'at
const kombis = [...new Set(Object.values(D.MUQATTAAT))];
const mitBuchst = Object.keys(D.MUQATTAAT).map(Number);
for (const [nr, k] of Object.entries(D.MUQATTAAT)) {
  const s = byNr(Number(nr));
  if (s.name.replace(/-/g, '') === k.replace(/-/g, '')) continue; // Ta-Ha, Ya-Sin, Sad, Qaf: zu offensichtlich
  add('K', `Mit welchen Buchstaben (Muqatta'at) beginnt die Sure ${s.name}?`, k, aehnlich(kombis, k, 3), 3.1 + 0.9 * obs(s));
}
const ohneBuchst = S.filter((s) => !mitBuchst.includes(s.nr));
const mitBuchstSuren = mitBuchst.map(byNr).filter((s) => !['Ta-Ha', 'Ya-Sin', 'Sad', 'Qaf'].includes(s.name));
for (let i = 0; i < 45; i++) {
  const r = pick(mitBuchstSuren);
  add('K', 'Welche dieser Suren beginnt mit „geheimnisvollen Buchstaben“ (Muqatta\'at)?', r.name, sample(ohneBuchst, 3).map((x) => x.name), 2.9 + 0.8 * obs(r));
}

// Suren nach Tieren / Tageszeiten
const TIERE = [2, 6, 16, 27, 29, 105].map(byNr);
const ZEITEN = [89, 92, 93, 103, 113].map(byNr);
const neutral = S.filter((s) => s.bed && ![...TIERE, ...ZEITEN].includes(s) && ![100, 97, 81, 91, 86, 53, 54].includes(s.nr));
for (let i = 0; i < 30; i++) {
  const r = pick(TIERE);
  add('K', 'Welche dieser Suren ist nach einem Tier benannt?', r.name, sample(neutral, 3).map((x) => x.name), 2.2 + 0.8 * obs(r));
}
for (let i = 0; i < 25; i++) {
  const r = pick(ZEITEN);
  add('K', 'Welche dieser Suren ist nach einer Tageszeit benannt?', r.name, sample(neutral, 3).map((x) => x.name), 2.4 + 0.8 * obs(r));
}

// ---------- Namen Allahs & Begriffe ----------
function paare(liste, kat, fHin, fRueck, basis) {
  for (const x of liste) {
    const andere = liste.filter((y) => y !== x && y.gruppe !== x.gruppe);
    const o = (3 - x.bek) / 3;
    add(kat, fHin(x), x.bed, aehnlich(andere, x, 3, (y) => y.bed).map((y) => y.bed), basis + 2.6 * o);
    add(kat, fRueck(x), x.name, aehnlich(andere, x, 3, (y) => y.name).map((y) => y.name), basis + 0.3 + 2.6 * o);
  }
}
paare(D.NAMEN, 'N', (x) => `Was bedeutet der Name Allahs „${x.name}“?`, (x) => `Welcher Name Allahs bedeutet „${x.bed}“?`, 1.3);
paare(D.BEGRIFFE, 'B', (x) => `Was bedeutet der Begriff „${x.name}“?`, (x) => `Welcher arabische Begriff bedeutet „${x.bed}“?`, 1.1);

// ---------- Monate ----------
const M = D.MONATE;
M.forEach((m, i) => {
  const mitte = 1 - Math.abs(i - 5.5) / 5.5; // Monate in der Mitte sind schwerer
  add('G', `Der wievielte Monat im islamischen Kalender ist ${m}?`, i + 1, zahlenNah(i + 1, 1, 12, 3), 1.8 + 1.6 * mitte);
  add('G', `Wie heißt der ${i + 1}. Monat des islamischen Kalenders?`, m, aehnlich(M, m, 3), 1.9 + 1.6 * mitte);
  add('G', `Welcher Monat folgt im islamischen Kalender auf ${m}?`, M[(i + 1) % 12], aehnlich(M.filter((x) => x !== m), M[(i + 1) % 12], 3), 2.0 + 1.6 * mitte);
  add('G', `Welcher Monat geht im islamischen Kalender ${m} voraus?`, M[(i + 11) % 12], aehnlich(M.filter((x) => x !== m), M[(i + 11) % 12], 3), 2.2 + 1.6 * mitte);
});
const unheilig = M.filter((m) => !D.HEILIGE_MONATE.includes(m) && m !== 'Ramadan');
for (let i = 0; i < 20; i++) add('G', 'Welcher dieser Monate gehört zu den vier heiligen Monaten?', pick(D.HEILIGE_MONATE), sample(unheilig.filter((x) => x.length < 14), 3), 2.8 + rnd() * 0.6);
for (let i = 0; i < 14; i++) add('G', 'Welcher dieser Monate gehört nicht zu den vier heiligen Monaten?', pick(unheilig.filter((x) => x.length < 14)), sample(D.HEILIGE_MONATE, 3), 3.0 + rnd() * 0.6);

// ---------- Propheten ----------
for (const [ar, de, bek] of D.PROPHETEN_DE) {
  const o = (3 - bek) / 3;
  add('P', `Wie heißt der Prophet ${ar} in der deutschen Bibeltradition?`, de, sample(D.PROPHETEN_DE.map((p) => p[1]), 3, [de]), 1.5 + 2.4 * o);
  add('P', `Wie lautet der arabische Name des Propheten ${de}?`, ar, sample(D.PROPHETEN_DE.map((p) => p[0]), 3, [ar]), 1.6 + 2.4 * o);
}

// ---------- Gefährten & Familie ----------
for (let i = 0; i < 45; i++) { const r = pick(D.ZEHN_PARADIES); add('S', 'Wer gehört zu den Zehn, denen das Paradies zugesagt wurde?', r, aehnlich(D.ANDERE_GEFAEHRTEN, r, 3), 3.0 + rnd() * 0.8); }
for (let i = 0; i < 35; i++) { const r = pick(D.ANDERE_GEFAEHRTEN); add('S', 'Wer gehört nicht zu den Zehn, denen das Paradies zugesagt wurde?', r, aehnlich(D.ZEHN_PARADIES, r, 3), 3.2 + rnd() * 0.8); }
for (let i = 0; i < 40; i++) { const r = pick(D.EHEFRAUEN); add('S', 'Wer war eine Ehefrau des Propheten ﷺ?', r, aehnlich(D.NICHT_EHEFRAUEN, r, 3), 2.0 + rnd() * 1.2); }
for (let i = 0; i < 35; i++) { const r = pick(D.NICHT_EHEFRAUEN); add('S', 'Wer war keine Ehefrau des Propheten ﷺ?', r, aehnlich(D.EHEFRAUEN, r, 3), 2.4 + rnd() * 1.2); }
for (let i = 0; i < 40; i++) { const r = pick(D.ANSAR); add('S', 'Wer gehörte zu den Ansar, den Helfern aus Medina?', r, aehnlich(D.MUHADSCHIRUN, r, 3), 2.8 + rnd() * 1.0); }
for (let i = 0; i < 40; i++) { const r = pick(D.MUHADSCHIRUN); add('S', 'Wer gehörte zu den Muhadschirun, den Auswanderern aus Mekka?', r, aehnlich(D.ANSAR, r, 3), 2.8 + rnd() * 1.0); }

// ---------- Prüfung: Verrät die Form die Antwort? ----------
let warnungen = 0;
for (const f of fragen) {
  if (auffaellig(f.a)) { warnungen++; console.warn('⚠ Form verrät evtl. Antwort:', f.q, '|', f.a.join(' / ')); }
}

// ---------- Auf 4 Stufen verteilen ----------
fragen.sort((a, b) => a.s - b.s);
const proStufe = Math.floor(fragen.length / 4);
const stufen = { 1: [], 2: [], 3: [], 4: [] };
fragen.forEach((f, i) => { const st = Math.min(4, Math.floor(i / proStufe) + 1); stufen[st].push([f.k, f.q, ...f.a]); });
for (const st of [1, 2, 3, 4]) stufen[st] = shuffle(stufen[st]);

const out = '// Automatisch erzeugt von tools/build.js – nicht von Hand bearbeiten.\n' +
  '// Format: [Kategorie, Frage, Richtig, Falsch1, Falsch2, Falsch3]\n' +
  'window.HIKMA_FRAGEN = ' + JSON.stringify(stufen) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'data', 'fragen.js'), out);

const kat = {};
fragen.forEach((f) => (kat[f.k] = (kat[f.k] || 0) + 1));
console.log('Fragen gesamt:', fragen.length, '| pro Stufe:', [1, 2, 3, 4].map((s) => stufen[s].length).join(' / '));
console.log('Kategorien:', JSON.stringify(kat), '| Warnungen:', warnungen);
console.log('Stufengrenzen (Score):', [1, 2, 3].map((i) => fragen[i * proStufe].s.toFixed(2)).join(' / '));
