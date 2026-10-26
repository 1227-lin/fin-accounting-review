/* ==========================================================
   交互逻辑：倒计时 / 今日任务 / 勾选进度 / 章节搜索
   无依赖，全部本地运行
   ========================================================== */
(function () {
  'use strict';

  const SITE = window.SITE || {};
  const CHAPTERS = window.CHAPTERS || [];
  const PLAN = window.PLAN || [];
  const CHEAT = window.CHEAT || [];
  const HABITS = window.HABITS || [];

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }
  };

  /* ---------------- 日期工具 ---------------- */
  function parseYMD(s) {
    const p = String(s).slice(0, 10).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }
  function dayDiff(a, b) {
    const x = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const y = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((y - x) / 86400000);
  }
  const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const fmtMD = d => String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
  const fmtYMD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  const START = parseYMD(SITE.startISO || '2026-10-26');

  /* 把 PLAN 拍平成一维的天列表，同时记录每段属于哪个阶段/周 */
  const ALL_DAYS = [];
  let weekCounter = 0;
  PLAN.forEach(function (phase) {
    (phase.weeks || []).forEach(function (w) {
      weekCounter++;
      w._no = weekCounter;
      const startIdx = ALL_DAYS.length;
      (w.days || []).forEach(function (day, i) {
        ALL_DAYS.push({
          idx: ALL_DAYS.length,
          weekNo: weekCounter,
          phaseId: phase.id,
          phaseTitle: phase.title,
          weekTheme: w.theme,
          weekGoal: w.goal,
          hours: w.hours,
          inWeek: i,
          date: addDays(START, startIdx + i),
          t: day.t,
          d: day.d
        });
      });
      w._startIdx = startIdx;
      w._len = (w.days || []).length;
    });
  });

  const EXAM = new Date(SITE.examISO || '2027-01-08T09:00:00+08:00');
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayIdx = dayDiff(START, todayStart);

  /* ---------------- 勾选进度 ---------------- */
  function getChapterState() { return store.get('fa.chapters.v1', {}); }
  function getPlanState() { return store.get('fa.plan.v1', {}); }

  function paintBars() {
    const cs = getChapterState();
    const cDone = CHAPTERS.filter(c => cs['c' + c.num]).length;
    const bs = getPlanState();
    const pDone = ALL_DAYS.filter(d => bs['d' + d.idx]).length;

    $$('[data-bar="chapter"]').forEach(el => {
      el.style.width = (CHAPTERS.length ? (cDone / CHAPTERS.length * 100) : 0) + '%';
    });
    $$('[data-bar="plan"]').forEach(el => {
      el.style.width = (ALL_DAYS.length ? (pDone / ALL_DAYS.length * 100) : 0) + '%';
    });
    $$('[data-count="chapter"]').forEach(el => { el.textContent = cDone + ' / ' + CHAPTERS.length + ' 章'; });
    $$('[data-count="plan"]').forEach(el => { el.textContent = pDone + ' / ' + ALL_DAYS.length + ' 天'; });
  }

  /* ---------------- 倒计时 ---------------- */
  function renderCountdown() {
    const box = $('#countdown');
    if (!box) return;
    function tick() {
      const now = new Date();
      let ms = EXAM - now;
      if (ms < 0) ms = 0;
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      const ps = getPlanState();
      const done = ALL_DAYS.filter(d => ps['d' + d.idx]).length;
      box.innerHTML =
        '<div class="cd-cell hot"><div class="cd-num">' + days + '</div><div class="cd-lab">天后考试</div></div>' +
        '<div class="cd-cell"><div class="cd-num">' + (days / 7).toFixed(1) + '</div><div class="cd-lab">折合周数</div></div>' +
        '<div class="cd-cell"><div class="cd-num">' + hours + '</div><div class="cd-lab">小时</div></div>' +
        '<div class="cd-cell"><div class="cd-num">' + mins + '</div><div class="cd-lab">分钟</div></div>' +
        '<div class="cd-cell"><div class="cd-num">' + done + '<span style="font-size:14px;color:var(--ink-3)">/' + ALL_DAYS.length + '</span></div><div class="cd-lab">已完成任务</div></div>';
    }
    tick();
    setInterval(tick, 30000);
  }

  /* ---------------- 今日任务 ---------------- */
  function renderToday() {
    const box = $('#todayCard');
    if (!box) return;

    if (!ALL_DAYS.length) { box.classList.add('hide'); return; }

    if (todayIdx < 0) {
      const first = ALL_DAYS[0];
      box.innerHTML =
        '<div class="sub-h">计划还没开始</div>' +
        '<h2>' + Math.abs(todayIdx) + ' 天后开始</h2>' +
        '<p class="t-meta">起算日是 ' + fmtYMD(START) + '。可以今天就开始，也可以对照着先看第 1 章的“一句话”。</p>' +
        '<div class="day"><div class="day-lab"><b>' + fmtMD(first.date) + '</b>' + WD[first.date.getDay()] + '</div>' +
        '<div class="day-txt">' + first.t + '</div></div>';
      return;
    }

    if (todayIdx >= ALL_DAYS.length) {
      box.innerHTML =
        '<div class="sub-h">计划已跑完</div>' +
        '<h2>考试日就在眼前</h2>' +
        '<p class="t-meta">只看速查卡和错题本，别再开新章节了。祝顺利。</p>' +
        '<p style="margin-top:12px"><a href="cheat.html">→ 打开考前速查</a></p>';
      return;
    }

    const d = ALL_DAYS[todayIdx];
    const wStart = addDays(d.date, -d.inWeek);
    const wEnd = addDays(wStart, 6);
    const ps = getPlanState();
    const key = 'd' + d.idx;
    const checked = ps[key] ? ' checked' : '';

    box.innerHTML =
      '<div class="sub-h">今天该做什么 · 第 ' + (todayIdx + 1) + ' 天</div>' +
      '<h2>' + fmtMD(d.date) + ' ' + WD[d.date.getDay()] + ' · ' + d.weekTheme + '</h2>' +
      '<p class="t-meta">' + d.phaseTitle + ' · 第 ' + d.weekNo + ' 周（' + fmtMD(wStart) + '–' + fmtMD(wEnd) + '）' + (d.hours ? ' · ' + d.hours : '') + '</p>' +
      '<div class="day"><div class="day-lab"><b>' + fmtMD(d.date) + '</b>' + WD[d.date.getDay()] + '</div>' +
      '<label class="check"><input type="checkbox" data-k="' + key + '"' + checked + '><span class="box"></span>' +
      '<span class="day-txt">' + d.t + (d.d ? '<em>' + d.d + '</em>' : '') + '</span></label></div>' +
      '<p style="margin-top:14px;font-size:13.5px"><a href="plan.html">查看完整计划表 →</a> · <a href="knowledge.html">对应章节的知识清单 →</a></p>';

    const cb = box.querySelector('input[type=checkbox]');
    if (cb) {
      cb.addEventListener('change', function () {
        const s = getPlanState();
        if (cb.checked) s[key] = 1; else delete s[key];
        store.set('fa.plan.v1', s);
        paintBars();
        renderCountdown();
      });
    }
  }

  /* ---------------- 知识清单 ---------------- */
  function stars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }
  function diffLabel(n) { return ['', '入门', '基础', '中等', '较难', '很难'][n] || ''; }

  function chapterHTML(c) {
    const cs = getChapterState();
    const done = cs['c' + c.num] ? ' checked' : '';
    const concepts = (c.concepts || []).map(function (x) {
      return '<div class="concept"><dt>' + x.t + '</dt><dd>' + x.d + '</dd></div>';
    }).join('');

    const entries = (c.entries || []).map(function (e) {
      const rows = (e.rows || []).map(function (r) {
        const isDr = r.s === '借', isCr = r.s === '贷';
        const cls = isDr ? 'dr' : (isCr ? 'cr' : '');
        const label = (isDr || isCr)
          ? '<span class="side">' + r.s + '：</span>'
          : '<span class="side" style="min-width:1.6em">' + r.s + '</span>';
        return '<div class="row ' + cls + '">' + label +
          '<span class="acct">' + r.a + '</span><span class="num">' + (r.n || '') + '</span></div>';
      }).join('');
      return '<div class="entry-card"><div class="entry-name">' + e.name + '</div>' +
        '<div class="entry-lines">' + rows + '</div>' +
        (e.note ? '<div class="entry-note">' + e.note + '</div>' : '') + '</div>';
    }).join('');

    const traps = (c.traps || []).map(t => '<li>' + t + '</li>').join('');
    const quiz = (c.quiz || []).map(function (q, i) {
      return '<div class="quiz-item"><div class="quiz-q"><span class="quiz-idx">Q' + (i + 1) + '</span><span class="q-text">' + q.q + '</span></div>' +
        '<div class="quiz-a">' + q.a + '</div></div>';
    }).join('');

    const hay = [
      c.title, c.alias, c.oneLine, c.why,
      (c.concepts || []).map(x => x.t + ' ' + x.d).join(' '),
      (c.entries || []).map(x => x.name + ' ' + (x.note || '') + ' ' + (x.rows || []).map(r => r.a).join(' ')).join(' '),
      (c.traps || []).join(' '),
      (c.quiz || []).map(x => x.q + ' ' + x.a).join(' '),
      c.mnemonic || ''
    ].join(' ').replace(/<[^>]+>/g, ' ').toLowerCase();

    return '<details class="chapter" id="ch' + c.num + '" data-num="' + c.num + '" data-hay="' + hay.replace(/"/g, '&quot;') + '">' +
      '<summary class="ch-head">' +
      '<div class="ch-num">' + String(c.num).padStart(2, '0') + '</div>' +
      '<div class="ch-title-wrap"><h3 class="ch-title">' + c.title + '</h3>' +
      '<div class="ch-meta"><span>' + c.alias + '</span>' +
      '<span class="tag">' + c.weight + '</span>' +
      (c.hot ? '<span class="tag hot">高频</span>' : '') +
      '<span>' + diffLabel(c.stars) + ' ' + stars(c.stars) + '</span>' +
      '</div></div>' +
      '<label class="ch-done" title="标记已掌握"><span class="tag ok" style="cursor:pointer">' +
      '<input type="checkbox" data-c="' + c.num + '"' + done + ' style="margin-right:4px;vertical-align:-1px">已掌握</span></label>' +
      '<div class="ch-caret">▶</div>' +
      '</summary>' +
      '<div class="ch-body">' +
      '<div class="ch-oneline">' + c.oneLine + '</div>' +
      (c.why ? '<p style="font-size:14px;color:var(--ink-3);margin:-6px 0 8px">为什么要学好这章：' + c.why + '</p>' : '') +
      '<div class="sub-h">核心概念 · 人话版</div><div>' + concepts + '</div>' +
      (entries ? '<div class="sub-h">必背分录模板</div><div class="entries">' + entries + '</div>' : '') +
      (traps ? '<div class="sub-h">踩过的坑</div><ul class="traps">' + traps + '</ul>' : '') +
      (quiz ? '<div class="sub-h">自测（点一下看答案）</div><div class="quiz">' + quiz + '</div>' : '') +
      (c.mnemonic ? '<div class="mnemonic">' + c.mnemonic + '</div>' : '') +
      '</div></details>';
  }

  function renderChapters() {
    const list = $('#chapterList');
    if (!list) return;

    /* 目录芯片 */
    const chips = $('#chChips');
    if (chips) {
      chips.innerHTML = CHAPTERS.map(c =>
        '<a class="pill" href="#ch' + c.num + '"><b>' + String(c.num).padStart(2, '0') + '</b> ' + c.title + '</a>'
      ).join('');
    }

    list.innerHTML = CHAPTERS.map(chapterHTML).join('');

    /* 已掌握勾选 */
    $$('input[data-c]', list).forEach(function (cb) {
      cb.addEventListener('click', function (e) { e.stopPropagation(); });
      cb.addEventListener('change', function () {
        const s = getChapterState();
        const k = 'c' + cb.getAttribute('data-c');
        if (cb.checked) s[k] = 1; else delete s[k];
        store.set('fa.chapters.v1', s);
        paintBars();
      });
    });

    /* 自测点开 */
    $$('.quiz-q', list).forEach(function (q) {
      q.addEventListener('click', function () {
        q.parentNode.classList.toggle('open');
      });
    });

    /* 搜索 */
    const input = $('#chSearch');
    const empty = $('#chEmpty');
    if (input) {
      let t = null;
      input.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          const q = input.value.trim().toLowerCase();
          let hit = 0;
          $$('.chapter', list).forEach(function (el) {
            const ok = !q || (el.getAttribute('data-hay') || '').indexOf(q) >= 0;
            el.classList.toggle('hide', !ok);
            if (ok) { hit++; if (q.length >= 2) el.open = true; }
          });
          if (empty) empty.classList.toggle('hide', hit > 0);
        }, 120);
      });
    }

    const btnOpen = $('#btnOpenAll'), btnClose = $('#btnCloseAll');
    if (btnOpen) btnOpen.addEventListener('click', () => $$('.chapter', list).forEach(el => { el.open = true; }));
    if (btnClose) btnClose.addEventListener('click', () => $$('.chapter', list).forEach(el => { el.open = false; }));

    paintBars();
  }

  /* ---------------- 计划表 ---------------- */
  function renderPlan() {
    const box = $('#planList');
    if (!box) return;
    const ps = getPlanState();
    let html = '';
    let weekNo = 0;

    PLAN.forEach(function (phase) {
      html += '<div class="phase"><span class="phase-badge">' + phase.id + '</span>' +
        '<h2>' + phase.title + '</h2><span class="phase-note">' + (phase.note || '') + '</span></div>';

      (phase.weeks || []).forEach(function (w) {
        weekNo++;
        const s = w._startIdx;
        const e = s + w._len - 1;
        const startD = ALL_DAYS[s].date;
        const endD = ALL_DAYS[e].date;
        const isNow = todayIdx >= s && todayIdx <= e;

        let days = '';
        for (let i = 0; i < w._len; i++) {
          const d = ALL_DAYS[s + i];
          const key = 'd' + d.idx;
          const checked = ps[key] ? ' checked' : '';
          const isToday = d.idx === todayIdx;
          days += '<div class="day">' +
            '<div class="day-lab"><b>' + fmtMD(d.date) + '</b>' + WD[d.date.getDay()] + '</div>' +
            '<label class="check"><input type="checkbox" data-k="' + key + '"' + checked + '>' +
            '<span class="box"></span><span class="day-txt"' + (isToday ? ' style="font-weight:700"' : '') + '>' +
            (isToday ? '今天 · ' : '') + d.t + (d.d ? '<em>' + d.d + '</em>' : '') + '</span></label></div>';
        }

        html += '<details class="week' + (isNow ? ' now' : '') + '"' + (isNow ? ' open' : '') + '>' +
          '<summary class="week-head">' +
          '<span class="week-no">第 ' + weekNo + ' 周</span>' +
          '<span class="week-theme">' + w.theme + '</span>' +
          '<span class="week-range">' + fmtMD(startD) + ' – ' + fmtMD(endD) + '</span>' +
          '</summary>' +
          '<div class="week-body">' +
          '<p class="week-goal"><b>本周目标：</b>' + w.goal + (w.hours ? ' <span class="tag">' + w.hours + '</span>' : '') + '</p>' +
          days + '</div></details>';
      });
    });

    box.innerHTML = html;

    $$('input[data-k]', box).forEach(function (cb) {
      cb.addEventListener('change', function () {
        const s2 = getPlanState();
        const k = cb.getAttribute('data-k');
        if (cb.checked) s2[k] = 1; else delete s2[k];
        store.set('fa.plan.v1', s2);
        paintBars();
      });
    });

    paintBars();
  }

  /* ---------------- 速查页 ---------------- */
  function renderCheat() {
    const box = $('#cheatList');
    if (!box) return;
    box.innerHTML = CHEAT.map(function (sec) {
      let body = '';

      (sec.tables || []).forEach(function (tb) {
        const head = '<tr>' + tb.head.map(h => '<th>' + h + '</th>').join('') + '</tr>';
        const rows = tb.rows.map(function (r) {
          return '<tr>' + r.map(function (cell, i) {
            return '<td' + (i === 0 ? ' class="k"' : '') + '>' + cell + '</td>';
          }).join('') + '</tr>';
        }).join('');
        body += '<table class="cheat-table" style="margin:6px 0 18px">' + head + rows + '</table>';
      });

      (sec.formulas || []).forEach(function (f) {
        body += '<div style="margin:14px 0">' +
          '<div style="font-weight:700;font-size:14.5px;margin-bottom:2px">' + f.name + '</div>' +
          '<div class="formula">' + f.f + '</div>' +
          (f.note ? '<div style="font-size:13px;color:var(--ink-3)">' + f.note + '</div>' : '') +
          '</div>';
      });

      if (sec.list && sec.list.length) {
        body += '<ul class="list-clean">' + sec.list.map(x => '<li>' + x + '</li>').join('') + '</ul>';
      }

      return '<section id="' + sec.id + '"><div class="section-head"><h2>' + sec.title + '</h2>' +
        '<span class="sub">' + (sec.note || '') + '</span></div>' +
        '<div class="card" style="padding:20px 22px">' + body + '</div></section>';
    }).join('');
  }

  /* ---------------- 习惯卡 ---------------- */
  function renderHabits() {
    const box = $('#habitList');
    if (!box) return;
    box.innerHTML = HABITS.map(function (h, i) {
      return '<div class="entry" style="cursor:default">' +
        '<div class="entry-ico">' + (i + 1) + '</div>' +
        '<h3>' + h.t + '</h3><p>' + h.d + '</p></div>';
    }).join('');
  }

  /* ---------------- 通用 ---------------- */
  function initNav() {
    const page = document.body.getAttribute('data-page');
    $$('.nav a').forEach(a => {
      if (a.getAttribute('data-nav') === page) a.classList.add('active');
    });
    const el = $('#examLabel');
    if (el && SITE.examLabel) el.textContent = SITE.examLabel;
    const bk = $('#bookLabel');
    if (bk && SITE.book) bk.textContent = SITE.book;
    if (SITE.sub) {
      $$('.brand span:last-child').forEach(function (s) {
        if (s.textContent === '中级财务会计学' && SITE.title) s.textContent = SITE.title;
      });
    }
  }

  function initBackTop() {
    const btn = $('#backTop');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.classList.toggle('show', window.scrollY > 500);
    }, { passive: true });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initPrint() {
    $$('[data-print]').forEach(function (b) {
      b.addEventListener('click', function () { window.print(); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initBackTop();
    initPrint();
    renderCountdown();
    renderToday();
    renderChapters();
    renderPlan();
    renderCheat();
    renderHabits();
    paintBars();
  });

  /* 供打印前展开全部 */
  window.FA = {
    expandAll: function () {
      $$('details').forEach(d => { d.open = true; });
      $$('.quiz-item').forEach(q => q.classList.add('open'));
    },
    reset: function () {
      if (!confirm('清空所有勾选进度？')) return;
      localStorage.removeItem('fa.chapters.v1');
      localStorage.removeItem('fa.plan.v1');
      location.reload();
    }
  };
})();
