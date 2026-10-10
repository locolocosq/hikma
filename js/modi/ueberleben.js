// Überleben – 3 Leben, die Stufe steigt alle 4 richtigen Antworten
Hikma.modus({
  id: 'ueberleben',
  name: 'Überleben',
  icon: '❤️',
  tag: 'Solo',
  kurz: '3 Leben. Es wird immer schwerer.',
  beschreibung: 'Du startest bei Leicht und hast 3 Leben. Alle 4 richtigen Antworten steigt die Stufe – bis Experte. Jede falsche Antwort kostet ein Leben (und Punkte). Wie lange hältst du durch?',
  spieler: [1, 1],
  einstellungen: ['kategorien'],
  leben: 3,
  joker: { '5050': 2 },

  async start(spiel) {
    const sp = spiel.spieler[0];
    let stufe = 1, nr = 0, richtigAufStufe = 0;
    while (sp.leben > 0) {
      nr++;
      const f = spiel.frage(stufe);
      const herzen = '❤️'.repeat(sp.leben) + '🖤'.repeat(3 - sp.leben);
      const e = await spiel.stelle({
        spieler: sp, frage: f, zeit: spiel.STUFEN[stufe].zeit, joker: ['5050'],
        titel: `Frage ${nr} · ${herzen}`,
      });
      const d = spiel.werte(sp, e);
      let text = `${e.richtig ? 'Richtig!' : e.timeout ? 'Zeit abgelaufen!' : 'Falsch!'} ${spiel.mitVorzeichen(d)}`;
      if (e.richtig) {
        richtigAufStufe++;
        if (richtigAufStufe >= 4 && stufe < 4) { stufe++; richtigAufStufe = 0; text += `<br>⬆️ Aufstieg: ${spiel.STUFEN[stufe].icon} ${spiel.STUFEN[stufe].name}`; }
      } else {
        sp.leben--;
        text += sp.leben > 0 ? `<br>💔 Noch ${sp.leben} ${sp.leben === 1 ? 'Leben' : 'Leben'}` : '<br>💔 Keine Leben mehr';
      }
      await spiel.auswertung(text, e.richtig ? 'p' : 'm');
    }
    sp.info = `bis ${spiel.STUFEN[stufe].name}`;
    spiel.ende({ titel: 'Game over', zusatz: `${sp.richtig} richtige Antworten, erreichte Stufe: ${spiel.STUFEN[stufe].icon} ${spiel.STUFEN[stufe].name}` });
  },
});
