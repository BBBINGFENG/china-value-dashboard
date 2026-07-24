/* China Value Factor Models dashboard — rendering layer */
(function () {
  "use strict";

  const DATA = window.DASHBOARD_DATA;
  if (!DATA) {
    document.querySelector("main").innerHTML =
      "<div class='card'><h2>No data</h2><p>dashboard_data.js is missing — run scripts/27_build_website.py.</p></div>";
    return;
  }

  /* ---------- helpers ---------- */

  const css = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const pct = (x, digits = 2) =>
    x === null || x === undefined ? "–" : (x * 100).toFixed(digits) + "%";

  const num = (x, digits = 2) =>
    x === null || x === undefined ? "–" : Number(x).toFixed(digits);

  const signClass = (x) => (x > 0 ? "pos" : x < 0 ? "neg" : "");

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* ---------- chart defaults ---------- */

  Chart.defaults.font.family =
    'system-ui, -apple-system, "Segoe UI", sans-serif';
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = css("--muted");
  Chart.defaults.borderColor = css("--grid");
  Chart.defaults.animation = false;
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.boxHeight = 12;

  const GRID = { color: css("--grid"), drawTicks: false };
  const pctTick = (v) => (v * 100).toFixed(v >= 0.1 || v <= -0.1 ? 0 : 1) + "%";

  const tooltipPct = {
    callbacks: {
      label: (ctx) =>
        ` ${ctx.dataset.label || ""}: ${pct(ctx.parsed.y ?? ctx.parsed)}`.trim(),
    },
  };

  function lineChart(canvasId, labels, datasets, opts = {}) {
    const elc = document.getElementById(canvasId);
    if (!elc) return;
    new Chart(elc, {
      type: "line",
      data: { labels, datasets },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: datasets.length > 1 },
          tooltip: opts.tooltip || {},
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 8, maxRotation: 0 },
          },
          y: Object.assign(
            { grid: GRID, ticks: { maxTicksLimit: 6 } },
            opts.y || {}
          ),
        },
      },
    });
  }

  function barChart(canvasId, labels, datasets, opts = {}) {
    const elc = document.getElementById(canvasId);
    if (!elc) return;
    new Chart(elc, {
      type: "bar",
      data: { labels, datasets },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: !!opts.legend },
          tooltip: opts.tooltip || tooltipPct,
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: opts.maxXTicks || 12, maxRotation: 0 },
          },
          y: Object.assign(
            {
              grid: GRID,
              ticks: { maxTicksLimit: 6, callback: pctTick },
            },
            opts.y || {}
          ),
        },
      },
    });
  }

  const lineStyle = (color) => ({
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0,
  });

  /* 正/负极性配色（diverging 两极），live 月份降低不透明度区分来源 */
  function polarityColors(rows, alphaFn) {
    return rows.map((r) => {
      const base = r.ret >= 0 ? css("--pos") : css("--neg");
      const alpha = alphaFn ? alphaFn(r) : 1;
      return alpha >= 1 ? base : base + Math.round(alpha * 255).toString(16).padStart(2, "0");
    });
  }

  /* ---------- stat tiles ---------- */

  function renderStats(key, m) {
    const row = document.getElementById(`${key}-stat-row`);
    if (!row) return;
    row.innerHTML = "";
    const live = m.live_stats;
    const tiles = [];
    if (live) {
      tiles.push(
        ["Live total return", pct(live.total_return), `${live.start} → ${live.end}`, signClass(live.total_return)],
        ["Live annualized", pct(live.ann_return), `${live.n_periods} trading days`, signClass(live.ann_return)],
        ["Live Sharpe", num(live.sharpe), "annualized, rf ≈ 0", ""],
        ["Live max drawdown", pct(live.max_drawdown), "daily NAV", "neg"],
        ["Live volatility", pct(live.ann_vol), "annualized", ""],
        ["Daily win rate", pct(live.win_rate, 0), "live period", ""]
      );
    }
    const h = (m.hist_stats && m.hist_stats[0]) || null;
    const hf = m.hist_full_stats;
    if (h) {
      tiles.push([
        `Backtest ann. (${h.period})`, pct(h.ann_return),
        `Sharpe ${num(h.sharpe)} · maxDD ${pct(h.max_drawdown, 0)}`,
        signClass(h.ann_return),
      ]);
      if (m.hist_stats[1]) {
        const h2 = m.hist_stats[1];
        tiles.push([
          `Backtest ann. (${h2.period})`, pct(h2.ann_return),
          `Sharpe ${num(h2.sharpe)} · maxDD ${pct(h2.max_drawdown, 0)}`,
          signClass(h2.ann_return),
        ]);
      }
    } else if (hf) {
      tiles.push([
        "Backtest annualized", pct(hf.ann_return),
        `Sharpe ${num(hf.sharpe)} · maxDD ${pct(hf.max_drawdown, 0)}`,
        signClass(hf.ann_return),
      ]);
    }
    tiles.forEach(([label, value, sub, cls]) => {
      const t = el("div", "stat-tile");
      t.appendChild(el("div", "label", label));
      t.appendChild(el("div", `value ${cls}`, value));
      t.appendChild(el("div", "sub", sub));
      row.appendChild(t);
    });
  }

  /* ---------- tables ---------- */

  function fillTable(id, headers, rows) {
    const table = document.getElementById(id);
    if (!table) return;
    table.innerHTML = "";
    const thead = el("thead");
    const trh = el("tr");
    headers.forEach((h) => trh.appendChild(el("th", "", h)));
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = el("tbody");
    rows.forEach((cells) => {
      const tr = el("tr");
      cells.forEach((c) => {
        const td = el("td", c.cls || "", c.html);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function holdingsRows(list) {
    return list.map((p) => [
      { html: p.ts_code },
      { html: p.name },
      { html: pct(Math.abs(p.weight)), cls: "" },
      { html: p.ep === null ? "–" : num(p.ep, 3) },
      { html: p.mom === null ? "–" : pct(p.mom, 0) },
    ]);
  }

  /* ---------- per-model rendering ---------- */

  function renderModel(key, m) {
    renderStats(key, m);

    if (m.live) {
      lineChart(`${key}-chart-live-nav`, m.live.dates, [
        Object.assign({ label: "NAV", data: m.live.nav }, lineStyle(css("--accent"))),
      ], {
        tooltip: { callbacks: { label: (c) => ` NAV ${num(c.parsed.y, 4)}` } },
      });

      const dd = m.live.drawdown;
      lineChart(`${key}-chart-live-dd`, m.live.dates, [
        Object.assign(
          { label: "Drawdown", data: dd, fill: true },
          lineStyle(css("--neg")),
          { backgroundColor: css("--neg") + "26" }
        ),
      ], { tooltip: tooltipPct, y: { ticks: { maxTicksLimit: 5, callback: pctTick } } });
    }

    if (m.hist_nav) {
      lineChart(`${key}-chart-hist-nav`, m.hist_nav.months, [
        Object.assign({ label: "NAV", data: m.hist_nav.nav }, lineStyle(css("--accent"))),
      ], {
        y: { type: "logarithmic", ticks: { maxTicksLimit: 6, callback: (v) => num(v, v < 3 ? 1 : 0) } },
        tooltip: { callbacks: { label: (c) => ` NAV ${num(c.parsed.y, 2)}` } },
      });
    }

    if (m.monthly_bars && m.monthly_bars.length) {
      const rows = m.monthly_bars;
      barChart(`${key}-chart-monthly`, rows.map((r) => r.month), [{
        label: "Monthly return",
        data: rows.map((r) => r.ret),
        backgroundColor: polarityColors(rows, (r) =>
          r.source === "live_partial" ? 0.35 : r.source === "live" ? 0.65 : 1),
        borderRadius: 4,
        maxBarThickness: 26,
      }], { maxXTicks: 8 });
    }

    if (m.annual_returns && m.annual_returns.length) {
      const rows = m.annual_returns;
      barChart(`${key}-chart-annual`, rows.map((r) => r.year + (r.partial ? "*" : "")), [{
        label: "Annual return",
        data: rows.map((r) => r.ret),
        backgroundColor: polarityColors(rows, (r) => (r.partial ? 0.55 : 1)),
        borderRadius: 4,
        maxBarThickness: 30,
      }], { maxXTicks: 27 });
    }

    // 最新月各因子收益
    const factorRows = m.factor_table
      .filter((f) => f.latest_month !== null)
      .map((f) => ({ factor: f.factor, ret: f.latest_month }));
    if (factorRows.length) {
      barChart(`${key}-chart-factor-month`, factorRows.map((r) => r.factor), [{
        label: "Latest month",
        data: factorRows.map((r) => r.ret),
        backgroundColor: polarityColors(factorRows),
        borderRadius: 4,
        maxBarThickness: 40,
      }]);
    }

    if (m.rebalance_history && m.rebalance_history.length) {
      barChart(`${key}-chart-turnover`, m.rebalance_history.map((r) => r.date), [{
        label: "Turnover",
        data: m.rebalance_history.map((r) => r.turnover),
        backgroundColor: css("--accent-2"),
        borderRadius: 4,
        maxBarThickness: 40,
      }], {
        tooltip: {
          callbacks: {
            label: (c) => {
              const r = m.rebalance_history[c.dataIndex];
              return ` turnover ${pct(r.turnover, 0)} · ${r.n_long} long / ${r.n_short} short`;
            },
          },
        },
      });
    }

    // 持仓
    if (m.holdings) {
      document.getElementById(`${key}-holdings-meta`).textContent =
        `rebalanced ${m.holdings.rebalance_date} · ${m.holdings.n_long} long / ${m.holdings.n_short} short positions`;
      const headers = ["Code", "Name", "|Weight|", "EP", "Mom 12-1"];
      fillTable(`${key}-table-long`, headers, holdingsRows(m.holdings.top_long));
      fillTable(`${key}-table-short`, headers, holdingsRows(m.holdings.top_short));
    }

    // 调仓变化
    if (m.changes) {
      const s = m.changes.summary;
      const box = document.getElementById(`${key}-changes-summary`);
      if (s) {
        box.innerHTML = "";
        const line = el("div", "changes-line");
        [
          ["Rebalance", m.changes.rebalance_date],
          ["New names", s.buy_count],
          ["Removed", s.sell_count],
          ["Held", s.hold_count],
          ["Turnover", pct(s.turnover, 0)],
          ["Cost drag", pct(s.cost_drag, 3)],
        ].forEach(([k, v]) => line.appendChild(el("span", "", `${k} <strong>${v}</strong>`)));
        box.appendChild(line);
      }
      const chHeaders = ["Code", "Name", "Δ weight", "New weight"];
      const chRow = (d) => [
        { html: d.ts_code },
        { html: d.name },
        { html: (d.delta >= 0 ? "+" : "") + pct(d.delta, 3), cls: signClass(d.delta) },
        { html: pct(d.new_weight, 3) },
      ];
      fillTable(`${key}-table-adds`, chHeaders, m.changes.top_adds.map(chRow));
      fillTable(`${key}-table-drops`, chHeaders, m.changes.top_drops.map(chRow));
    }

    // 因子表
    fillTable(`${key}-table-factors`,
      ["Factor", "", "Latest month", "Live cum.", "Hist. ann.", "Hist. Sharpe"],
      m.factor_table.map((f) => [
        { html: f.factor },
        { html: "" },
        { html: pct(f.latest_month), cls: signClass(f.latest_month) },
        { html: pct(f.live_cum), cls: signClass(f.live_cum) },
        { html: pct(f.hist_ann) },
        { html: num(f.hist_sharpe) },
      ]));

    // 显著性 t-stat 表
    if (m.significance && m.significance.length) {
      const tcell = (t, s) =>
        t === null || t === undefined
          ? { html: "–" }
          : { html: `${t.toFixed(2)}<sup>${s || ""}</sup>`, cls: Math.abs(t) >= 1.96 ? "" : "muted-cell" };
      fillTable(`${key}-table-significance`,
        ["Factor", "", "Full t", "In-sample t", "Out-sample t", "α vs model t"],
        m.significance.map((r) => [
          { html: r.factor },
          { html: "" },
          tcell(r.t_full, r.s_full),
          tcell(r.t_in, r.s_in),
          tcell(r.t_out, r.s_out),
          tcell(r.t_alpha, r.s_alpha),
        ]));
    }

    // 相关系数矩阵
    if (m.correlation && m.correlation.factors.length) {
      const { factors, matrix } = m.correlation;
      const table = document.getElementById(`${key}-table-corr`);
      table.innerHTML = "";
      const thead = el("thead");
      const trh = el("tr");
      trh.appendChild(el("th", "", ""));
      factors.forEach((f) => trh.appendChild(el("th", "", f)));
      thead.appendChild(trh);
      table.appendChild(thead);
      const tbody = el("tbody");
      matrix.forEach((row, i) => {
        const tr = el("tr");
        tr.appendChild(el("td", "", factors[i]));
        row.forEach((v, j) => {
          const td = el("td", "", i === j ? "1.00" : num(v));
          if (i !== j && Math.abs(v) >= 0.5) td.style.fontWeight = "650";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }
  }

  /* ---------- long-only ---------- */

  const loLabel = (n) => n.replace("Live_", "").replace(/_/g, " ");

  function renderLongOnly() {
    const lo = DATA.longonly;
    const names = Object.keys(lo.strategies);
    if (names.length) {
      const colors = [css("--accent"), css("--accent-2"), css("--accent-3"), css("--accent-4"), css("--accent-5")];
      // 用最长的日期轴
      let labels = [];
      names.forEach((n) => {
        if (lo.strategies[n].dates.length > labels.length) labels = lo.strategies[n].dates;
      });
      const datasets = names.map((n, i) => {
        const s = lo.strategies[n];
        const byDate = Object.fromEntries(s.dates.map((d, k) => [d, s.nav[k]]));
        return Object.assign(
          { label: loLabel(n), data: labels.map((d) => byDate[d] ?? null), spanGaps: true },
          lineStyle(colors[i % colors.length])
        );
      });
      lineChart("longonly-chart-nav", labels, datasets, {
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${num(c.parsed.y, 4)}` } },
      });
    }
    fillTable("longonly-table-stats",
      ["Strategy", "", "Total return", "Ann. vol", "Max drawdown", "Days"],
      lo.stats.map((s) => [
        { html: loLabel(s.strategy) },
        { html: "" },
        { html: pct(s.total_return), cls: signClass(s.total_return) },
        { html: pct(s.ann_vol) },
        { html: pct(s.max_drawdown) },
        { html: String(s.n_days) },
      ]));
  }

  /* ---------- factor evolution ---------- */

  let evoCharts = [];

  function renderEvolution(factor) {
    const re = DATA.risk_evolution;
    if (!re || !re.series[factor]) return;
    const s = re.series[factor];
    evoCharts.forEach((c) => c.destroy());
    evoCharts = [];

    const zeroLine = { borderColor: css("--baseline"), borderWidth: 1, borderDash: [4, 4], pointRadius: 0 };

    const mk = (canvasId, datasets, opts) => {
      const elc = document.getElementById(canvasId);
      if (!elc) return;
      const ch = new Chart(elc, {
        type: "line",
        data: { labels: s.dates, datasets },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: datasets.filter((d) => d.label).length > 1 } },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
            y: Object.assign({ grid: GRID, ticks: { maxTicksLimit: 6 } }, opts.y || {}),
          },
        },
      });
      evoCharts.push(ch);
    };

    // α: CAPM 实线 + CH-4 虚线（如有）
    const alphaDs = [
      Object.assign({ label: "α vs market", data: s.alpha }, lineStyle(css("--accent"))),
    ];
    if (s.alpha_ch4 && s.alpha_ch4.some((v) => v !== null)) {
      alphaDs.push(Object.assign(
        { label: "α vs CH-4", data: s.alpha_ch4, borderDash: [5, 4] },
        lineStyle(css("--accent-3"))
      ));
    }
    mk("evo-chart-alpha", alphaDs, { y: { ticks: { callback: (v) => v + "%" } } });
    mk("evo-chart-beta", [Object.assign({ label: "β", data: s.beta }, lineStyle(css("--accent-4")))], {});
    mk("evo-chart-sharpe", [Object.assign({ label: "Sharpe", data: s.sharpe }, lineStyle(css("--accent-2")))], {});
    mk("evo-chart-vol", [Object.assign({ label: "Vol", data: s.vol }, lineStyle(css("--accent-5")))],
      { y: { ticks: { callback: (v) => v + "%" } } });
  }

  function initEvolution() {
    const re = DATA.risk_evolution;
    const sel = document.getElementById("evo-factor");
    if (!re || !sel || !re.factors.length) return;
    re.factors.forEach((f) => {
      const o = document.createElement("option");
      o.value = f; o.textContent = f;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => renderEvolution(sel.value));
    renderEvolution(re.factors[0]);
  }

  /* ---------- tabs ---------- */

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
    });
  });

  /* ---------- boot ---------- */

  ["ch3", "ch4", "eight"].forEach((key) => renderModel(key, DATA.models[key]));
  renderLongOnly();
  initEvolution();

  // 图表颜色在渲染时从 CSS 变量读取；主题切换后重载让图表换用对应主题色
  window.matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => location.reload());
})();
