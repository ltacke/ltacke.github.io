# Wizard Scoring Web-App

Punktezähler für das Kartenspiel **Wizard Jubiläumsedition** — läuft direkt im Browser, kein App Store, kein Server.

## Features

- 3–6 Spieler
- Normal- und Hardcore-Modus (Sum-Rule)
- Sonderkarten: Bombe 💣 und Wolke ☁️
- Zwei Ansichten: Fokus-Modus und Score-Grid
- Offline-fähig (localStorage)

## Spielregeln

- **Ansage erfüllt:** 20 + 10 × Stiche
- **Ansage nicht erfüllt:** −10 × Differenz
- **Sum-Rule (Normal):** Dealer darf ab Runde 4 nicht den Wert ansagen, der die Gesamtsumme gleich der Kartenanzahl macht
- **Bombe:** Reduziert die verfügbaren Stiche in der Runde um 1
- **Wolke:** Passt die Ansage eines Spielers um ±1 an

## Lokale Entwicklung

```bash
python3 -m http.server 8080
open http://localhost:8080
```

Keine Build-Tools nötig.
