// Klassik – Solo-Runde mit fester Stufe
Hikma.modus({
  id: 'klassik',
  name: 'Klassik',
  icon: '🎯',
  tag: 'Solo',
  kurz: 'Eine Stufe, feste Anzahl Fragen, Timer und Bonus.',
  beschreibung: 'Beantworte eine Reihe Fragen deiner Stufe gegen die Uhr. Schnelle Antworten und Serien bringen Bonuspunkte. Du hast je einmal 50:50, +15 Sekunden und Frage-Tauschen.',
  spieler: [1, 1],
  gemischt: true,
  runden: { label: 'Anzahl Fragen', optionen: [10, 15, 20], std: 15 },
  joker: { '5050': 1, zeit: 1, tausch: 1 },

  async start(spiel) {
    const sp = spiel.spieler[0];
    const n = spiel.einstellungen.runden;
    for (let i = 0; i < n; i++) {
      const f = spiel.frage();
      const e = await spiel.stelle({
        spieler: sp, frage: f, zeit: spiel.STUFEN[f.stufe].zeit,
        joker: ['5050', 'zeit', 'tausch'], titel: `Frage ${i + 1} von ${n}`, fortschritt: [i, n],
      });
      const d = spiel.werte(sp, e);
      const serie = sp.serie >= 3 ? ` · 🔥 Serie ${sp.serie}` : '';
      await spiel.auswertung(e.richtig ? `Richtig! ${spiel.mitVorzeichen(d)}${serie}` : `${e.timeout ? 'Zeit abgelaufen!' : 'Falsch!'} ${spiel.mitVorzeichen(d)}`, e.richtig ? 'p' : 'm');
    }
    sp.info = `${sp.richtig}/${n}`;
    spiel.ende({ zusatz: `${sp.richtig} von ${n} Fragen richtig` });
  },
});
