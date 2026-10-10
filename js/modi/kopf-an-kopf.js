// Kopf an Kopf – zwei Spieler gleichzeitig, Handy liegt zwischen euch, wer zuerst richtig tippt, gewinnt die Frage
Hikma.modus({
  id: 'kopfankopf',
  name: 'Kopf an Kopf',
  icon: '🤜',
  tag: '2 gleichzeitig',
  kurz: 'Handy in die Mitte – wer zuerst richtig tippt!',
  beschreibung: 'Legt das Handy flach zwischen euch: Jeder hat seine eigene Bildschirmhälfte. Wer zuerst richtig tippt, bekommt die Punkte. Wer falsch tippt, verliert Punkte und ist für diese Frage gesperrt – dann hat der andere alle Zeit der Welt.',
  spieler: [2, 2],
  gemischt: true,
  runden: { label: 'Anzahl Fragen', optionen: [10, 15, 20], std: 10 },

  async start(spiel) {
    const [A, B] = spiel.spieler;
    const n = spiel.einstellungen.runden;
    const esc = spiel.esc;

    for (let i = 0; i < n; i++) {
      const f = spiel.frage();
      const st = spiel.STUFEN[f.stufe];
      const zeit = st.zeit;
      const ergebnis = await new Promise((fertig) => {
        const haelfte = (sp, klasse) => `
          <div class="haelfte ${klasse}" data-sp="${sp.id}">
            <div class="schild"><span style="color:${sp.farbe}">${esc(sp.name)}</span><span class="badge stufe-${f.stufe}">${st.icon} ${st.name}</span></div>
            <h3>${esc(f.text)}</h3>
            <div class="antworten">${f.optionen.map((o, j) => `<button class="antwort" data-i="${j}"><span>${esc(o)}</span></button>`).join('')}</div>
            <div class="ergebnis"></div>
          </div>`;
        const el = spiel.zeigeBildschirm(`<div class="kak">
          ${haelfte(B, 'oben')}
          <div class="mittel">
            <b style="color:${A.farbe}">${spiel.zahl(A.punkte)}</b>
            <div class="vs">Frage ${i + 1}/${n} · ${esc(f.katName)}<br>+${st.plus} / −${st.minus}
              <div class="fortschritt timer" style="width:110px;margin:4px auto 0"><i></i></div></div>
            <b style="color:${B.farbe}">${spiel.zahl(B.punkte)}</b>
            <button class="zurueck" style="width:36px;height:36px" aria-label="Spiel verlassen">✕</button>
          </div>
          ${haelfte(A, 'unten-h')}
        </div>`);
        const gesperrt = new Set();
        let vorbei = false;
        const start = performance.now();
        const bar = el.querySelector('.timer i');
        let raf;
        const tick = () => {
          if (vorbei) return;
          const r = zeit - (performance.now() - start) / 1000;
          bar.style.transform = `scaleX(${Math.max(0, r / zeit)})`;
          if (r <= 0) return ende(null);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        function zeigeLoesung() {
          el.querySelectorAll('.haelfte').forEach((h) => {
            h.querySelectorAll('.antwort')[f.richtig].classList.add('richtig');
            h.querySelector('.antworten').classList.add('fertig');
          });
        }
        function ende(gewinner) {
          if (vorbei) return;
          vorbei = true; cancelAnimationFrame(raf);
          zeigeLoesung();
          setTimeout(() => fertig(gewinner), 1700);
        }
        el.querySelector('.zurueck').onclick = () => {
          if (confirm('Spiel verlassen?')) { vorbei = true; cancelAnimationFrame(raf); spiel.verlassen(); }
        };
        el.querySelectorAll('.haelfte').forEach((h) => {
          const sp = spiel.spieler[Number(h.dataset.sp)];
          h.querySelectorAll('.antwort').forEach((b) => {
            b.onclick = () => {
              if (vorbei || gesperrt.has(sp)) return;
              const i2 = Number(b.dataset.i);
              const erg = h.querySelector('.ergebnis');
              if (i2 === f.richtig) {
                b.classList.add('richtig');
                sp.punkte += st.plus; spiel.zaehle(sp, true);
                erg.className = 'ergebnis p'; erg.textContent = `Richtig! +${st.plus}`;
                spiel.ton('richtig'); spiel.vibriere(30);
                ende(sp);
              } else {
                b.classList.add('falsch');
                sp.punkte -= st.minus; spiel.zaehle(sp, false);
                gesperrt.add(sp); h.querySelector('.antworten').classList.add('gesperrt');
                erg.className = 'ergebnis m'; erg.textContent = `Falsch! −${st.minus} · gesperrt`;
                spiel.ton('falsch'); spiel.vibriere([80, 60, 80]);
                if (gesperrt.size === 2) ende(null);
              }
            };
          });
        });
      });
      if (spiel.beendet) return;
    }
    spiel.ende();
  },
});
