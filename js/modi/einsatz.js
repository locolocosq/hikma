// Einsatz – Thema und Stufe sehen, dann Punkte setzen – oder gegen einen Gegner setzen
Hikma.modus({
  id: 'einsatz',
  name: 'Einsatz',
  icon: '🎲',
  tag: 'Taktik',
  kurz: 'Erst Thema sehen, dann Punkte setzen – oder Gegner sabotieren.',
  beschreibung: 'Jeder startet mit 1.000 Punkten. Du siehst zuerst Thema und Stufe der Frage und entscheidest dann, wie viel du setzt. Schwerere Fragen zahlen mehr aus (bis ×3). Oder du setzt auf Sabotage: Antwortest du richtig, verliert ein Gegner deinen Einsatz.',
  spieler: [1, 8],
  einstellungen: ['kategorien'],
  startpunkte: 1000,
  runden: { label: 'Runden', optionen: [5, 8, 12], std: 8 },

  async start(spiel) {
    const R = spiel.einstellungen.runden;
    const MULTI = { 1: 1, 2: 1.5, 3: 2, 4: 3 };
    const mehrere = spiel.spieler.length > 1;

    for (let runde = 1; runde <= R; runde++) {
      for (const sp of spiel.spieler) {
        if (mehrere) await spiel.uebergabe(sp, `Runde ${runde} von ${R}`);
        const stufe = 1 + Math.floor(Math.random() * 4);
        const f = spiel.frage(stufe);
        const st = spiel.STUFEN[stufe];
        const basis = Math.max(sp.punkte, 0);
        const einsaetze = [...new Set([0.1, 0.25, 0.5, 1].map((p) => Math.max(100, Math.round(basis * p / 10) * 10)))];
        const optionen = einsaetze.map((b, i) => ({
          label: i === einsaetze.length - 1 && basis > 100 ? `💰 Alles: ${spiel.zahl(b)}` : `Setze ${spiel.zahl(b)}`,
          sub: `Richtig +${spiel.zahl(b * MULTI[stufe])} · Falsch −${spiel.zahl(b)}`, wert: { b },
        }));
        if (mehrere) {
          const sab = Math.max(100, Math.round(basis * 0.25 / 20) * 20);
          spiel.spieler.filter((x) => x !== sp).forEach((g) => optionen.push({
            label: `⚔️ Sabotage gegen ${spiel.esc(g.name)}`, sub: `Richtig: ${spiel.esc(g.name)} verliert ${spiel.zahl(sab)} · Falsch: du verlierst ${spiel.zahl(sab / 2)}`,
            rechts: spiel.zahl(g.punkte), wert: { b: sab, ziel: g },
          }));
        }
        const wahl = await spiel.waehle(`${st.icon} ${st.name} · ${f.katName} (×${MULTI[stufe]})`, optionen);
        const e = await spiel.stelle({
          spieler: sp, frage: f, zeit: st.zeit, titel: `Runde ${runde}/${R}`,
          wertText: wahl.ziel ? `Sabotage gegen <b>${spiel.esc(wahl.ziel.name)}</b>: ${spiel.zahl(wahl.b)}` : `Einsatz ${spiel.zahl(wahl.b)} · Gewinn <b class="p">+${spiel.zahl(wahl.b * MULTI[stufe])}</b>`,
        });
        spiel.zaehle(sp, e.richtig);
        let text;
        if (wahl.ziel) {
          if (e.richtig) text = 'Richtig!<br>' + spiel.esc(spiel.greifeAn(sp, wahl.ziel, wahl.b).text);
          else { sp.punkte -= wahl.b / 2; text = `Falsch! Sabotage gescheitert: −${spiel.zahl(wahl.b / 2)}`; }
        } else {
          const d = e.richtig ? Math.round(wahl.b * MULTI[stufe]) : -wahl.b;
          sp.punkte += d;
          text = `${e.richtig ? 'Richtig!' : e.timeout ? 'Zeit abgelaufen!' : 'Falsch!'} ${spiel.mitVorzeichen(d)}`;
        }
        await spiel.auswertung(text, e.richtig ? 'p' : 'm');
      }
    }
    spiel.ende();
  },
});
