# ULM Examen Trainer

Studie-app voor het Belgische theoretische ULM-examen. Leer per vak, simuleer
het echte DGLV-examen in het officiële formaat en laat slimme herhaling
(Leitner) je zwakke punten drillen.

**Vakken**: de vier DGLV-examenvakken — Luchtvaartwetgeving (20v/40min),
Meteorologie (20v/40min), Menselijke prestaties (10v/20min), Communicatie
(10v/20min), telkens slaaggrens 70 % — plus de schooltheorie aërodynamica,
techniek en navigatie in oefenformaat.

**Vragenbank**: 265 originele vragen met uitleg en bronverwijzing (KB
20/12/2024, SERA, AIP). Geen officiële examenvragen en geen materiaal uit
bestaande cursussen. Eigen vragen kan je privé importeren — die blijven in je
browser (localStorage) en verlaten je toestel nooit.

Zie [SPEC.md](SPEC.md) voor de volledige functionele specificatie.

## Ontwikkelen

Vereist Node 20+.

```sh
npm install
npm run dev        # dev server op http://localhost:5174
npm test           # Vitest: core-logica + kwaliteitscontrole van de vragenbank
npm run test:e2e   # Playwright (eenmalig: npx playwright install chromium)
npm run build      # typecheck + productiebuild naar dist/
```

## Architectuur

- `src/core/` — pure logica: Leitner-SRS, sessiebouwers (leer/examen/zwak),
  statistiek & paraatheid, localStorage-persistentie, bankvalidatie.
- `src/data/` — de vragenbank, één bestand per vak; kwaliteit wordt afgedwongen
  door tests (uniek id, 4 unieke opties, geldige correct-index, uitleg).
- `src/main.ts` — UI met hash-routing: dashboard, leermodus, examensimulatie
  (incl. volledige examendag), zwakke punten, import/back-up, examen-info.
- `tests/` + `e2e/` — 20 unit-tests en 13 Playwright-flows (incl. mobiel).

Elke push naar `main` draait de tests en deployt naar GitHub Pages.
