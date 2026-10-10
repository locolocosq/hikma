// Blitz – so viele Fragen wie möglich in 60 Sekunden
Hikma.modus({
  id: 'blitz',
  name: 'Blitz',
  icon: '⚡',
  tag: 'Tempo',
  kurz: 'Eine Minute. So viele richtige Antworten wie möglich.',
  beschreibung: 'Du hast eine feste Gesamtzeit. Jede richtige Antwort bringt Punkte, jede falsche kostet Punkte – also lieber schnell als blind raten. Mit mehreren Spielern ist jeder einmal dran, dann wird verglichen.',
  spieler: [1, 8],
  gemischt: true,
  runden: { label: 'Zeit in Sekunden', optionen: [45, 60, 90], std: 60 },

  async start(spiel) {
    const gesamt = spiel.einstellungen.runden;
    for (const sp of spiel.spieler) {
      if (spiel.spieler.length > 1) await spiel.uebergabe(sp, `${gesamt} Sekunden – bereit?`);
      const deadline = performance.now() + gesamt * 1000;
      const rest = () => (deadline - performance.now()) / 1000;
      let nr = 0;
      while (rest() > 0.3) {
        nr++;
        const f = spiel.frage();
        const e = await spiel.stelle({
          spieler: sp, frage: f, zeit: rest(), zeitSkala: gesamt, titel: `Frage ${nr} · ⚡ Blitz`,
        });
        if (e.timeout) break; // Zeit um – die letzte, unbeantwortete Frage zählt nicht
        const d = spiel.werte(sp, e, { zeitbonus: false });
        await spiel.auswertung(`${e.richtig ? '✔' : '✘'} ${spiel.mitVorzeichen(d)}`, e.richtig ? 'p' : 'm', 550);
      }
      sp.info = `${sp.richtig + sp.falsch} Fragen in ${gesamt} s`;
      if (spiel.spieler.length > 1) await spiel.ereignis({ icon: '⏱️', titel: 'Zeit um!', text: `${spiel.esc(sp.name)}: ${spiel.zahl(sp.punkte)} Punkte (${sp.richtig} richtig, ${sp.falsch} falsch)` });
    }
    spiel.ende({ zusatz: spiel.spieler.length === 1 ? `${spiel.spieler[0].richtig} richtig in ${gesamt} Sekunden` : '' });
  },
});
