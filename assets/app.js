(() => {
  'use strict';

  const ANSWER_PEPPER = 'f59189c98a8a097cc8bb865eb1f493ca2117e8a2';
  const STORAGE_KEY = 'mvi_github_pages_attempt_v2';
  const $ = (id) => document.getElementById(id);
  const views = ['loadingView', 'startView', 'testView', 'resultView'];
  const CONFIG = window.MVI_CONFIG;
  const QUESTIONS = window.MVI_QUESTIONS;
  const hashCache = new Map();

  const state = {
    attempt: null,
    result: null,
    testActive: false,
    timerHandle: null,
    currentQuestion: null,
    enteredFullscreen: false,
    lastIncidentAt: 0,
    channel: null
  };

  function showView(id) { views.forEach(v => $(v).classList.toggle('hidden', v !== id)); }
  function toast(message, ms = 2400) {
    const el = $('toast'); el.textContent = message; el.classList.remove('hidden');
    clearTimeout(el._timer); el._timer = setTimeout(() => el.classList.add('hidden'), ms);
  }
  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function formatDate(ms) {
    return new Intl.DateTimeFormat('hu-HU', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(ms));
  }
  function safeText(v, max) { return String(v || '').trim().replace(/\s+/g, ' ').slice(0, max); }
  function randomHex(bytes = 10) {
    const a = new Uint8Array(bytes); crypto.getRandomValues(a);
    return [...a].map(x => x.toString(16).padStart(2,'0')).join('');
  }
  function shuffleArray(input) {
    const a = [...input];
    for (let i = a.length - 1; i > 0; i--) {
      const r = new Uint32Array(1); crypto.getRandomValues(r);
      const j = r[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function saveAttempt() { if (state.attempt) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.attempt)); }
  function loadAttempt() {
    try { const x = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return x && x.version === 2 ? x : null; } catch (_) { return null; }
  }
  function gradeFor(percent) {
    for (const [min, grade] of CONFIG.GRADE_THRESHOLDS) if (percent >= min) return grade;
    return 'elégtelen';
  }
  function questionById(id) { return QUESTIONS.find(q => q.id === id); }
  function currentQuestionData(index = state.attempt.currentIndex) {
    const qid = state.attempt.questionOrder[index];
    const q = questionById(qid);
    const order = state.attempt.optionOrders[qid] || q.options.map(o => o.id);
    const lookup = Object.fromEntries(q.options.map(o => [o.id, o]));
    return {...q, options: order.map(id => lookup[id]).filter(Boolean)};
  }
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  }
  async function optionHash(qid, oid) {
    const key = `${qid}|${oid}`;
    if (!hashCache.has(key)) hashCache.set(key, await sha256(`${qid}|${oid}|${ANSWER_PEPPER}`));
    return hashCache.get(key);
  }
  async function isCorrectOption(q, oid) { return q.correctHashes.includes(await optionHash(q.id, oid)); }

  async function maybeEnterFullscreen() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen(); state.enteredFullscreen = true;
      }
    } catch (_) { state.enteredFullscreen = false; }
  }

  function createAttempt(name, className) {
    const questionOrder = shuffleArray(QUESTIONS.map(q => q.id));
    const optionOrders = {};
    QUESTIONS.forEach(q => { optionOrders[q.id] = shuffleArray(q.options.map(o => o.id)); });
    const now = Date.now();
    return {
      version: 2,
      id: `${now.toString(36)}-${randomHex(5)}`,
      studentName: name,
      className,
      startedAt: now,
      deadline: now + CONFIG.TIME_LIMIT_MINUTES * 60 * 1000,
      currentIndex: 0,
      questionOrder,
      optionOrders,
      answers: {},
      answeredCount: 0,
      incidents: 0,
      finished: false,
      finishedAt: null,
      result: null
    };
  }

  function answeredCount() {
    return Object.values(state.attempt.answers || {}).filter(v => Array.isArray(v) && v.length).length;
  }
  function updateProgress() {
    const shown = Math.min(state.attempt.currentIndex + 1, QUESTIONS.length);
    $('progressText').textContent = `${shown} / ${QUESTIONS.length}`;
    $('answeredText').textContent = `${answeredCount()} megválaszolva`;
    $('progressBar').style.width = `${(shown / QUESTIONS.length) * 100}%`;
  }

  function renderQuestion() {
    const q = currentQuestionData(); state.currentQuestion = q;
    $('questionType').textContent = q.type === 'multiple' ? 'Többszörös válasz' : 'Egyszeres válasz';
    $('questionPoints').textContent = `${q.max_points} pont`;
    $('questionText').textContent = q.text;
    $('studentLine').textContent = `${state.attempt.studentName} • ${state.attempt.className}`;
    $('incidentCount').textContent = String(state.attempt.incidents || 0);
    if (q.type === 'multiple') {
      $('multiHint').textContent = `Legfeljebb ${q.max_selections} válasz jelölhető.`;
      $('multiHint').classList.remove('hidden');
    } else $('multiHint').classList.add('hidden');

    const selected = new Set(state.attempt.answers[q.id] || []);
    const container = $('options'); container.innerHTML = '';
    q.options.forEach(opt => {
      const label = document.createElement('label'); label.className = 'option' + (selected.has(opt.id) ? ' selected' : '');
      const input = document.createElement('input');
      input.type = q.type === 'multiple' ? 'checkbox' : 'radio'; input.name = 'answer'; input.value = opt.id; input.checked = selected.has(opt.id);
      input.addEventListener('change', () => {
        if (q.type === 'single') {
          document.querySelectorAll('.option').forEach(el => el.classList.remove('selected'));
          if (input.checked) label.classList.add('selected');
        } else {
          const checked = document.querySelectorAll('#options input:checked');
          if (checked.length > q.max_selections) { input.checked = false; toast(`Legfeljebb ${q.max_selections} válasz jelölhető.`); }
          label.classList.toggle('selected', input.checked);
        }
      });
      const span = document.createElement('span'); span.className = 'option-text'; span.textContent = opt.text;
      label.append(input, span); container.appendChild(label);
    });

    $('prevBtn').classList.toggle('hidden-by-config', !CONFIG.ALLOW_BACK_NAVIGATION);
    $('prevBtn').disabled = state.attempt.currentIndex === 0;
    $('lockedNote').classList.toggle('hidden', CONFIG.ALLOW_BACK_NAVIGATION);
    $('nextBtn').textContent = state.attempt.currentIndex === QUESTIONS.length - 1 ? 'Teszt befejezése' : 'Mentés és következő →';
    updateProgress();
  }

  function getSelection() { return [...document.querySelectorAll('#options input:checked')].map(x => x.value); }
  function saveCurrentAnswer() {
    const q = state.currentQuestion; if (!q) return;
    state.attempt.answers[q.id] = getSelection(); state.attempt.answeredCount = answeredCount(); saveAttempt();
  }

  function startTimer() {
    clearInterval(state.timerHandle); $('timerBadge').classList.remove('hidden');
    const tick = async () => {
      if (!state.testActive) return;
      const left = Math.ceil((state.attempt.deadline - Date.now()) / 1000);
      $('timer').textContent = formatTime(left);
      if (left <= 60) $('timerBadge').style.borderColor = '#f0a3a3';
      if (left <= 0) { clearInterval(state.timerHandle); toast('Lejárt az idő. A teszt automatikusan lezárul.', 3000); await finalizeAttempt(true); }
    };
    tick(); state.timerHandle = setInterval(tick, 1000);
  }
  function stopTimer() { clearInterval(state.timerHandle); state.timerHandle = null; $('timerBadge').classList.add('hidden'); }

  async function calculateResult() {
    let score = 0, maxScore = 0; const details = [];
    for (let pos = 0; pos < state.attempt.questionOrder.length; pos++) {
      const qid = state.attempt.questionOrder[pos], q = questionById(qid);
      const selected = [...new Set(state.attempt.answers[qid] || [])];
      let points = 0; const correctIds = [];
      for (const o of q.options) if (await isCorrectOption(q, o.id)) correctIds.push(o.id);
      if (q.type === 'single') {
        if (selected.length === 1 && correctIds.includes(selected[0])) points = 1;
      } else {
        for (const oid of selected) if (correctIds.includes(oid)) points++;
        points = Math.min(points, q.max_points);
      }
      const isCorrect = selected.length === correctIds.length && selected.every(x => correctIds.includes(x));
      score += points; maxScore += q.max_points;
      const lookup = Object.fromEntries(q.options.map(o => [o.id, o.text]));
      const d = {position:pos+1,question_id:q.id,question:q.text,type:q.type,answer:selected.map(x=>lookup[x]).filter(Boolean),points,max_points:q.max_points,is_correct:isCorrect};
      if (CONFIG.REVEAL_CORRECT_ANSWERS) d.correct_answer = correctIds.map(x => lookup[x]);
      details.push(d);
    }
    const percent = maxScore ? Math.round((score / maxScore) * 1000) / 10 : 0;
    return {
      attempt_id: state.attempt.id,
      student_name: state.attempt.studentName,
      class_name: state.attempt.className,
      started_at: formatDate(state.attempt.startedAt),
      finished_at: formatDate(state.attempt.finishedAt),
      elapsed_seconds: Math.max(0, Math.round((state.attempt.finishedAt - state.attempt.startedAt) / 1000)),
      score, max_score: maxScore, percent, grade: gradeFor(percent), incidents: state.attempt.incidents || 0,
      details, correct_answers_revealed: CONFIG.REVEAL_CORRECT_ANSWERS
    };
  }

  async function finalizeAttempt(auto = false) {
    if (!state.testActive && state.attempt?.finished) return;
    if (!auto) saveCurrentAnswer();
    state.testActive = false; stopTimer();
    state.attempt.finished = true; state.attempt.finishedAt = Date.now();
    state.attempt.result = await calculateResult(); saveAttempt();
    showResult(state.attempt.result);
  }

  function showResult(result) {
    state.result = result; state.testActive = false; stopTimer(); document.body.classList.remove('test-lockdown');
    $('incidentBadge').classList.add('hidden'); showView('resultView');
    $('resultName').textContent = result.student_name;
    $('resultMeta').textContent = `${result.class_name} • ${result.finished_at} • Azonosító: ${result.attempt_id}`;
    $('resultPercent').textContent = `${Number(result.percent).toFixed(1)}%`; $('resultGrade').textContent = result.grade;
    $('resultScore').textContent = `${result.score} / ${result.max_score} pont`; $('resultTime').textContent = formatTime(result.elapsed_seconds);
    $('resultIncidents').textContent = result.incidents;
    $('revealNote').textContent = result.correct_answers_revealed ? 'A helyes válaszok is megjelennek.' : 'A helyes válaszok rejtve maradnak.';
    $('newAttemptBtn').classList.toggle('hidden-by-config', !CONFIG.ALLOW_NEW_ATTEMPT_AFTER_FINISH);
    const details = $('resultDetails'); details.innerHTML = '';
    result.details.forEach((d, i) => {
      const item = document.createElement('div'); item.className = `result-item ${d.is_correct ? 'correct' : 'wrong'}`;
      const h = document.createElement('h3'); h.textContent = `${i+1}. ${d.question}`;
      const ans = document.createElement('p'); ans.className = 'answer-line'; ans.innerHTML = '<strong>Saját válasz:</strong> ';
      ans.append(document.createTextNode(d.answer?.length ? d.answer.join(' | ') : 'Nem adott választ'));
      const point = document.createElement('p'); point.className = d.is_correct ? 'points-ok' : 'points-bad';
      point.textContent = `${d.points} / ${d.max_points} pont • ${d.is_correct ? 'helyes' : 'nem teljesen helyes'}`;
      item.append(h, ans, point);
      if (d.correct_answer) { const corr=document.createElement('p'); corr.className='answer-line'; corr.innerHTML='<strong>Helyes válasz:</strong> '; corr.append(document.createTextNode(d.correct_answer.join(' | '))); item.appendChild(corr); }
      details.appendChild(item);
    });
  }

  function recordIncident(reason) {
    if (!state.testActive || !CONFIG.TRACK_VISIBILITY_CHANGES) return;
    const now = Date.now(); if (now - state.lastIncidentAt < 900) return; state.lastIncidentAt = now;
    state.attempt.incidents = (state.attempt.incidents || 0) + 1; saveAttempt(); $('incidentCount').textContent = String(state.attempt.incidents);
  }

  function enterTestUI() {
    state.testActive = true; document.body.classList.toggle('test-lockdown', !!CONFIG.CLIENT_LOCKDOWN);
    $('incidentBadge').classList.remove('hidden'); showView('testView'); renderQuestion(); startTimer(); setupBroadcast();
  }

  function setupBroadcast() {
    if (!('BroadcastChannel' in window) || state.channel) return;
    state.channel = new BroadcastChannel('mvi_test_channel_v2');
    state.channel.onmessage = (e) => {
      if (!state.testActive) return;
      if (e.data?.type === 'ping' && e.data?.attemptId === state.attempt.id) state.channel.postMessage({type:'active',attemptId:state.attempt.id});
      if (e.data?.type === 'active' && e.data?.attemptId === state.attempt.id) { recordIncident('multi-tab'); toast('A teszt egy másik böngészőlapon is meg van nyitva.', 3500); }
    };
    state.channel.postMessage({type:'ping',attemptId:state.attempt.id});
  }

  async function init() {
    if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
      showView('startView'); $('startError').textContent='Ez a böngésző nem támogatja a szükséges biztonsági funkciókat. Használjon friss Chrome, Edge vagy Firefox böngészőt.'; $('startError').classList.remove('hidden'); return;
    }
    state.attempt = loadAttempt();
    if (!state.attempt) { showView('startView'); return; }
    if (state.attempt.finished && state.attempt.result) { showResult(state.attempt.result); return; }
    if (Date.now() >= state.attempt.deadline) { state.testActive = true; await finalizeAttempt(true); return; }
    enterTestUI();
  }

  $('startForm').addEventListener('submit', async (ev) => {
    ev.preventDefault(); $('startError').classList.add('hidden');
    const name = safeText($('studentName').value,80), className=safeText($('className').value,40);
    if (!name || !className || !$('rulesAccepted').checked) return;
    await maybeEnterFullscreen(); state.attempt = createAttempt(name,className); saveAttempt(); enterTestUI();
  });

  $('prevBtn').addEventListener('click', () => {
    if (!CONFIG.ALLOW_BACK_NAVIGATION || state.attempt.currentIndex <= 0) return;
    saveCurrentAnswer(); state.attempt.currentIndex--; saveAttempt(); renderQuestion();
  });

  $('nextBtn').addEventListener('click', async () => {
    const selected = getSelection();
    if (!selected.length && !confirm('Erre a kérdésre nem jelölt választ. Biztosan továbblép?')) return;
    saveCurrentAnswer();
    if (state.attempt.currentIndex >= QUESTIONS.length - 1) {
      const unanswered = QUESTIONS.length - answeredCount();
      const msg = unanswered ? `${unanswered} kérdés megválaszolatlan. Biztosan befejezi a tesztet?` : 'Biztosan befejezi és leadja a tesztet?';
      if (confirm(msg)) await finalizeAttempt(false);
    } else { state.attempt.currentIndex++; saveAttempt(); renderQuestion(); }
  });

  $('pdfBtn').addEventListener('click', async () => {
    if (!state.result || !window.TestReportPDF) return;
    const btn=$('pdfBtn'), old=btn.textContent; btn.disabled=true; btn.textContent='PDF készítése…';
    try { await window.TestReportPDF.download(state.result); } catch(e) { toast(`A PDF nem készíthető el: ${e.message}`,4000); }
    finally { btn.disabled=false; btn.textContent=old; }
  });

  $('newAttemptBtn').addEventListener('click', () => {
    if (!CONFIG.ALLOW_NEW_ATTEMPT_AFTER_FINISH) return;
    if (!confirm('Új kitöltést indít ezen a böngészőn?')) return;
    localStorage.removeItem(STORAGE_KEY); location.reload();
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') recordIncident('hidden'); });
  document.addEventListener('fullscreenchange', () => {
    if (state.testActive && state.enteredFullscreen && !document.fullscreenElement) { recordIncident('fullscreen'); toast('Kilépett a teljes képernyős módból. Az eseményt a rendszer rögzítette.',3000); state.enteredFullscreen=false; }
  });
  document.addEventListener('contextmenu', e => { if (state.testActive && CONFIG.CLIENT_LOCKDOWN) { e.preventDefault(); toast('A jobb egérgomb a teszt közben le van tiltva.'); } });
  document.addEventListener('copy', e => { if (state.testActive && CONFIG.CLIENT_LOCKDOWN) { e.preventDefault(); toast('A másolás a teszt közben le van tiltva.'); } });
  document.addEventListener('keydown', e => {
    if (!state.testActive || !CONFIG.CLIENT_LOCKDOWN) return;
    const key=e.key.toLowerCase();
    const blocked=e.key==='F12'||(e.ctrlKey&&['c','u','s','p'].includes(key))||(e.ctrlKey&&e.shiftKey&&['i','j','c'].includes(key));
    if (blocked) { e.preventDefault(); toast('Ez a billentyűparancs a teszt közben le van tiltva.'); }
  });
  window.addEventListener('beforeunload', e => { if (state.testActive) { e.preventDefault(); e.returnValue=''; } });

  init();
})();
