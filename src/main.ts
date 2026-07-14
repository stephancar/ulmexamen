import './style.css';
import { BANK } from './data';
import type { Question, SessionQuestion, SimResult, SubjectId } from './core/types';
import { SUBJECTS, subjectById } from './core/types';
import { mergeBanks, bySubject, topicsOf, parseImport } from './core/bank';
import { buildExamSession, buildLearnSession, buildWeakSession, grade } from './core/session';
import { applyAnswer, newSrsState } from './core/srs';
import { READINESS_LABEL, subjectStats } from './core/stats';
import * as store from './core/store';

const app = document.getElementById('app')!;

const esc = (s: unknown): string =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

function allQuestions(): Question[] {
  return mergeBanks(BANK, store.load().customQuestions);
}

// ---------------------------------------------------------------------------
// Active session state
// ---------------------------------------------------------------------------

type Mode = 'leer' | 'examen' | 'zwak';

interface ActiveSession {
  mode: Mode;
  subject?: SubjectId;
  questions: SessionQuestion[];
  selections: (number | null)[];
  revealed: boolean[];
  index: number;
  startedAt: number;
  // exam only
  minutes?: number;
  passPct?: number;
  deadline?: number;
  timerId?: number;
  examDayQueue?: SubjectId[];
  examDayResults?: SimResult[];
}

let session: ActiveSession | null = null;

function endTimer(): void {
  if (session?.timerId) {
    clearInterval(session.timerId);
    session.timerId = undefined;
  }
}

function recordAnswer(q: SessionQuestion, correct: boolean): void {
  const now = Date.now();
  const d = store.load();
  d.srs[q.id] = applyAnswer(d.srs[q.id] ?? newSrsState(now), correct, now);
  d.answers.push({ questionId: q.id, subject: q.subject, correct, at: now });
  store.save(d);
}

function toggleFlag(id: string): void {
  const d = store.load();
  const i = d.flagged.indexOf(id);
  if (i >= 0) d.flagged.splice(i, 1);
  else d.flagged.push(id);
  store.save(d);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function route(): void {
  endTimer();
  session = null;
  const hash = location.hash.replace(/^#\/?/, '');
  const [head, arg] = hash.split('/');

  switch (head) {
    case 'leer':
      return renderLearnSetup(arg as SubjectId);
    case 'examen':
      return renderExamIntro(arg as SubjectId);
    case 'examendag':
      return renderExamDayIntro();
    case 'zwak':
      return startWeakSession();
    case 'import':
      return renderImport();
    case 'info':
      return renderInfo();
    default:
      return renderDashboard();
  }
}

addEventListener('hashchange', route);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function renderDashboard(): void {
  const data = store.load();
  const pool = allQuestions();

  const cards = SUBJECTS.map((s) => {
    const st = subjectStats(s.id, pool, data.srs, data.answers, data.sims);
    const sims = st.sims.slice(0, 5).reverse();
    return `
      <div class="card" id="card-${s.id}">
        <h3>${esc(s.name)}
          <span class="badge ${s.official ? 'official' : ''}">${s.official ? 'DGLV-examen' : 'schooltheorie'}</span>
        </h3>
        <div class="meta">${st.bankSize} vragen · examen: ${s.exam.questions} vragen / ${s.exam.minutes} min / ≥${s.exam.passPct}%</div>
        <div class="bar"><div style="width:${st.coveragePct.toFixed(0)}%"></div></div>
        <div class="barlabel"><span>dekking ${st.coveragePct.toFixed(0)}%</span>
          <span>${st.rollingPct === null ? 'nog geen antwoorden' : `recent ${st.rollingPct.toFixed(0)}% juist`}</span>
        </div>
        ${
          sims.length
            ? `<div class="simdots">${sims
                .map((x) => `<span class="simdot ${x.passed ? 'pass' : 'fail'}" title="${new Date(x.at).toLocaleDateString('nl-BE')}">${Math.round(x.pct)}</span>`)
                .join('')}</div>`
            : ''
        }
        <div><span class="ready ${st.readiness}">${esc(READINESS_LABEL[st.readiness])}</span></div>
        <div class="actions">
          <button id="btn-leren-${s.id}" onclick="location.hash='#/leer/${s.id}'">📖 Leren</button>
          <button id="btn-examen-${s.id}" class="primary" onclick="location.hash='#/examen/${s.id}'">🎓 Examen</button>
        </div>
      </div>`;
  }).join('');

  app.innerHTML = `
    <h1>Dashboard</h1>
    <p class="sub">Oefen per vak, simuleer het echte examen en laat de app je zwakke punten herhalen.</p>
    <div class="btnrow">
      <button class="primary" id="btn-examendag" onclick="location.hash='#/examendag'">🗓 Volledige examendag (4 DGLV-vakken)</button>
      <button id="btn-zwakke" onclick="location.hash='#/zwak'">🧠 Zwakke punten oefenen</button>
    </div>
    <div class="grid">${cards}</div>`;
}

// ---------------------------------------------------------------------------
// Learn mode
// ---------------------------------------------------------------------------

function renderLearnSetup(subjectId: SubjectId): void {
  const info = subjectById(subjectId);
  if (!info) return renderDashboard();
  const data = store.load();
  const pool = bySubject(allQuestions(), subjectId);
  const topics = topicsOf(pool);
  const flaggedInSubject = pool.filter((q) => data.flagged.includes(q.id)).length;

  app.innerHTML = `
    <h1>📖 Leren — ${esc(info.name)}</h1>
    <p class="sub">Directe feedback met uitleg bij elke vraag. Fout beantwoorde vragen komen automatisch sneller terug.</p>
    <div class="toolbar">
      <label>Onderwerp
        <select id="sel-topic">
          <option value="">Alle onderwerpen</option>
          ${topics.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
        </select>
      </label>
      <label>Aantal vragen
        <select id="sel-count">
          <option value="10">10</option>
          <option value="15" selected>15</option>
          <option value="20">20</option>
        </select>
      </label>
      ${
        flaggedInSubject > 0
          ? `<label><input type="checkbox" id="chk-flagged" /> alleen gemarkeerde (${flaggedInSubject})</label>`
          : ''
      }
      <button class="primary" id="btn-start-leren">Start</button>
    </div>
    <p class="sub">${pool.length} vragen beschikbaar in dit vak.</p>`;

  document.getElementById('btn-start-leren')!.addEventListener('click', () => {
    const topic = (document.getElementById('sel-topic') as HTMLSelectElement).value || undefined;
    const n = parseInt((document.getElementById('sel-count') as HTMLSelectElement).value, 10);
    const onlyFlagged = (document.getElementById('chk-flagged') as HTMLInputElement | null)?.checked;
    const source = onlyFlagged ? pool.filter((q) => store.load().flagged.includes(q.id)) : pool;
    const questions = buildLearnSession(source, store.load().srs, n, Date.now(), Math.random, topic);
    if (questions.length === 0) return;
    session = {
      mode: 'leer',
      subject: subjectId,
      questions,
      selections: questions.map(() => null),
      revealed: questions.map(() => false),
      index: 0,
      startedAt: Date.now(),
    };
    renderSession();
  });
}

function startWeakSession(): void {
  const questions = buildWeakSession(allQuestions(), store.load().srs, 15, Date.now());
  session = {
    mode: 'zwak',
    questions,
    selections: questions.map(() => null),
    revealed: questions.map(() => false),
    index: 0,
    startedAt: Date.now(),
  };
  renderSession();
}

// ---------------------------------------------------------------------------
// Exam mode
// ---------------------------------------------------------------------------

function renderExamIntro(subjectId: SubjectId, examDayQueue?: SubjectId[], examDayResults?: SimResult[]): void {
  const info = subjectById(subjectId);
  if (!info) return renderDashboard();

  app.innerHTML = `
    <h1>🎓 Examensimulatie — ${esc(info.name)}</h1>
    <p class="sub">${info.official ? 'Exact het officiële DGLV-formaat.' : 'Oefenformaat (dit vak wordt niet door het DGLV geëxamineerd).'}</p>
    <div class="result-box">
      <p><b>${info.exam.questions} vragen</b> · <b>${info.exam.minutes} minuten</b> · geslaagd vanaf <b>${info.exam.passPct}%</b></p>
      <p class="sub">Geen feedback tijdens het examen. De timer stopt niet. Succes!</p>
      <button class="primary" id="btn-start-examen">Start examen</button>
    </div>`;

  document.getElementById('btn-start-examen')!.addEventListener('click', () => {
    const { questions, minutes, passPct } = buildExamSession(allQuestions(), subjectId);
    session = {
      mode: 'examen',
      subject: subjectId,
      questions,
      selections: questions.map(() => null),
      revealed: questions.map(() => false),
      index: 0,
      startedAt: Date.now(),
      minutes,
      passPct,
      deadline: Date.now() + minutes * 60_000,
      examDayQueue,
      examDayResults,
    };
    session.timerId = window.setInterval(tickTimer, 500);
    renderSession();
  });
}

function tickTimer(): void {
  if (!session?.deadline) return;
  const el = document.getElementById('timer');
  const left = session.deadline - Date.now();
  if (left <= 0) {
    endTimer();
    submitExam();
    return;
  }
  if (el) {
    const m = Math.floor(left / 60_000);
    const s = Math.floor((left % 60_000) / 1000);
    el.innerHTML = `⏱ <b>${m}:${String(s).padStart(2, '0')}</b>`;
    el.classList.toggle('low', left < 5 * 60_000);
  }
}

function renderExamDayIntro(): void {
  const officials = SUBJECTS.filter((s) => s.official);
  app.innerHTML = `
    <h1>🗓 Volledige examendag</h1>
    <p class="sub">De vier DGLV-vakken na elkaar, elk in het officiële formaat. Tussen de vakken mag je even pauzeren.</p>
    <div class="result-box">
      <p>${officials.map((s) => `<b>${esc(s.short)}</b> (${s.exam.questions}v/${s.exam.minutes}m)`).join(' → ')}</p>
      <button class="primary" id="btn-start-dag">Start examendag</button>
    </div>`;
  document.getElementById('btn-start-dag')!.addEventListener('click', () => {
    const queue = officials.map((s) => s.id);
    renderExamIntro(queue[0], queue.slice(1), []);
  });
}

// ---------------------------------------------------------------------------
// Session rendering (shared by learn / weak / exam)
// ---------------------------------------------------------------------------

function renderSession(): void {
  if (!session) return renderDashboard();
  const s = session;
  const q = s.questions[s.index];
  const isExam = s.mode === 'examen';
  const revealed = s.revealed[s.index];
  const flagged = store.load().flagged.includes(q.id);
  const subjName = subjectById(q.subject)?.short ?? q.subject;

  const letters = ['A', 'B', 'C', 'D'];
  const options = q.order
    .map((orig, displayIdx) => {
      const selected = s.selections[s.index] === displayIdx;
      let cls = 'option';
      if (isExam) {
        if (selected) cls += ' selected';
      } else if (revealed) {
        if (orig === q.correct) cls += ' correct';
        else if (selected) cls += ' wrong';
      } else if (selected) {
        cls += ' selected';
      }
      return `<button class="${cls}" data-idx="${displayIdx}" ${revealed && !isExam ? 'disabled' : ''}>
        <span class="letter">${letters[displayIdx]}</span><span>${esc(q.options[orig])}</span>
      </button>`;
    })
    .join('');

  const header = `
    <div class="session-head">
      <span class="pill">${
        s.mode === 'examen' ? '🎓 Examen' : s.mode === 'zwak' ? '🧠 Zwakke punten' : '📖 Leren'
      } · <b>${esc(subjName)}</b></span>
      <span class="pill">Vraag <b>${s.index + 1}</b> / ${s.questions.length}</span>
      ${isExam ? `<span class="pill" id="timer">⏱ …</span>` : ''}
      <button id="btn-stop" title="Sessie stoppen">✕ Stop</button>
    </div>`;

  const explainBlock =
    !isExam && revealed
      ? `<div class="explain">${esc(q.explain)}${q.ref ? `<span class="ref">Bron: ${esc(q.ref)}</span>` : ''}</div>`
      : '';

  const dots = isExam
    ? `<div class="dots">${s.questions
        .map(
          (_, i) =>
            `<button data-goto="${i}" class="${s.selections[i] !== null ? 'answered' : ''} ${i === s.index ? 'current' : ''}">${i + 1}</button>`,
        )
        .join('')}</div>`
    : '';

  const navButtons = isExam
    ? `<div class="btnrow">
        <button id="btn-prev" ${s.index === 0 ? 'disabled' : ''}>← Vorige</button>
        <button id="btn-next" ${s.index === s.questions.length - 1 ? 'disabled' : ''}>Volgende →</button>
        <button id="btn-submit" class="primary">Indienen</button>
      </div>`
    : `<div class="btnrow">
        ${revealed ? `<button id="btn-next" class="primary">${s.index === s.questions.length - 1 ? 'Afronden' : 'Volgende →'}</button>` : ''}
      </div>`;

  app.innerHTML = `
    ${header}
    ${dots}
    <div class="q-card" id="session">
      <div class="q-topic"><span>${esc(q.topic)}</span>
        <button class="flagbtn ${flagged ? 'on' : ''}" id="btn-flag" title="Markeer deze vraag">🚩</button>
      </div>
      <div class="q-text">${esc(q.q)}</div>
      <div class="options">${options}</div>
      ${explainBlock}
    </div>
    ${navButtons}`;

  if (isExam) tickTimer();

  // Bindings
  document.getElementById('btn-stop')!.addEventListener('click', () => {
    if (confirm('Sessie stoppen? Je voortgang in deze sessie gaat verloren.')) {
      endTimer();
      session = null;
      location.hash = '#/';
    }
  });
  document.getElementById('btn-flag')!.addEventListener('click', () => {
    toggleFlag(q.id);
    renderSession();
  });
  app.querySelectorAll<HTMLButtonElement>('.option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx!, 10);
      if (isExam) {
        s.selections[s.index] = idx;
        renderSession();
      } else if (!s.revealed[s.index]) {
        s.selections[s.index] = idx;
        s.revealed[s.index] = true;
        recordAnswer(q, q.order[idx] === q.correct);
        renderSession();
      }
    });
  });
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    s.index = Math.max(0, s.index - 1);
    renderSession();
  });
  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (!isExam && s.index === s.questions.length - 1) return finishLearnSession();
    s.index = Math.min(s.questions.length - 1, s.index + 1);
    renderSession();
  });
  document.getElementById('btn-submit')?.addEventListener('click', () => {
    const open = s.selections.filter((x) => x === null).length;
    if (open > 0 && !confirm(`Je hebt nog ${open} onbeantwoorde vra(a)g(en). Toch indienen?`)) return;
    submitExam();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      s.index = parseInt(btn.dataset.goto!, 10);
      renderSession();
    });
  });
}

function finishLearnSession(): void {
  if (!session) return;
  const s = session;
  const result = grade(s.questions, s.selections);
  const wrong = s.questions.filter((_, i) => !result.perQuestion[i]);
  app.innerHTML = `
    <div class="result-box">
      <h2>Sessie klaar</h2>
      <div class="score-big ${result.pct >= 70 ? 'pass' : 'fail'}" id="result">${result.correct}/${result.total}</div>
      <p class="sub">${
        wrong.length === 0
          ? 'Alles juist — deze vragen komen later terug ter bevestiging.'
          : `${wrong.length} fout${wrong.length > 1 ? 'e' : ''} antwoord(en): die vragen komen automatisch sneller terug.`
      }</p>
      <div class="btnrow" style="justify-content:center">
        <button class="primary" id="btn-again">Nog een sessie</button>
        <button onclick="location.hash='#/'">Dashboard</button>
      </div>
    </div>`;
  document.getElementById('btn-again')!.addEventListener('click', () => {
    if (s.mode === 'zwak') startWeakSession();
    else location.hash = `#/leer/${s.subject}`;
    if (s.mode !== 'zwak') route();
  });
}

function submitExam(): void {
  if (!session || session.mode !== 'examen') return;
  endTimer();
  const s = session;
  const result = grade(s.questions, s.selections);
  const passed = result.pct >= (s.passPct ?? 70);
  const secondsUsed = Math.round((Date.now() - s.startedAt) / 1000);

  // Record SRS + answer log + sim result
  s.questions.forEach((q, i) => recordAnswer(q, result.perQuestion[i]));
  const sim: SimResult = {
    subject: s.subject!,
    at: Date.now(),
    total: result.total,
    correct: result.correct,
    pct: result.pct,
    passed,
    secondsUsed,
  };
  const d = store.load();
  d.sims.push(sim);
  store.save(d);

  const review = s.questions
    .map((q, i) => {
      const sel = s.selections[i];
      const ok = result.perQuestion[i];
      const your = sel === null ? '<i>geen antwoord</i>' : esc(q.options[q.order[sel]]);
      return `
      <div class="review-item ${ok ? 'good' : 'bad'}">
        <div><b>${i + 1}.</b> ${esc(q.q)}</div>
        <div class="small">Jouw antwoord: ${your}${ok ? ' ✓' : ` — juist: <b>${esc(q.options[q.correct])}</b>`}</div>
        ${!ok ? `<div class="small">${esc(q.explain)}${q.ref ? ` <i>(${esc(q.ref)})</i>` : ''}</div>` : ''}
      </div>`;
    })
    .join('');

  const info = subjectById(s.subject!)!;
  const mins = Math.floor(secondsUsed / 60);

  // Exam day chaining
  let nextBlock = '';
  if (s.examDayQueue !== undefined) {
    const results = [...(s.examDayResults ?? []), sim];
    if (s.examDayQueue.length > 0) {
      const nextSubject = s.examDayQueue[0];
      const remaining = s.examDayQueue.slice(1);
      nextBlock = `<button class="primary" id="btn-next-vak">Volgende vak: ${esc(subjectById(nextSubject)!.short)} →</button>`;
      setTimeout(() => {
        document.getElementById('btn-next-vak')?.addEventListener('click', () => {
          renderExamIntro(nextSubject, remaining, results);
        });
      });
    } else {
      const allPassed = results.every((r) => r.passed);
      nextBlock = `<div class="notice ${allPassed ? 'ok' : 'err'}">
        Examendag afgerond: ${results.map((r) => `${esc(subjectById(r.subject)!.short)} ${Math.round(r.pct)}% ${r.passed ? '✅' : '❌'}`).join(' · ')}
        ${allPassed ? '— <b>allemaal geslaagd!</b> 🎉' : ''}</div>`;
    }
  }

  app.innerHTML = `
    <div class="result-box">
      <h2>${esc(info.name)}</h2>
      <div class="score-big ${passed ? 'pass' : 'fail'}" id="result">${Math.round(result.pct)}%</div>
      <p id="result-verdict" class="${passed ? 'pass' : 'fail'}"><b>${passed ? '✅ Geslaagd' : '❌ Niet geslaagd'}</b> (grens: ${s.passPct}%)</p>
      <p class="sub">${result.correct}/${result.total} juist · ${mins} min ${secondsUsed % 60} s gebruikt van ${s.minutes} min</p>
      <div class="btnrow" style="justify-content:center">
        ${nextBlock}
        <button id="btn-retry">Opnieuw</button>
        <button onclick="location.hash='#/'">Dashboard</button>
      </div>
    </div>
    <h2>Overzicht</h2>
    ${review}`;

  const retrySubject = s.subject!;
  document.getElementById('btn-retry')!.addEventListener('click', () => renderExamIntro(retrySubject));
  session = null;
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

function renderImport(): void {
  const data = store.load();
  const perSubject = SUBJECTS.map((s) => {
    const n = data.customQuestions.filter((q) => q.subject === s.id).length;
    return n > 0 ? `${s.short}: ${n}` : null;
  }).filter(Boolean);

  const example = JSON.stringify(
    [
      {
        subject: 'meteo',
        topic: 'Wolken',
        q: 'Voorbeeldvraag: welke wolk hoort bij onweer?',
        options: ['Cirrus', 'Cumulonimbus', 'Stratus', 'Altostratus'],
        correct: 1,
        explain: 'De cumulonimbus is de onweerswolk.',
      },
    ],
    null,
    2,
  );

  app.innerHTML = `
    <h1>Eigen vragen &amp; back-up</h1>
    <p class="sub">Vragen die je hier toevoegt blijven <b>uitsluitend in je browser</b> (localStorage) en worden nooit geüpload of gedeeld. Zo kan je privé oefenvragen uit je cursusmateriaal overtypen voor eigen gebruik.</p>

    <h2>Eigen vragen importeren</h2>
    <div class="notice info">Formaat: JSON-lijst met <code>subject</code> (${SUBJECTS.map((s) => s.id).join(', ')}), <code>q</code>, <code>options</code> (4), <code>correct</code> (0–3), optioneel <code>topic</code>, <code>explain</code>, <code>ref</code>.</div>
    <textarea id="import-json" placeholder='Plak hier je JSON…'></textarea>
    <div class="btnrow">
      <button id="btn-voorbeeld">Voorbeeld invullen</button>
      <button class="primary" id="btn-import">Importeren</button>
      ${data.customQuestions.length > 0 ? `<button class="danger" id="btn-del-custom">Verwijder alle eigen vragen (${data.customQuestions.length})</button>` : ''}
    </div>
    <div id="import-result"></div>
    ${data.customQuestions.length > 0 ? `<p class="sub">Huidige eigen vragen: ${perSubject.join(' · ')}</p>` : ''}

    <h2>Voortgang</h2>
    <div class="btnrow">
      <button id="btn-export">⬇ Back-up downloaden (voortgang + eigen vragen)</button>
      <button id="btn-restore">⬆ Back-up terugzetten</button>
      <button class="danger" id="btn-reset">Voortgang wissen</button>
    </div>
    <textarea id="restore-json" placeholder="Plak hier je back-up JSON en klik op 'Back-up terugzetten'…" hidden></textarea>`;

  document.getElementById('btn-voorbeeld')!.addEventListener('click', () => {
    (document.getElementById('import-json') as HTMLTextAreaElement).value = example;
  });

  document.getElementById('btn-import')!.addEventListener('click', () => {
    const el = document.getElementById('import-result')!;
    try {
      const parsed = parseImport((document.getElementById('import-json') as HTMLTextAreaElement).value);
      const d = store.load();
      d.customQuestions.push(...parsed);
      store.save(d);
      el.innerHTML = `<div class="notice ok" id="import-ok">✅ ${parsed.length} vra(a)g(en) geïmporteerd. Ze doen mee in leer-, examen- en herhaalmodus.</div>`;
      setTimeout(renderImport, 1200);
    } catch (e) {
      el.innerHTML = `<div class="notice err">❌ ${esc((e as Error).message)}</div>`;
    }
  });

  document.getElementById('btn-del-custom')?.addEventListener('click', () => {
    if (!confirm('Alle eigen vragen verwijderen?')) return;
    const d = store.load();
    d.customQuestions = [];
    store.save(d);
    renderImport();
  });

  document.getElementById('btn-export')!.addEventListener('click', () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ulm-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('btn-restore')!.addEventListener('click', () => {
    const ta = document.getElementById('restore-json') as HTMLTextAreaElement;
    if (ta.hidden) {
      ta.hidden = false;
      ta.focus();
      return;
    }
    try {
      store.importJson(ta.value);
      renderImport();
    } catch (e) {
      alert(`Back-up niet leesbaar: ${(e as Error).message}`);
    }
  });

  document.getElementById('btn-reset')!.addEventListener('click', () => {
    if (!confirm('Alle voortgang (statistieken, herhaalschema, simulaties) wissen? Eigen vragen blijven bewaard.')) return;
    store.resetProgress();
    renderImport();
  });
}

// ---------------------------------------------------------------------------
// Info
// ---------------------------------------------------------------------------

function renderInfo(): void {
  app.innerHTML = `
    <h1>Het echte examen</h1>
    <p class="sub">Zo ziet het theoretisch ULM-examen bij het DGLV (FOD Mobiliteit en Vervoer) eruit.</p>
    <table class="info">
      <tr><th>Vak</th><th>Vragen</th><th>Tijd</th><th>Slaaggrens</th></tr>
      <tr><td>Luchtvaartwetgeving</td><td>20</td><td>40 min</td><td>70 %</td></tr>
      <tr><td>Meteorologie</td><td>20</td><td>40 min</td><td>70 %</td></tr>
      <tr><td>Menselijke prestaties</td><td>10</td><td>20 min</td><td>70 %</td></tr>
      <tr><td>Communicatie</td><td>10</td><td>20 min</td><td>70 %</td></tr>
    </table>
    <ul>
      <li>Computergestuurd, in het Nederlands of Frans (taalkeuze op het examen zelf).</li>
      <li>Alle vakken behalen binnen <b>18 maanden</b> vanaf de maand van je eerste poging.</li>
      <li>Maximaal <b>4 pogingen</b> per vak — daarna begint alles opnieuw.</li>
      <li>Inschrijven via het <a href="https://licensing.mobilit.fgov.be/login" target="_blank" rel="noopener">licensing-portaal</a> van de FOD.</li>
      <li>De vakken aërodynamica, techniek en navigatie horen bij je schoolopleiding — daarom zitten ze hier in oefenformaat.</li>
    </ul>
    <h2>Nuttige bronnen</h2>
    <ul>
      <li><a href="https://mobilit.belgium.be/nl/luchtvaart/vliegen-met/ulm" target="_blank" rel="noopener">FOD Mobiliteit — ULM</a> (officiële regels en examens)</li>
      <li><a href="https://bulmf.be/" target="_blank" rel="noopener">BULMF</a> — de Belgische ULM-federatie</li>
      <li><a href="https://www.skeyes.be/" target="_blank" rel="noopener">skeyes</a> — AIP, NOTAM en weerbriefing</li>
    </ul>
    <h2>Over deze app</h2>
    <p class="sub">De vragenbank is origineel werk voor deze app, gebaseerd op officiële bronnen (KB 20/12/2024, SERA, AIP). Het is studiemateriaal, geen officiële publicatie: bij twijfel geldt altijd de bron. Fout gevonden? Meld ze via GitHub.</p>`;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

route();

declare global {
  interface Window {
    __ulm?: { session: () => ActiveSession | null };
  }
}
window.__ulm = { session: () => session };
