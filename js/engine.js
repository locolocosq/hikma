/* Hikma – Spiel-Engine
 * Stellt Fragen, verwaltet Spieler, Punkte, Joker, Timer und Bildschirme.
 * Spielmodi melden sich mit Hikma.modus({...}) an (siehe js/modi/*.js und README.md).
 */
(function () {
  'use strict';

  // ---------- Konstanten ----------
  const STUFEN = {
    1: { name: 'Leicht', plus: 100, minus: 50, zeit: 20, icon: '🌱' },
    2: { name: 'Mittel', plus: 200, minus: 120, zeit: 25, icon: '🌿' },
    3: { name: 'Schwer', plus: 350, minus: 250, zeit: 30, icon: '🔥' },
    4: { name: 'Experte', plus: 500, minus: 400, zeit: 35, icon: '👑' },
  };
  const KATEGORIEN = {
    K: 'Koran', P: 'Propheten', S: 'Sira & Gefährten', G: 'Glaube & Praxis',
    H: 'Geschichte', B: 'Begriffe', N: 'Namen Allahs',
  };
  const FARBEN = ['#d9b26a', '#4aa3df', '#2fbf84', '#e5534b', '#a77bdf', '#f08bc0', '#5cd0d0', '#e8a33d'];
  const JOKER = {
    '5050': { icon: '✂️', name: '50:50', info: 'Entfernt zwei falsche Antworten.' },
    zeit: { icon: '⏳', name: '+15 s', info: 'Gibt dir 15 Sekunden mehr Zeit.' },
    tausch: { icon: '🔄', name: 'Tauschen', info: 'Ersetzt die Frage durch eine neue derselben Stufe.' },
    doppelt: { icon: '✖️2', name: 'Doppelt', info: 'Doppelte Punkte – aber auch doppelter Abzug.' },
    angriff: { icon: '⚔️', name: 'Angriff', info: 'Richtig: Ein Gegner verliert so viele Punkte, wie die Frage wert ist. Falsch: Du verlierst zusätzlich die Hälfte.' },
    schild: { icon: '🛡️', name: 'Schild', info: 'Wehrt automatisch den nächsten Angriff gegen dich ab.' },
  };
  const FRAGEN = window.HIKMA_FRAGEN || { 1: [], 2: [], 3: [], 4: [] };

  // ---------- Kleine Helfer ----------
  const $app = () => document.getElementById('app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zahl = (n) => Math.round(n).toLocaleString('de-DE');
  const mitVorzeichen = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + zahl(Math.abs(n));
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  function mische(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function html(str) { const t = document.createElement('template'); t.innerHTML = str.trim(); return t.content.firstElementChild; }

  const speicher = {
    lesen(k, std) { try { const v = localStorage.getItem('hikma.' + k); return v == null ? std : JSON.parse(v); } catch (e) { return std; } },
    schreiben(k, v) { try { localStorage.setItem('hikma.' + k, JSON.stringify(v)); } catch (e) { /* privat-Modus */ } },
  };

  // ---------- Ton & Vibration ----------
  let audio = null;
  function ton(art) {
    if (!speicher.lesen('ton', true)) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const noten = { richtig: [523, 784], falsch: [220, 160], tick: [880], sieg: [523, 659, 784, 1047], angriff: [300, 200, 120], klick: [600] }[art] || [440];
      noten.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = art === 'falsch' || art === 'angriff' ? 'sawtooth' : 'sine';
        o.frequency.value = f;
        const t = audio.currentTime + i * 0.11;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(art === 'tick' ? 0.05 : 0.14, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.25);
      });
    } catch (e) { /* kein Audio */ }
  }
  function vibriere(muster) { try { if (speicher.lesen('ton', true) && navigator.vibrate) navigator.vibrate(muster); } catch (e) {} }

  function toast(text) {
    const t = document.getElementById('toast');
    t.textContent = text; t.classList.add('zeigen');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('zeigen'), 2400);
  }
  function konfetti(n = 70) {
    for (let i = 0; i < n; i++) {
      const k = document.createElement('div');
      k.className = 'konfetti';
      k.style.left = Math.random() * 100 + 'vw';
      k.style.background = FARBEN[i % FARBEN.length];
      k.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
      k.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(k);
      setTimeout(() => k.remove(), 4500);
    }
  }

  // ---------- Fragenpool (ohne Wiederholungen über Spiele hinweg) ----------
  function naechsteFrage(stufe, kategorien) {
    const liste = FRAGEN[stufe] || [];
    const erlaubt = (f) => !kategorien || kategorien.length === 0 || kategorien.includes(f[0]);
    let gesehen = new Set(speicher.lesen('gesehen' + stufe, []));
    let kand = [];
    liste.forEach((f, i) => { if (erlaubt(f) && !gesehen.has(i)) kand.push(i); });
    if (kand.length === 0) { // alle gesehen -> Kategorie neu starten
      liste.forEach((f, i) => { if (erlaubt(f)) { gesehen.delete(i); kand.push(i); } });
    }
    if (kand.length === 0) return null;
    const idx = kand[Math.floor(Math.random() * kand.length)];
    gesehen.add(idx);
    speicher.schreiben('gesehen' + stufe, [...gesehen]);
    const [kat, text, richtig, ...falsch] = liste[idx];
    const optionen = mische([richtig, ...falsch]);
    return { stufe, kat, katName: KATEGORIEN[kat] || kat, text, optionen, richtig: optionen.indexOf(richtig) };
  }

  // ---------- Modus-Registry ----------
  const modi = [];
  function modus(def) {
    const d = Object.assign({
      spieler: [1, 1], einstellungen: ['stufe', 'kategorien'], stufen: [1, 2, 3, 4], gemischt: false,
      runden: null, joker: {}, bestenliste: true, tag: '',
    }, def);
    if (!d.id || !d.name || typeof d.start !== 'function') throw new Error('Modus braucht id, name und start()');
    modi.push(d);
  }

  // ---------- Bildschirme ----------
  function zeige(el) { const a = $app(); a.innerHTML = ''; a.appendChild(el); window.scrollTo(0, 0); return el; }

  function startseite() {
    const stats = speicher.lesen('stats', { gespielt: 0, richtig: 0, falsch: 0 });
    const gesamt = [1, 2, 3, 4].reduce((a, s) => a + FRAGEN[s].length, 0);
    const quote = stats.richtig + stats.falsch ? Math.round((stats.richtig / (stats.richtig + stats.falsch)) * 100) + ' %' : '–';
    const name = speicher.lesen('ich', '');
    const el = zeige(html(`
      <section class="screen">
        <div class="logo">
          <div class="stern">
            <svg viewBox="0 0 120 120"><g fill="none" stroke="#d9b26a" stroke-width="1.5" opacity=".55">
              <rect x="25" y="25" width="70" height="70" rx="4"/><rect x="25" y="25" width="70" height="70" rx="4" transform="rotate(45 60 60)"/>
              <circle cx="60" cy="60" r="56" stroke-dasharray="3 6"/></g></svg>
            <div class="ar">حكمة</div>
          </div>
          <h1>HIKMA</h1>
          <p>${name ? 'As-salamu alaikum, ' + esc(name) + '!' : 'Das Islam-Quiz'}</p>
        </div>
        <div class="statleiste">
          <div class="stat"><b>${zahl(gesamt)}</b><span>Fragen</span></div>
          <div class="stat"><b>${zahl(stats.richtig)}</b><span>richtig</span></div>
          <div class="stat"><b>${quote}</b><span>Trefferquote</span></div>
        </div>
        ${name ? '' : `<div class="karte feld"><label for="ich">Wie heißt du?</label>
          <div class="namezeile"><input id="ich" maxlength="16" placeholder="Dein Name" autocomplete="nickname"></div>
          <p class="hinweis" style="margin-top:8px">Kein Konto nötig – der Name wird nur auf diesem Gerät gespeichert.</p></div>`}
        <div class="unten">
          <button class="knopf" data-los>▶ Spielen</button>
          <div class="knopfreihe">
            <button class="knopf zweit klein" data-bl>🏆 Bestenliste</button>
            <button class="knopf zweit klein" data-re>📖 Regeln</button>
          </div>
          <button class="knopf zweit klein" data-ton>${speicher.lesen('ton', true) ? '🔊 Ton & Vibration an' : '🔇 Ton & Vibration aus'}</button>
        </div>
      </section>`));
    const ich = el.querySelector('#ich');
    el.querySelector('[data-los]').onclick = () => {
      if (ich) {
        const n = ich.value.trim();
        if (!n) { ich.focus(); toast('Bitte gib zuerst deinen Namen ein'); return; }
        speicher.schreiben('ich', n);
      }
      ton('klick'); modusWahl();
    };
    el.querySelector('[data-bl]').onclick = () => bestenliste();
    el.querySelector('[data-re]').onclick = () => regeln();
    el.querySelector('[data-ton]').onclick = (e) => {
      const an = !speicher.lesen('ton', true); speicher.schreiben('ton', an);
      e.currentTarget.textContent = an ? '🔊 Ton & Vibration an' : '🔇 Ton & Vibration aus';
      if (an) ton('richtig');
    };
  }

  function kopf(titel, zurueck) {
    const k = html(`<div class="kopf"><button class="zurueck" aria-label="Zurück">‹</button><h2>${esc(titel)}</h2></div>`);
    k.querySelector('button').onclick = zurueck;
    return k;
  }

  function modusWahl() {
    const el = zeige(html('<section class="screen"></section>'));
    el.appendChild(kopf('Spielmodus wählen', startseite));
    const grid = html('<div class="modi"></div>');
    modi.forEach((m) => {
      const sp = m.spieler[0] === m.spieler[1] ? (m.spieler[0] === 1 ? '1 Spieler' : m.spieler[0] + ' Spieler') : m.spieler[0] + '–' + m.spieler[1] + ' Spieler';
      const b = html(`<button class="modus">${m.tag ? `<span class="tag">${esc(m.tag)}</span>` : ''}<span class="ic">${m.icon}</span><b>${esc(m.name)}</b><small>${esc(m.kurz)}</small><small style="margin-top:auto;color:var(--gold2)">👥 ${sp}</small></button>`);
      b.onclick = () => { ton('klick'); einrichtung(m); };
      grid.appendChild(b);
    });
    el.appendChild(grid);
  }

  function einrichtung(m, vorher) {
    const gespeichert = speicher.lesen('einst.' + m.id, {});
    const cfg = Object.assign({ stufe: m.stufen.includes(2) ? 2 : m.stufen[0], runden: m.runden ? m.runden.std : null, kategorien: Object.keys(KATEGORIEN) }, gespeichert, vorher || {});
    const ich = speicher.lesen('ich', '');
    let namen = (vorher && vorher.namen) || speicher.lesen('namen.' + m.id, null) || [ich || 'Spieler 1'];
    namen = namen.slice(0, m.spieler[1]);
    while (namen.length < m.spieler[0]) namen.push('');

    const el = zeige(html('<section class="screen"></section>'));
    el.appendChild(kopf(m.icon + ' ' + m.name, modusWahl));
    el.appendChild(html(`<div class="karte"><p class="hinweis">${m.beschreibung}</p></div>`));

    // Spieler
    const spBox = html(`<div class="karte feld"><label>${m.spieler[1] > 1 ? 'Spieler' : 'Dein Name'}</label><div class="namen"></div></div>`);
    const liste = spBox.querySelector('.namen');
    function zeichneNamen() {
      liste.innerHTML = '';
      namen.forEach((n, i) => {
        const z = html(`<div class="namezeile"><span class="punkt" style="background:${FARBEN[i]}"></span><input maxlength="16" placeholder="Name Spieler ${i + 1}" value="${esc(n)}">${namen.length > m.spieler[0] ? '<button class="weg" aria-label="Entfernen">✕</button>' : ''}</div>`);
        z.querySelector('input').oninput = (e) => { namen[i] = e.target.value; };
        const w = z.querySelector('.weg'); if (w) w.onclick = () => { namen.splice(i, 1); zeichneNamen(); };
        liste.appendChild(z);
      });
      if (namen.length < m.spieler[1]) {
        const plus = html('<button class="knopf zweit klein">＋ Spieler hinzufügen</button>');
        plus.onclick = () => { namen.push(''); zeichneNamen(); liste.querySelectorAll('input')[namen.length - 1].focus(); };
        liste.appendChild(plus);
      }
    }
    zeichneNamen();
    el.appendChild(spBox);

    // Stufe
    if (m.einstellungen.includes('stufe')) {
      const box = html(`<div class="karte feld"><label>Schwierigkeit</label><div class="wahl v4"></div></div>`);
      const w = box.querySelector('.wahl');
      const opts = m.stufen.map((s) => ({ wert: s, label: STUFEN[s].icon + ' ' + STUFEN[s].name, sub: `+${STUFEN[s].plus} / −${STUFEN[s].minus}` }));
      if (m.gemischt) opts.push({ wert: 0, label: '🎲 Gemischt', sub: 'alle Stufen' });
      if (!opts.some((o) => o.wert === cfg.stufe)) cfg.stufe = opts[0].wert;
      opts.forEach((o) => {
        const c = html(`<button class="chip ${o.wert ? 'stufe-' + o.wert : ''} ${cfg.stufe === o.wert ? 'an' : ''}">${o.label}<small>${o.sub}</small></button>`);
        c.onclick = () => { cfg.stufe = o.wert; w.querySelectorAll('.chip').forEach((x) => x.classList.remove('an')); c.classList.add('an'); };
        w.appendChild(c);
      });
      el.appendChild(box);
    }
    // Runden
    if (m.runden) {
      const box = html(`<div class="karte feld"><label>${esc(m.runden.label || 'Runden')}</label><div class="wahl v3"></div></div>`);
      const w = box.querySelector('.wahl');
      m.runden.optionen.forEach((r) => {
        const c = html(`<button class="chip ${cfg.runden === r ? 'an' : ''}">${r}</button>`);
        c.onclick = () => { cfg.runden = r; w.querySelectorAll('.chip').forEach((x) => x.classList.remove('an')); c.classList.add('an'); };
        w.appendChild(c);
      });
      el.appendChild(box);
    }
    // Kategorien
    if (m.einstellungen.includes('kategorien')) {
      const box = html(`<div class="karte feld"><label>Themen</label><div class="chips"></div></div>`);
      const w = box.querySelector('.chips');
      Object.entries(KATEGORIEN).forEach(([k, n]) => {
        const c = html(`<button class="chip ${cfg.kategorien.includes(k) ? 'an' : ''}">${n}</button>`);
        c.onclick = () => {
          if (cfg.kategorien.includes(k)) { if (cfg.kategorien.length === 1) return toast('Mindestens ein Thema auswählen'); cfg.kategorien = cfg.kategorien.filter((x) => x !== k); }
          else cfg.kategorien.push(k);
          c.classList.toggle('an');
        };
        w.appendChild(c);
      });
      el.appendChild(box);
    }

    const los = html('<div class="unten"><button class="knopf">Los geht\'s!</button></div>');
    los.querySelector('button').onclick = () => {
      const ns = namen.map((n) => n.trim());
      if (ns.some((n) => !n)) return toast('Bitte alle Namen ausfüllen');
      if (new Set(ns.map((n) => n.toLowerCase())).size !== ns.length) return toast('Jeder Name darf nur einmal vorkommen');
      speicher.schreiben('namen.' + m.id, ns);
      speicher.schreiben('einst.' + m.id, { stufe: cfg.stufe, runden: cfg.runden, kategorien: cfg.kategorien });
      if (ns.length === 1 && !speicher.lesen('ich', '')) speicher.schreiben('ich', ns[0]);
      starteSpiel(m, { ...cfg, stufe: m.einstellungen.includes('stufe') ? cfg.stufe : 0, namen: ns });
    };
    el.appendChild(los);
  }

  // ---------- Spiel-Kontext für die Modi ----------
  function starteSpiel(m, cfg) {
    let beendet = false;
    const spieler = cfg.namen.map((name, i) => ({
      id: i, name, farbe: FARBEN[i], punkte: m.startpunkte || 0, serie: 0, besteSerie: 0, richtig: 0, falsch: 0,
      joker: Object.assign({}, m.joker), leben: m.leben || 0, raus: false, info: '',
    }));
    const stats = speicher.lesen('stats', { gespielt: 0, richtig: 0, falsch: 0 });
    stats.gespielt++; speicher.schreiben('stats', stats);

    const spiel = {
      modus: m, spieler, einstellungen: cfg, STUFEN, JOKER, KATEGORIEN,
      zahl, mitVorzeichen, esc, html, warte, ton, vibriere, toast, konfetti, mische,
      get beendet() { return beendet; },

      /** Liefert eine neue Frage. stufe 0 = zufällige Stufe. */
      frage(stufe) {
        let s = stufe || cfg.stufe || 0;
        if (!s) s = 1 + Math.floor(Math.random() * 4);
        return naechsteFrage(s, cfg.kategorien);
      },
      punkteFuer(stufe) { return STUFEN[stufe]; },

      /**
       * Zeigt eine Frage und wartet auf die Antwort.
       * opts: { spieler, frage, zeit (Sek. oder 0 = ohne), joker: ['5050',...], titel, fortschritt: [i, n],
       *         wertText (HTML), tabelle (bool), oben (HTML-Zusatz) }
       * Ergebnis: { richtig, timeout, gewaehlt, restAnteil, doppelt, angriffZiel, frage }
       */
      stelle(opts) { return frageBildschirm(spiel, opts); },

      /** Standard-Punktewertung inkl. Serien- und Zeitbonus. Gibt Delta zurück und bucht es. */
      werte(sp, ergebnis, extra = {}) {
        const st = STUFEN[ergebnis.frage.stufe];
        let delta;
        spiel.zaehle(sp, ergebnis.richtig);
        if (ergebnis.richtig) {
          const serienBonus = Math.min(0.5, Math.max(0, sp.serie - 2) * 0.1);
          const zeitBonus = extra.zeitbonus === false ? 0 : 0.25 * (ergebnis.restAnteil || 0);
          delta = Math.round(st.plus * (1 + serienBonus + zeitBonus) / 10) * 10;
        } else {
          delta = -st.minus;
        }
        if (ergebnis.doppelt) delta *= 2;
        if (extra.faktor) delta = Math.round(delta * extra.faktor / 10) * 10;
        sp.punkte += delta;
        return delta;
      },

      /** Zählt richtig/falsch und Serie (ohne Punkte) – für Modi mit eigener Wertung. */
      zaehle(sp, richtig) {
        if (richtig) { sp.serie++; sp.besteSerie = Math.max(sp.besteSerie, sp.serie); sp.richtig++; }
        else { sp.serie = 0; sp.falsch++; }
        const s2 = speicher.lesen('stats', stats); richtig ? s2.richtig++ : s2.falsch++; speicher.schreiben('stats', s2);
      },

      /** Angriff ausführen (mit Schild-Prüfung). */
      greifeAn(angreifer, ziel, betrag) {
        if (ziel.joker.schild > 0) {
          ziel.joker.schild--;
          return { abgewehrt: true, text: `🛡️ ${ziel.name} wehrt den Angriff mit dem Schild ab!` };
        }
        ziel.punkte -= betrag;
        ton('angriff'); vibriere([60, 40, 120]);
        return { abgewehrt: false, text: `⚔️ ${angreifer.name} zieht ${ziel.name} ${zahl(betrag)} Punkte ab!` };
      },

      /** Zeigt das Ergebnis unter der Frage und wartet auf "Weiter". */
      auswertung(text, art = '', autoMs = 0) { return auswertungZeigen(text, art, autoMs); },

      /** Übergabe-Bildschirm bei mehreren Spielern auf einem Handy. */
      uebergabe(sp, zusatz = '') {
        return new Promise((ok) => {
          const el = zeige(html(`<section class="screen"><div class="mitte">
            <div class="gross">📱</div><h2>Gib das Handy an<br><span style="color:${sp.farbe}">${esc(sp.name)}</span></h2>
            ${zusatz ? `<p>${zusatz}</p>` : ''}${tabelleHtml(spieler, sp)}</div>
            <div class="unten"><button class="knopf">Ich bin ${esc(sp.name)} – los!</button></div></section>`));
          el.querySelector('.knopf').onclick = () => { ton('klick'); ok(); };
        });
      },

      /** Ereigniskarte anzeigen. */
      ereignis({ icon, titel, text, knopf = 'Weiter' }) {
        return new Promise((ok) => {
          const el = zeige(html(`<section class="screen"><div class="mitte"><div class="ereignis">
            <div class="ic">${icon}</div><h3>${esc(titel)}</h3><p>${text}</p></div></div>
            <div class="unten"><button class="knopf">${esc(knopf)}</button></div></section>`));
          ton('sieg');
          el.querySelector('.knopf').onclick = () => ok();
        });
      },

      /** Auswahl-Blatt. optionen: [{label, sub, rechts, wert, aus}] */
      waehle(titel, optionen, abbrechbar = false) {
        return new Promise((ok) => {
          const ov = html(`<div class="overlay"><div class="blatt"><h3>${esc(titel)}</h3></div></div>`);
          const b = ov.querySelector('.blatt');
          optionen.forEach((o) => {
            const btn = html(`<button class="option" ${o.aus ? 'disabled style="opacity:.4"' : ''}><span>${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}</span>${o.rechts ? `<span class="re">${o.rechts}</span>` : ''}</button>`);
            btn.onclick = () => { ov.remove(); ton('klick'); ok(o.wert); };
            b.appendChild(btn);
          });
          if (abbrechbar) {
            const x = html('<button class="knopf zweit klein">Abbrechen</button>');
            x.onclick = () => { ov.remove(); ok(null); };
            b.appendChild(x);
          }
          document.body.appendChild(ov);
        });
      },

      /** Gegner auswählen. */
      waehleGegner(titel, sp) {
        const g = spieler.filter((x) => x !== sp && !x.raus);
        return spiel.waehle(titel, g.map((x) => ({
          label: `<span style="color:${x.farbe}">●</span> ${esc(x.name)}`, sub: x.joker.schild ? '🛡️ hat einen Schild' : '',
          rechts: zahl(x.punkte), wert: x,
        })), true);
      },

      /** Spiel beenden und Ergebnis zeigen. */
      ende(opts = {}) {
        if (beendet) return;
        beendet = true;
        ergebnisBildschirm(spiel, opts);
      },
      tabelleHtml: (dran) => tabelleHtml(spieler, dran),
      zeigeBildschirm: (el) => zeige(typeof el === 'string' ? html(el) : el),
      neustart: () => starteSpiel(m, cfg),
      verlassen: () => { beendet = true; startseite(); },
    };

    Promise.resolve(m.start(spiel)).catch((e) => {
      if (e && e.abbruch) return;
      console.error(e); toast('Fehler im Spielmodus: ' + e.message); startseite();
    });
  }

  function tabelleHtml(spieler, dran) {
    if (spieler.length < 2) return '';
    return `<div class="mini-tabelle">${[...spieler].sort((a, b) => b.punkte - a.punkte).map((s) =>
      `<span class="mini ${s === dran ? 'dran' : ''}" style="${s.raus ? 'opacity:.4' : ''}"><span class="punkt" style="background:${s.farbe};width:9px;height:9px"></span>${esc(s.name)} <b>${zahl(s.punkte)}</b>${s.joker && s.joker.schild ? ' 🛡️' : ''}</span>`).join('')}</div>`;
  }

  // ---------- Fragebildschirm ----------
  let aktuelleAuswertung = null;
  function frageBildschirm(spiel, opts) {
    return new Promise((ok, fehler) => {
      const sp = opts.spieler;
      let f = opts.frage;
      const zustand = { doppelt: false, angriffZiel: null, fertig: false, extraZeit: 0 };
      const st = STUFEN[f.stufe];
      const el = zeige(html(`<section class="screen">
        <div class="spielkopf">
          <button class="zurueck" aria-label="Spiel verlassen">✕</button>
          <div class="wer"><b style="color:${sp.farbe}">${esc(sp.name)}</b><span>${esc(opts.titel || '')}</span></div>
          <div class="punktestand">${zahl(sp.punkte)}</div>
        </div>
        ${opts.tabelle !== false ? tabelleHtml(spiel.spieler, sp) : ''}
        ${opts.oben || ''}
        ${opts.fortschritt ? `<div class="fortschritt"><i style="transform:scaleX(${opts.fortschritt[0] / opts.fortschritt[1]})"></i></div>` : ''}
        <div class="frage stufe-${f.stufe}">
          <div class="meta"><span class="badge">${st.icon} ${st.name}</span><span class="kat"></span></div>
          <h3></h3>
          <div class="wert">${opts.wertText != null ? opts.wertText : `Richtig <b class="p">+${st.plus}</b> · Falsch <b class="m">−${st.minus}</b>`}</div>
        </div>
        ${opts.zeit ? '<div class="fortschritt timer"><i></i></div>' : ''}
        <div class="antworten"></div>
        <div class="ergebnis"></div>
        <div class="joker"></div>
        <div class="unten" style="padding-top:0"></div>
      </section>`));

      const $antw = el.querySelector('.antworten');
      const $timer = el.querySelector('.timer');
      const $joker = el.querySelector('.joker');
      aktuelleAuswertung = { el, sp, spiel, ergebnis: el.querySelector('.ergebnis'), unten: el.querySelector('.unten') };

      el.querySelector('.zurueck').onclick = async () => {
        const pausiertAb = Date.now();
        const w = await spiel.waehle('Spiel wirklich verlassen?', [{ label: '🚪 Ja, zum Menü', wert: true }, { label: '▶ Weiterspielen', wert: false }]);
        if (w) { stopTimer(); spiel.verlassen(); fehler({ abbruch: true }); }
        else zustand.extraZeit += (Date.now() - pausiertAb) / 1000;
      };

      function zeichneFrage() {
        el.querySelector('.kat').textContent = f.katName;
        el.querySelector('h3').textContent = f.text;
        $antw.innerHTML = '';
        f.optionen.forEach((o, i) => {
          const b = html(`<button class="antwort"><span class="bu">${'ABCD'[i]}</span><span></span></button>`);
          b.lastElementChild.textContent = o;
          b.onclick = () => antworte(i);
          $antw.appendChild(b);
        });
      }
      zeichneFrage();

      // Timer
      const gesamt = opts.zeit || 0;
      const skala = opts.zeitSkala || gesamt; // Nenner für den Balken (z. B. Gesamtzeit im Blitz-Modus)
      let start = performance.now(), raf = null, letzterTick = 99;
      function rest() { return gesamt + zustand.extraZeit - (performance.now() - start) / 1000; }
      function tick() {
        if (zustand.fertig) return;
        const r = rest();
        const anteil = Math.max(0, Math.min(1, r / skala));
        $timer.firstElementChild.style.transform = `scaleX(${anteil})`;
        $timer.classList.toggle('knapp', r < 5);
        if (r < 5 && Math.ceil(r) !== letzterTick && r > 0) { letzterTick = Math.ceil(r); ton('tick'); }
        if (r <= 0) return antworte(-1);
        raf = requestAnimationFrame(tick);
      }
      function stopTimer() { if (raf) cancelAnimationFrame(raf); raf = null; }
      if (gesamt) raf = requestAnimationFrame(tick);

      // Joker
      function zeichneJoker() {
        $joker.innerHTML = '';
        (opts.joker || []).forEach((j) => {
          const anz = sp.joker[j] || 0;
          if (j === 'schild') return;
          const aktiv = (j === 'doppelt' && zustand.doppelt) || (j === 'angriff' && zustand.angriffZiel);
          const b = html(`<button class="jk ${aktiv ? 'aktiv' : ''}" ${anz <= 0 && !aktiv ? 'disabled' : ''} title="${esc(JOKER[j].info)}">${JOKER[j].icon} ${JOKER[j].name}${aktiv && j === 'angriff' ? ' → ' + esc(zustand.angriffZiel.name) : ''} <em>${anz}</em></button>`);
          b.onclick = () => nutzeJoker(j);
          $joker.appendChild(b);
        });
      }
      async function nutzeJoker(j) {
        if (zustand.fertig) return;
        if (j === '5050') {
          if (sp.joker[j] <= 0) return;
          sp.joker[j]--;
          const falsche = mische([0, 1, 2, 3].filter((i) => i !== f.richtig)).slice(0, 2);
          falsche.forEach((i) => $antw.children[i].classList.add('aus'));
        } else if (j === 'zeit') {
          if (sp.joker[j] <= 0 || !gesamt) return toast('In diesem Modus gibt es keine Zeit');
          sp.joker[j]--; zustand.extraZeit += 15; toast('⏳ +15 Sekunden');
        } else if (j === 'tausch') {
          if (sp.joker[j] <= 0) return;
          const neu = spiel.frage(f.stufe); if (!neu) return;
          sp.joker[j]--; f = neu; zeichneFrage(); start = performance.now() - 0; zustand.extraZeit = 0;
        } else if (j === 'doppelt') {
          if (zustand.doppelt) { zustand.doppelt = false; sp.joker[j]++; }
          else { if (sp.joker[j] <= 0) return; sp.joker[j]--; zustand.doppelt = true; toast('✖️2 Doppelte Punkte – und doppelter Abzug!'); }
        } else if (j === 'angriff') {
          if (zustand.angriffZiel) { zustand.angriffZiel = null; sp.joker[j]++; }
          else {
            if (sp.joker[j] <= 0) return;
            const pausiertAb = Date.now();
            const ziel = await spiel.waehleGegner('Wen willst du angreifen?', sp);
            zustand.extraZeit += (Date.now() - pausiertAb) / 1000;
            if (!ziel || zustand.fertig) return;
            sp.joker[j]--; zustand.angriffZiel = ziel;
          }
        }
        ton('klick'); zeichneJoker();
      }
      zeichneJoker();

      function antworte(i) {
        if (zustand.fertig) return;
        zustand.fertig = true; stopTimer();
        $antw.classList.add('fertig');
        const richtig = i === f.richtig;
        if (i >= 0) $antw.children[i].classList.add(richtig ? 'richtig' : 'falsch');
        $antw.children[f.richtig].classList.add('richtig');
        el.querySelectorAll('.jk').forEach((b) => (b.disabled = true));
        if (richtig) { ton('richtig'); vibriere(30); } else { ton('falsch'); vibriere([80, 60, 80]); }
        ok({
          richtig, timeout: i < 0, gewaehlt: i, frage: f,
          restAnteil: gesamt ? Math.max(0, rest() / gesamt) : 0,
          doppelt: zustand.doppelt, angriffZiel: zustand.angriffZiel,
        });
      }
    });
  }

  function auswertungZeigen(text, art, autoMs) {
    return new Promise((ok) => {
      const a = aktuelleAuswertung;
      if (!a) return ok();
      a.ergebnis.innerHTML = text;
      a.ergebnis.className = 'ergebnis plopp ' + art;
      const p = a.el.querySelector('.punktestand');
      if (p) { p.textContent = zahl(a.sp.punkte); p.classList.add('plopp'); }
      const mt = a.el.querySelector('.mini-tabelle');
      if (mt) mt.outerHTML = tabelleHtml(a.spiel.spieler, a.sp);
      if (autoMs) { setTimeout(ok, autoMs); return; }
      const b = html('<button class="knopf">Weiter</button>');
      b.onclick = () => { ton('klick'); ok(); };
      a.unten.innerHTML = ''; a.unten.appendChild(b);
      b.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // ---------- Ergebnis ----------
  function ergebnisBildschirm(spiel, opts) {
    const sp = spiel.spieler;
    const rang = [...sp].sort((a, b) => b.punkte - a.punkte);
    const m = spiel.modus;
    // Bestenliste
    if (m.bestenliste) {
      const bl = speicher.lesen('bestenliste', {});
      const liste = bl[m.id] || [];
      sp.forEach((s) => liste.push({ name: s.name, punkte: s.punkte, stufe: spiel.einstellungen.stufe || 0, datum: Date.now(), info: s.info || '' }));
      liste.sort((a, b) => b.punkte - a.punkte);
      bl[m.id] = liste.slice(0, 20);
      speicher.schreiben('bestenliste', bl);
    }
    const sieger = rang[0];
    const titel = opts.titel || (sp.length > 1 ? `${sieger.name} gewinnt!` : 'Spiel beendet');
    const el = zeige(html(`<section class="screen">
      <div class="mitte" style="flex:none;padding-top:20px">
        <div class="gross">${sp.length > 1 ? '🏆' : sieger.punkte > 0 ? '🌟' : '📿'}</div>
        <h2>${esc(titel)}</h2>
        ${opts.zusatz ? `<p>${opts.zusatz}</p>` : ''}
      </div>
      <div class="rang">${rang.map((s, i) => `
        <div class="rangzeile ${i === 0 ? 'erster' : ''}">
          <span class="nr">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
          <span class="nm"><span style="color:${s.farbe}">${esc(s.name)}</span>
            <small>✔ ${s.richtig} richtig · ✘ ${s.falsch} falsch · Serie ${s.besteSerie}${s.info ? ' · ' + esc(s.info) : ''}</small></span>
          <span class="pt">${zahl(s.punkte)}</span>
        </div>`).join('')}</div>
      <div class="unten">
        <button class="knopf" data-n>🔁 Nochmal spielen</button>
        <div class="knopfreihe">
          <button class="knopf zweit klein" data-m>Anderer Modus</button>
          <button class="knopf zweit klein" data-h>Startseite</button>
        </div>
      </div></section>`));
    ton('sieg');
    if (sieger.punkte > 0) konfetti();
    el.querySelector('[data-n]').onclick = () => spiel.neustart();
    el.querySelector('[data-m]').onclick = () => modusWahl();
    el.querySelector('[data-h]').onclick = () => startseite();
  }

  // ---------- Bestenliste ----------
  function bestenliste(aktiv) {
    const bl = speicher.lesen('bestenliste', {});
    const id = aktiv || (modi.find((m) => bl[m.id] && bl[m.id].length) || modi[0]).id;
    const el = zeige(html('<section class="screen"></section>'));
    el.appendChild(kopf('🏆 Bestenliste', startseite));
    const tabs = html('<div class="tabs"></div>');
    modi.filter((m) => m.bestenliste).forEach((m) => {
      const c = html(`<button class="chip ${m.id === id ? 'an' : ''}">${m.icon} ${esc(m.name)}</button>`);
      c.onclick = () => bestenliste(m.id);
      tabs.appendChild(c);
    });
    el.appendChild(tabs);
    const liste = bl[id] || [];
    el.appendChild(liste.length ? html(`<div class="rang">${liste.map((e, i) => `
      <div class="rangzeile ${i === 0 ? 'erster' : ''}"><span class="nr">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
      <span class="nm">${esc(e.name)}<small>${e.stufe ? STUFEN[e.stufe].icon + ' ' + STUFEN[e.stufe].name + ' · ' : ''}${new Date(e.datum).toLocaleDateString('de-DE')}${e.info ? ' · ' + esc(e.info) : ''}</small></span>
      <span class="pt">${zahl(e.punkte)}</span></div>`).join('')}</div>`)
      : html('<div class="karte"><p class="hinweis">Noch keine Ergebnisse in diesem Modus. Spiel eine Runde!</p></div>'));
    if (Object.keys(bl).length) {
      const r = html('<div class="unten"><button class="knopf zweit klein">Bestenliste leeren</button></div>');
      r.querySelector('button').onclick = () => { if (confirm('Alle Ergebnisse auf diesem Gerät löschen?')) { speicher.schreiben('bestenliste', {}); bestenliste(); } };
      el.appendChild(r);
    }
  }

  // ---------- Regeln ----------
  function regeln() {
    const el = zeige(html('<section class="screen regeln"></section>'));
    el.appendChild(kopf('📖 Regeln', startseite));
    el.appendChild(html(`<div class="karte"><h3>Punkte</h3>
      <table><tr><th>Stufe</th><th>Richtig</th><th>Falsch</th><th>Zeit</th></tr>
      ${[1, 2, 3, 4].map((s) => `<tr><td>${STUFEN[s].icon} ${STUFEN[s].name}</td><td style="color:var(--gruen)">+${STUFEN[s].plus}</td><td style="color:var(--rot)">−${STUFEN[s].minus}</td><td>${STUFEN[s].zeit} s</td></tr>`).join('')}
      </table>
      <p>Je schwerer die Frage, desto mehr gibt es – aber desto mehr verlierst du auch. Schnelle Antworten bringen bis zu <b>+25 %</b> Zeitbonus, ab der 3. richtigen Antwort in Folge gibt es einen <b>Serienbonus</b> (bis +50 %).</p></div>`));
    el.appendChild(html(`<div class="karte"><h3>Joker</h3><ul>${Object.values(JOKER).map((j) => `<li><b>${j.icon} ${j.name}</b> – ${j.info}</li>`).join('')}</ul>
      <p>Welche Joker es gibt, hängt vom Spielmodus ab.</p></div>`));
    el.appendChild(html(`<div class="karte"><h3>Spielmodi</h3><ul>${modi.map((m) => `<li><b>${m.icon} ${esc(m.name)}</b> – ${m.beschreibung}</li>`).join('')}</ul></div>`));
    el.appendChild(html(`<div class="karte"><h3>Die Fragen</h3><p>${zahl([1, 2, 3, 4].reduce((a, s) => a + FRAGEN[s].length, 0))} Fragen in 4 Stufen zu Koran, Propheten, Sira, Glaube & Praxis, Geschichte, Begriffen und den Namen Allahs. Alle Antworten einer Frage haben dieselbe Form, damit man die richtige nicht am Aussehen erkennt. Gesehene Fragen kommen erst wieder, wenn alle einer Stufe durch sind.</p>
      <p>Bei Themen mit unterschiedlichen Gelehrtenmeinungen gilt die verbreitetste Ansicht. Verszählung nach Hafs (kufisch).</p></div>`));
  }

  // ---------- Öffentliche API ----------
  window.Hikma = {
    modus, STUFEN, KATEGORIEN, JOKER, FARBEN,
    starte() {
      if (!modi.length) { $app().textContent = 'Keine Spielmodi geladen.'; return; }
      startseite();
    },
  };
})();
