# Hikma – das Islam-Quiz

**Spielen:** https://locolocosq.github.io/hikma/

Ein Quiz-Spiel fürs Handy mit **über 3.200 Fragen** in **4 Schwierigkeitsstufen** (je über 800 Fragen) und **7 Spielmodi** – allein oder mit Freunden auf einem Handy. Ohne Anmeldung, ohne Werbung, ohne Server. Läuft im Browser und lässt sich auf dem Homescreen installieren („Zum Startbildschirm hinzufügen“).

## Stufen & Punkte

| Stufe | Richtig | Falsch | Zeit |
|---|---|---|---|
| 🌱 Leicht | +100 | −50 | 20 s |
| 🌿 Mittel | +200 | −120 | 25 s |
| 🔥 Schwer | +350 | −250 | 30 s |
| 👑 Experte | +500 | −400 | 35 s |

Dazu Zeitbonus (bis +25 %) und Serienbonus (ab 3 richtigen in Folge, bis +50 %).

## Spielmodi

| Modus | Spieler | Idee |
|---|---|---|
| 🎯 Klassik | 1 | Feste Stufe, 10–20 Fragen, Joker 50:50 / +15 s / Tauschen |
| ⚔️ Duell-Arena | 2–8 | Jeder wählt sein Risiko, ⚔️ Angriffe ziehen Gegnern Punkte ab, 🛡️ Schilde, Ereigniskarten, Finale zählt doppelt |
| 🤜 Kopf an Kopf | 2 | Handy liegt in der Mitte, jeder hat eine Bildschirmhälfte – wer zuerst richtig tippt |
| ⚡ Blitz | 1–8 | So viele Fragen wie möglich in 45/60/90 Sekunden |
| ❤️ Überleben | 1 | 3 Leben, die Stufe steigt alle 4 richtigen Antworten |
| 🎲 Einsatz | 1–8 | Thema sehen, dann Punkte setzen (bis ×3) – oder einen Gegner sabotieren |
| 🪜 Stufenleiter | 1 | 12 Fragen bis 100.000, Sicherheitsstufen, jederzeit aussteigen |

## Die Fragen

- Alle Antworten einer Frage haben dieselbe Form (gleiche Sprache, ähnliche Länge, gleiche Art). Das Build-Skript prüft das automatisch und verwirft Fragen, bei denen die Form die Antwort verraten würde.
- Themen: Koran, Propheten, Sira & Gefährten, Glaube & Praxis, Geschichte, Begriffe, Namen Allahs.
- Gesehene Fragen kommen erst wieder, wenn alle einer Stufe durch sind (gespeichert im Browser).
- Bei Themen mit unterschiedlichen Gelehrtenmeinungen gilt die verbreitetste Ansicht; Verszählung nach Hafs (kufisch).

Die Fragen entstehen aus `tools/daten.js` (strukturierte Daten: Suren, Namen Allahs, Begriffe, Monate …) und `tools/fragen-hand*.js` (handgeschriebene Fragen). Nach Änderungen neu erzeugen:

```bash
node tools/build.js
```

Das schreibt `data/fragen.js` und verteilt alle Fragen nach Schwierigkeit gleichmäßig auf die 4 Stufen.

**Eigene Frage hinzufügen:** eine Zeile in `tools/fragen-hand2.js` ergänzen:

```
Stufe|Kategorie|Frage|Richtige Antwort|Falsch 1|Falsch 2|Falsch 3
3|S|Wer war der erste Gebetsrufer?|Bilal ibn Rabah|Ammar ibn Yasir|Zaid ibn Haritha|Sa'd ibn Mu'adh
```

Kategorien: `K` Koran, `P` Propheten, `S` Sira, `G` Glaube & Praxis, `H` Geschichte, `B` Begriffe, `N` Namen Allahs.

## Neuen Spielmodus hinzufügen

1. Datei `js/modi/mein-modus.js` anlegen:

```js
Hikma.modus({
  id: 'meinmodus',              // eindeutig
  name: 'Mein Modus',
  icon: '🌙',
  tag: 'Neu',                   // kleines Etikett auf der Karte (optional)
  kurz: 'Ein Satz für die Übersicht.',
  beschreibung: 'Ausführliche Regeln für den Einrichtungs-Bildschirm.',
  spieler: [1, 4],              // min, max
  einstellungen: ['stufe', 'kategorien'], // was beim Einrichten abgefragt wird
  gemischt: true,               // Stufe "Gemischt" anbieten
  runden: { label: 'Fragen', optionen: [5, 10], std: 5 },
  joker: { '5050': 1 },         // Startjoker pro Spieler: 5050, zeit, tausch, doppelt, angriff, schild
  startpunkte: 0,

  async start(spiel) {
    for (let i = 0; i < spiel.einstellungen.runden; i++) {
      for (const sp of spiel.spieler) {
        if (spiel.spieler.length > 1) await spiel.uebergabe(sp);
        const f = spiel.frage();                        // oder spiel.frage(3) für eine feste Stufe
        const e = await spiel.stelle({ spieler: sp, frage: f, zeit: 20, joker: ['5050'] });
        const d = spiel.werte(sp, e);                   // Standardwertung inkl. Boni
        await spiel.auswertung(`${e.richtig ? 'Richtig' : 'Falsch'} ${spiel.mitVorzeichen(d)}`, e.richtig ? 'p' : 'm');
      }
    }
    spiel.ende();
  },
});
```

2. In `index.html` eine Zeile ergänzen: `<script src="js/modi/mein-modus.js"></script>`

Fertig – der Modus erscheint automatisch in der Auswahl, in den Regeln und in der Bestenliste.

**Werkzeuge im `spiel`-Objekt:** `frage(stufe)`, `stelle(opts)`, `werte(sp, ergebnis, {faktor})`, `zaehle(sp, richtig)`, `greifeAn(angreifer, ziel, betrag)`, `auswertung(text, art, autoMs)`, `uebergabe(sp)`, `ereignis({icon, titel, text})`, `waehle(titel, optionen)`, `waehleGegner(titel, sp)`, `ende({titel, zusatz})`, `zeigeBildschirm(html)` für komplett eigene Oberflächen (siehe `kopf-an-kopf.js`).

## Technik

Reines HTML/CSS/JavaScript ohne Abhängigkeiten, gehostet über GitHub Pages. Lokal starten: `python -m http.server` im Ordner und `http://localhost:8000` öffnen.
