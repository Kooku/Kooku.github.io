(function () {
  var ROUND_SECONDS = 30;
  var STORAGE_KEY = 'typing-duel-best';
  var snippets = [
    'git commit -m "ship the small thing"',
    'const score = speed * accuracy;',
    'npm run build && git push',
    'function focus(input) { input.select(); }',
    'while bugs.length) fix(bugs.pop());',
    'curl -fsSL https://example.dev/status',
    'return coffee > sleep ? code : rest;',
    'document.querySelector(".main").classList.add("ready");',
    'for (const idea of backlog) prototype(idea);',
    'deployPreview({ branch: "typing-duel" });'
  ];

  var state = {
    active: false,
    current: '',
    index: 0,
    startedAt: 0,
    endsAt: 0,
    timer: null,
    typed: 0,
    correct: 0,
    completed: 0,
    best: loadBest(),
    lastResult: null
  };

  var elements = {};

  function loadBest() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { wpm: 0, accuracy: 0 };

    try {
      return JSON.parse(raw);
    } catch (error) {
      return { wpm: 0, accuracy: 0 };
    }
  }

  function saveBest(result) {
    if (result.wpm < state.best.wpm) return;
    if (result.wpm === state.best.wpm && result.accuracy <= state.best.accuracy) return;

    state.best = { wpm: result.wpm, accuracy: result.accuracy };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.best));
  }

  function chooseSnippet() {
    var next = snippets[Math.floor(Math.random() * snippets.length)];
    if (snippets.length > 1 && next === state.current) {
      return chooseSnippet();
    }
    return next;
  }

  function createGame() {
    var backdrop = document.createElement('div');
    backdrop.className = 'typing-duel-backdrop';
    backdrop.innerHTML = [
      '<section class="typing-duel" role="dialog" aria-modal="true" aria-labelledby="typing-duel-title">',
      '  <div class="typing-duel-top">',
      '    <div class="typing-duel-title" id="typing-duel-title">Mini Typing Duel</div>',
      '    <button class="typing-duel-close" type="button" aria-label="Close">&times;</button>',
      '  </div>',
      '  <div class="typing-duel-stats">',
      '    <div class="typing-duel-stat"><span class="typing-duel-label">Time</span><span class="typing-duel-value" data-stat="time">30</span></div>',
      '    <div class="typing-duel-stat"><span class="typing-duel-label">WPM</span><span class="typing-duel-value" data-stat="wpm">0</span></div>',
      '    <div class="typing-duel-stat"><span class="typing-duel-label">Accuracy</span><span class="typing-duel-value" data-stat="accuracy">100%</span></div>',
      '    <div class="typing-duel-stat"><span class="typing-duel-label">Best</span><span class="typing-duel-value" data-stat="best">0</span></div>',
      '  </div>',
      '  <div class="typing-duel-prompt" aria-live="polite"></div>',
      '  <input class="typing-duel-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">',
      '  <div class="typing-duel-result" aria-live="polite"></div>',
      '  <div class="typing-duel-actions">',
      '    <button class="typing-duel-button" type="button" data-action="restart">New Duel</button>',
      '    <button class="typing-duel-button primary" type="button" data-action="copy" disabled>Copy Score</button>',
      '  </div>',
      '</section>'
    ].join('');

    document.body.appendChild(backdrop);

    elements.backdrop = backdrop;
    elements.close = backdrop.querySelector('.typing-duel-close');
    elements.prompt = backdrop.querySelector('.typing-duel-prompt');
    elements.input = backdrop.querySelector('.typing-duel-input');
    elements.result = backdrop.querySelector('.typing-duel-result');
    elements.restart = backdrop.querySelector('[data-action="restart"]');
    elements.copy = backdrop.querySelector('[data-action="copy"]');
    elements.time = backdrop.querySelector('[data-stat="time"]');
    elements.wpm = backdrop.querySelector('[data-stat="wpm"]');
    elements.accuracy = backdrop.querySelector('[data-stat="accuracy"]');
    elements.best = backdrop.querySelector('[data-stat="best"]');

    elements.close.addEventListener('click', close);
    elements.restart.addEventListener('click', start);
    elements.copy.addEventListener('click', copyScore);
    elements.input.addEventListener('input', handleInput);
    elements.input.addEventListener('paste', function (event) {
      event.preventDefault();
    });
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) close();
    });
  }

  function open() {
    if (!elements.backdrop) createGame();
    elements.backdrop.classList.add('is-open');
    start();
  }

  function close() {
    if (!elements.backdrop) return;
    elements.backdrop.classList.remove('is-open');
    stopTimer();
  }

  function start() {
    stopTimer();
    state.active = true;
    state.current = chooseSnippet();
    state.index = 0;
    state.startedAt = Date.now();
    state.endsAt = state.startedAt + ROUND_SECONDS * 1000;
    state.typed = 0;
    state.correct = 0;
    state.completed = 0;
    state.lastResult = null;

    elements.input.value = '';
    elements.input.disabled = false;
    elements.result.textContent = '';
    elements.copy.disabled = true;
    elements.input.focus();
    renderPrompt();
    renderStats();

    state.timer = setInterval(tick, 250);
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function tick() {
    renderStats();
    if (Date.now() >= state.endsAt) finish();
  }

  function handleInput() {
    if (!state.active) return;

    var value = elements.input.value;
    state.typed += 1;

    if (value[value.length - 1] === state.current[value.length - 1]) {
      state.correct += 1;
    }

    state.index = value.length;
    renderPrompt();

    if (value === state.current) {
      state.completed += 1;
      state.current = chooseSnippet();
      state.index = 0;
      elements.input.value = '';
      renderPrompt();
    }
  }

  function getResult() {
    var elapsedMinutes = Math.max((Date.now() - state.startedAt) / 60000, 1 / 60);
    var wpm = Math.round((state.correct / 5) / elapsedMinutes);
    var accuracy = state.typed ? Math.round((state.correct / state.typed) * 100) : 100;

    return {
      wpm: wpm,
      accuracy: accuracy,
      completed: state.completed
    };
  }

  function finish() {
    if (!state.active) return;

    state.active = false;
    stopTimer();
    elements.input.disabled = true;

    var result = getResult();
    state.lastResult = result;
    saveBest(result);
    elements.result.textContent = formatScore(result);
    elements.copy.disabled = false;
    renderStats(result);
  }

  function formatScore(result) {
    return 'Mini Typing Duel: ' + result.wpm + ' WPM, ' + result.accuracy + '% accuracy, ' + result.completed + ' snippets cleared.';
  }

  function copyScore() {
    var result = state.lastResult || getResult();
    var text = formatScore(result);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        elements.result.textContent = text + ' Copied.';
      }).catch(function () {
        copyWithSelection(text);
      });
      return;
    }

    copyWithSelection(text);
  }

  function copyWithSelection(text) {
    elements.input.disabled = false;
    elements.input.value = text;
    elements.input.select();
    document.execCommand('copy');
    elements.input.disabled = true;
    elements.result.textContent = text + ' Copied.';
  }

  function renderStats(result) {
    var current = result || getResult();
    var remaining = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));

    elements.time.textContent = remaining;
    elements.wpm.textContent = current.wpm;
    elements.accuracy.textContent = current.accuracy + '%';
    elements.best.textContent = state.best.wpm;
  }

  function renderPrompt() {
    var typed = elements.input.value;
    var html = '';

    for (var i = 0; i < state.current.length; i += 1) {
      var character = escapeHtml(state.current[i]);
      var className = '';

      if (i < typed.length) {
        className = typed[i] === state.current[i] ? 'done' : 'miss';
      } else if (i === typed.length) {
        className = 'current';
      }

      html += className ? '<span class="' + className + '">' + character + '</span>' : character;
    }

    elements.prompt.innerHTML = html;
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && elements.backdrop && elements.backdrop.classList.contains('is-open')) {
      close();
    }
  });

  window.TypingDuel = { open: open };
}());
