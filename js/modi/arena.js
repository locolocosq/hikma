// Duell-Arena – mehrere Spieler auf einem Handy, Risiko wählen, Gegner angreifen, Ereigniskarten
(function () {
  const EREIGNISSE = [
    {
      icon: '🏹', titel: 'Robin Hood',
      text: 'Der Führende gibt 15 % seiner Punkte an den Letzten ab.',
      aus(spiel) {
        const r = [...spiel.spieler].sort((a, b) => b.punkte - a.punkte);
        const erster = r[0], letzter = r[r.length - 1];
        if (erster === letzter || erster.punkte <= 0) return 'Alle liegen gleichauf – nichts passiert.';
        const b = Math.round(erster.punkte * 0.15 / 10) * 10;
        erster.punkte -= b; letzter.punkte += b;
        return `${spiel.esc(erster.name)} gibt ${spiel.zahl(b)} Punkte an ${spiel.esc(letzter.name)}.`;
      },
    },
    { icon: '⚡', titel: 'Blitzrunde', text: 'Diese Runde nur die halbe Zeit – aber jede Antwort zählt 1,5-fach!', runde: { zeit: 0.5, faktor: 1.5 } },
    { icon: '👑', titel: 'Expertenfieber', text: 'Wer sich diese Runde an eine Experten-Frage traut, bekommt doppelte Punkte.', runde: { experte: 2 } },
    {
      icon: '⚔️', titel: 'Waffenlager', text: 'Jeder Spieler bekommt einen zusätzlichen Angriff.',
      aus(spiel) { spiel.spieler.forEach((s) => s.joker.angriff++); },
    },
    {
      icon: '🛡️', titel: 'Schildregen', text: 'Jeder Spieler bekommt einen Schild gegen den nächsten Angriff.',
      aus(spiel) { spiel.spieler.forEach((s) => s.joker.schild++); },
    },
    {
      icon: '🎁', titel: 'Glückskiste', text: 'Ein zufälliger Spieler bekommt 300 Punkte geschenkt.',
      aus(spiel) { const s = spiel.spieler[Math.floor(Math.random() * spiel.spieler.length)]; s.punkte += 300; return `🎉 ${spiel.esc(s.name)} bekommt +300!`; },
    },
    {
      icon: '😈', titel: 'Rache des Letzten', text: 'Der Letzte bekommt zwei extra Angriffe.',
      aus(spiel) { const r = [...spiel.spieler].sort((a, b) => a.punkte - b.punkte); r[0].joker.angriff += 2; return `${spiel.esc(r[0].name)} rüstet auf: +2 ⚔️`; },
    },
    {
      icon: '🌪️', titel: 'Sandsturm', text: 'Alle außer dem Letzten verlieren 150 Punkte.',
      aus(spiel) { const r = [...spiel.spieler].sort((a, b) => a.punkte - b.punkte); r.slice(1).forEach((s) => (s.punkte -= 150)); },
    },
    { icon: '🎲', titel: 'Alles oder nichts', text: 'Diese Runde: Richtig bringt doppelt, Falsch kostet doppelt.', runde: { faktor: 2 } },
  ];

  Hikma.modus({
    id: 'arena',
    name: 'Duell-Arena',
    icon: '⚔️',
    tag: 'Party',
    kurz: 'Risiko selbst wählen, Gegner angreifen, Ereigniskarten.',
    beschreibung: 'Ihr gebt das Handy reihum weiter. Jeder wählt vor seiner Frage selbst die Stufe – schwer bringt viel, kostet aber auch viel. Mit ⚔️ Angriff ziehst du einem Gegner Punkte ab, mit 🛡️ Schild wehrst du ab. Jede Runde bringt eine Ereigniskarte, und in der letzten Runde zählt alles doppelt. 3 richtige in Folge = +1 Angriff.',
    spieler: [2, 8],
    einstellungen: ['kategorien'],
    runden: { label: 'Runden (jeder eine Frage pro Runde)', optionen: [4, 6, 10], std: 6 },
    joker: { '5050': 1, doppelt: 1, angriff: 1, schild: 1 },

    async start(spiel) {
      const R = spiel.einstellungen.runden;
      const S = spiel.STUFEN;
      for (let runde = 1; runde <= R; runde++) {
        const finale = runde === R;
        let mod = {};
        if (finale) {
          await spiel.ereignis({ icon: '🏁', titel: 'Finale!', text: 'Letzte Runde – alle Punkte (und Abzüge) zählen doppelt!' });
          mod = { faktor: 2 };
        } else if (runde > 1) {
          const e = EREIGNISSE[Math.floor(Math.random() * EREIGNISSE.length)];
          const extra = e.aus ? e.aus(spiel) : '';
          mod = e.runde || {};
          await spiel.ereignis({ icon: e.icon, titel: `Runde ${runde}: ${e.titel}`, text: e.text + (extra ? `<br><br><b>${extra}</b>` : '') + spiel.tabelleHtml() });
        }

        for (const sp of spiel.spieler) {
          await spiel.uebergabe(sp, `Runde ${runde} von ${R}`);
          const faktorText = (st) => {
            let f = mod.faktor || 1;
            if (mod.experte && st === 4) f *= mod.experte;
            return f;
          };
          const stufe = await spiel.waehle(`${sp.name}, wie viel riskierst du?`, [1, 2, 3, 4].map((s) => {
            const f = faktorText(s);
            return {
              label: `${S[s].icon} ${S[s].name}`, wert: s,
              sub: `Richtig +${spiel.zahl(S[s].plus * f)} · Falsch −${spiel.zahl(S[s].minus * f)}`,
              rechts: f > 1 ? `×${f}` : '',
            };
          }));
          const f = spiel.frage(stufe);
          const fak = faktorText(stufe);
          const e = await spiel.stelle({
            spieler: sp, frage: f, zeit: Math.round(S[stufe].zeit * (mod.zeit || 1)),
            joker: ['5050', 'doppelt', 'angriff'], titel: `Runde ${runde}/${R}`,
            wertText: `Richtig <b class="p">+${spiel.zahl(S[stufe].plus * fak)}</b> · Falsch <b class="m">−${spiel.zahl(S[stufe].minus * fak)}</b>${fak > 1 ? ` · ×${fak}` : ''}`,
          });
          const d = spiel.werte(sp, e, { faktor: fak });
          let text = `${e.richtig ? 'Richtig!' : e.timeout ? 'Zeit abgelaufen!' : 'Falsch!'} ${spiel.mitVorzeichen(d)}`;
          if (e.angriffZiel) {
            const betrag = Math.round(S[stufe].plus * fak * (e.doppelt ? 2 : 1));
            if (e.richtig) text += `<br>${spiel.esc(spiel.greifeAn(sp, e.angriffZiel, betrag).text)}`;
            else { const strafe = Math.round(betrag / 2 / 10) * 10; sp.punkte -= strafe; text += `<br>⚔️ Angriff gescheitert – du verlierst zusätzlich ${spiel.zahl(strafe)}!`; }
          }
          if (e.richtig && sp.serie > 0 && sp.serie % 3 === 0) { sp.joker.angriff++; text += `<br>🔥 ${sp.serie} in Folge – +1 Angriff!`; }
          await spiel.auswertung(text, e.richtig ? 'p' : 'm');
        }
      }
      spiel.ende();
    },
  });
})();
