# ULM Examen Trainer — Functional Spec

*Approved 2026-07-14.*

## Doel

Een studie-app voor het Belgische theoretische ULM-examen: gericht oefenen,
realistische examensimulatie en eerlijk inzicht in je paraatheid. Nederlandse
interface, mobile-first, volledig client-side (GitHub Pages).

## Het echte examen (referentie)

Computergestuurd bij het DGLV (FOD Mobiliteit en Vervoer), NL of FR:

| Vak | Vragen | Tijd | Slaaggrens |
|---|---|---|---|
| Luchtvaartwetgeving | 20 | 40 min | 70 % |
| Meteorologie | 20 | 40 min | 70 % |
| Menselijke prestaties | 10 | 20 min | 70 % |
| Communicatie | 10 | 20 min | 70 % |

Alle vier binnen 18 maanden; max. 4 pogingen per vak, anders alles opnieuw.
Bron: mobilit.belgium.be. Aanmelden via licensing.mobilit.fgov.be.

Daarnaast dekt de app de schooltheorie **aërodynamica**, **techniek** en
**navigatie** (oefenformaat 20 vragen / 40 min / 70 %, gemarkeerd als
niet-officieel formaat).

## Modi

1. **Leermodus** — per vak (optioneel per onderwerp), directe feedback met
   uitleg + bronverwijzing bij elke vraag, vragen markeren.
2. **Examensimulatie** — exact het officiële formaat per vak: timer, geen
   feedback tot indienen, slaaggrens 70 %, review achteraf.
   **Volledige examendag**: de vier DGLV-vakken na elkaar.
3. **Zwakke punten** — Leitner spaced repetition (5 boxen, intervallen
   0/1/3/7/14 dagen): fout beantwoorde vragen komen sneller terug; de sessie
   trekt eerst vervallen (due) kaarten, dan ongeziene, dan zwakste onderwerpen.
4. **Dashboard** — per vak: dekking (% van de bank gezien), voortschrijdende
   nauwkeurigheid, simulatiegeschiedenis, en een paraatheidsoordeel
   (groen bij ≥ 80 % op de laatste drie simulaties + ≥ 80 % dekking).

## Vragenbank

- **Origineel werk** — geen vragen overgenomen uit bestaande cursussen of
  boeken (auteursrecht); feiten gebaseerd op officiële bronnen (SERA, AIP,
  mobilit.belgium.be). Elke vraag: 4 opties, uitleg, onderwerp-tag,
  bronverwijzing waar zinvol, moeilijkheidsgraad.
- Omvang v1: wetgeving 50, meteo 50, menselijke prestaties 30, communicatie
  30, aërodynamica 35, techniek 35, navigatie 35.
- **Privé-import**: eigen vragen toevoegen via JSON-plakken/bestand; die
  blijven in localStorage (nooit in de repo of op een server) en doen volledig
  mee in leer-, examen- en herhaalmodus. Export van eigen vragen + voortgang.

## Persistentie

localStorage met schemaversie: antwoordlog, Leitner-status per vraag,
simulatieresultaten, eigen vragen, instellingen. Export/import als JSON.

## Niet-doelen v1

Geen accounts/backend, geen FR-vertaling (structuur laat dit later toe),
geen beeldvragen (kaartfragmenten) — v2-kandidaat.

## Teststrategie

- **Vitest**: Leitner-gedrag (promotie/degradatie/intervallen), sessiebouwers
  (juist aantal, geen duplicaten, examenformaat klopt), statistiek- en
  paraatheidslogica, storage round-trip + schema-migratie.
- **Bank-QA als test**: elke vraag heeft 4 unieke opties, geldige
  correct-index, niet-lege uitleg, geldig vak/onderwerp, uniek id; banken
  halen de minimumomvang per vak.
- **Playwright**: leersessie met feedback, examensim met timer en score,
  import van eigen vragen, persistentie na reload; mobiel (Pixel 7-emulatie).
