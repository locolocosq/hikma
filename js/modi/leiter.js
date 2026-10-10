// Stufenleiter – 12 Fragen, immer schwerer, mit Sicherheitsstufen. Aussteigen oder alles riskieren?
Hikma.modus({
  id: 'leiter',
  name: 'Stufenleiter',
  icon: '🪜',
  tag: 'Solo',
  kurz: '12 Fragen bis 100.000 – aussteigen oder riskieren?',
  beschreibung: '12 Fragen, von Leicht bis Experte. Jede Stufe verdoppelt ungefähr deinen Gewinn. Bei 1.000 und 16.000 Punkten gibt es Sicherheitsstufen. Vor jeder Frage kannst du aussteigen und behalten, was du hast – eine falsche Antwort wirft dich auf die letzte Sicherheitsstufe zurück.',
  spieler: [1, 1],
  einstellungen: ['kategorien'],
  joker: { '5050': 1, tausch: 1, zeit: 1 },

  async start(spiel) {
    const sp = spiel.spieler[0];
    const BETRAG = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 100000];
    const SICHER = [4, 8]; // Index: 1.000 und 16.000
    const stufeVon = (i) => 1 + Math.floor(i / 3);
    let gesichert = 0;

    for (let i = 0; i < BETRAG.length; i++) {
      // Leiter anzeigen
      const weiter = await new Promise((ok) => {
        const el = spiel.zeigeBildschirm(`<section class="screen">
          <div class="kopf"><h2>🪜 Frage ${i + 1} um ${spiel.zahl(BETRAG[i])}</h2></div>
          <div class="leiter">${BETRAG.map((b, j) => `<div class="sprosse ${j === i ? 'jetzt' : j < i ? 'geschafft' : ''} ${SICHER.includes(j) ? 'sicher' : ''}">
            <span>${j + 1}. ${spiel.STUFEN[stufeVon(j)].icon}${SICHER.includes(j) ? ' 🔒' : ''}</span><span>${spiel.zahl(b)}</span></div>`).join('')}</div>
          <p class="hinweis" style="text-align:center">Aktuell: <b>${spiel.zahl(sp.punkte)}</b> · Sicher: <b>${spiel.zahl(gesichert)}</b></p>
          <div class="unten" style="padding-top:0">
            <button class="knopf" data-w>Weiter spielen</button>
            ${i > 0 ? `<button class="knopf zweit klein" data-a>🚪 Aussteigen mit ${spiel.zahl(sp.punkte)}</button>` : ''}
          </div></section>`);
        el.querySelector('[data-w]').onclick = () => ok(true);
        const a = el.querySelector('[data-a]'); if (a) a.onclick = () => ok(false);
      });
      if (!weiter) {
        sp.info = `ausgestiegen bei Frage ${i + 1}`;
        return spiel.ende({ titel: 'Klug ausgestiegen!', zusatz: `Du nimmst ${spiel.zahl(sp.punkte)} Punkte mit.` });
      }

      const f = spiel.frage(stufeVon(i));
      const e = await spiel.stelle({
        spieler: sp, frage: f, zeit: spiel.STUFEN[f.stufe].zeit, joker: ['5050', 'tausch', 'zeit'],
        titel: `Stufenleiter · Frage ${i + 1}/12`, fortschritt: [i, 12],
        wertText: `Richtig: <b class="p">${spiel.zahl(BETRAG[i])}</b> · Falsch: zurück auf <b class="m">${spiel.zahl(gesichert)}</b>`,
      });
      spiel.zaehle(sp, e.richtig);
      if (!e.richtig) {
        sp.punkte = gesichert;
        await spiel.auswertung(`${e.timeout ? 'Zeit abgelaufen!' : 'Falsch!'} Du fällst auf ${spiel.zahl(gesichert)} zurück.`, 'm');
        sp.info = `gescheitert bei Frage ${i + 1}`;
        return spiel.ende({ titel: 'Leider vorbei', zusatz: `Du nimmst ${spiel.zahl(gesichert)} Punkte mit.` });
      }
      sp.punkte = BETRAG[i];
      if (SICHER.includes(i)) gesichert = BETRAG[i];
      await spiel.auswertung(`Richtig! Du hast jetzt ${spiel.zahl(sp.punkte)}${SICHER.includes(i) ? ' 🔒 gesichert' : ''}`, 'p');
    }
    sp.info = 'alle 12 geschafft';
    spiel.ende({ titel: 'Ganz oben! 👑', zusatz: 'Alle 12 Fragen richtig – Masha\'Allah!' });
  },
});
