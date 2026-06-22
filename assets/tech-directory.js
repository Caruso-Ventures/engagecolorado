/* Engage Colorado — Colorado Tech Directory interactivity */
(function () {
  "use strict";

  let companies = window.EC_TECH_COMPANIES || [];
  let tickerStats = window.EC_TECH_STATS || [];

  // Logical stage order: early → late → exits
  const STAGE_ORDER = [
    "Pre-Seed", "Seed", "Convertible Note",
    "Series A", "Series B", "Series C", "Series D", "Series E", "Series F",
    "Growth", "Late Stage", "Bootstrapped", "Public", "Acquired",
  ];

  const state = {
    searchQuery: "",
    activeStages: new Set(),
    activeIndustries: new Set(),
    stageMenuOpen: false,
    industryMenuOpen: false,
    acOpen: false,
    acActiveIdx: -1,
    highlightedFirm: null,
    expandedCards: new Set(),
  };

  // DOM refs
  const tickerTrack      = document.getElementById("idTickerTrack");
  const stageListEl      = document.getElementById("idStageList");
  const stageBtn         = document.getElementById("idStageBtn");
  const stageBtnLabel    = document.getElementById("idStageBtnLabel");
  const stageMenu        = document.getElementById("idStageMenu");
  const stageClear       = document.getElementById("idStageClear");
  const stageWrapper     = document.getElementById("idStageWrapper");
  const industryListEl   = document.getElementById("idSectorList");
  const industryBtn      = document.getElementById("idSectorBtn");
  const industryBtnLabel = document.getElementById("idSectorBtnLabel");
  const industryMenu     = document.getElementById("idSectorMenu");
  const industryClear    = document.getElementById("idSectorClear");
  const industryWrapper  = document.getElementById("idSectorWrapper");
  const searchInput      = document.getElementById("idSearchInput");
  const searchWrapper    = document.getElementById("idSearchWrapper");
  const acDropdown       = document.getElementById("idAutocomplete");
  const resultCountEl    = document.getElementById("idResultCount");
  const shownCountEl     = document.getElementById("idShownCount");
  const firmsContainer   = document.getElementById("idFirmsContainer");
  const clearAllBtn      = document.getElementById("idClearAll");

  // ── Ticker ──
  function buildTicker() {
    const itemHtml = tickerStats
      .map((s, i) => {
        const divider = i > 0 ? '<div class="id-ticker-divider"></div>' : "";
        return `${divider}<div class="id-ticker-item"><span class="id-ticker-value">${s.value}</span><span class="id-ticker-label">${escapeHtml(s.label)}</span></div>`;
      })
      .join("");
    tickerTrack.innerHTML = itemHtml + itemHtml;
  }

  // ── Stage dropdown ──
  let allStages = STAGE_ORDER.filter((s) =>
    new Set(companies.map((co) => co.stage).filter(Boolean)).has(s)
  );

  function buildStageMenu() {
    stageListEl.innerHTML = allStages
      .map(
        (stage) =>
          `<label class="id-sector-option" data-sector="${escapeAttr(stage)}">
            <input type="checkbox" />
            <span class="id-sector-option-label">${escapeHtml(stage)}</span>
          </label>`
      )
      .join("");

    stageListEl.querySelectorAll(".id-sector-option").forEach((label) => {
      label.addEventListener("click", (e) => {
        const stage = label.getAttribute("data-sector");
        if (e.target.tagName !== "INPUT") {
          const input = label.querySelector("input");
          input.checked = !input.checked;
        }
        if (state.activeStages.has(stage)) state.activeStages.delete(stage);
        else state.activeStages.add(stage);
        renderStageMenu();
        renderStageBtn();
        renderFirms();
      });
    });
  }

  function renderStageMenu() {
    stageListEl.querySelectorAll(".id-sector-option").forEach((label) => {
      const stage = label.getAttribute("data-sector");
      const checked = state.activeStages.has(stage);
      label.classList.toggle("checked", checked);
      const input = label.querySelector("input");
      if (input.checked !== checked) input.checked = checked;
    });
  }

  function renderStageBtn() {
    const count = state.activeStages.size;
    stageBtnLabel.textContent = count > 0 ? `Stage (${count}) ` : "Stage ";
    stageBtn.classList.toggle("has-selection", count > 0);
    stageBtn.classList.toggle("open", state.stageMenuOpen);
    stageMenu.classList.toggle("open", state.stageMenuOpen);
    stageBtn.setAttribute("aria-expanded", state.stageMenuOpen ? "true" : "false");
  }

  // ── Industry dropdown ──
  let allIndustries = [...new Set(companies.map((co) => co.industry).filter(Boolean))].sort();

  function buildIndustryMenu() {
    industryListEl.innerHTML = allIndustries
      .map(
        (industry) =>
          `<label class="id-sector-option" data-sector="${escapeAttr(industry)}">
            <input type="checkbox" />
            <span class="id-sector-option-label">${escapeHtml(industry)}</span>
          </label>`
      )
      .join("");

    industryListEl.querySelectorAll(".id-sector-option").forEach((label) => {
      label.addEventListener("click", (e) => {
        const industry = label.getAttribute("data-sector");
        if (e.target.tagName !== "INPUT") {
          const input = label.querySelector("input");
          input.checked = !input.checked;
        }
        if (state.activeIndustries.has(industry)) state.activeIndustries.delete(industry);
        else state.activeIndustries.add(industry);
        renderIndustryMenu();
        renderIndustryBtn();
        renderFirms();
      });
    });
  }

  function renderIndustryMenu() {
    industryListEl.querySelectorAll(".id-sector-option").forEach((label) => {
      const industry = label.getAttribute("data-sector");
      const checked = state.activeIndustries.has(industry);
      label.classList.toggle("checked", checked);
      const input = label.querySelector("input");
      if (input.checked !== checked) input.checked = checked;
    });
  }

  function renderIndustryBtn() {
    const count = state.activeIndustries.size;
    industryBtnLabel.textContent = count > 0 ? `Industry (${count}) ` : "Industry ";
    industryBtn.classList.toggle("has-selection", count > 0);
    industryBtn.classList.toggle("open", state.industryMenuOpen);
    industryMenu.classList.toggle("open", state.industryMenuOpen);
    industryBtn.setAttribute("aria-expanded", state.industryMenuOpen ? "true" : "false");
  }

  // ── Filtering ──
  function matchesCompany(co) {
    const q = state.searchQuery.toLowerCase();
    const peopleText = Array.isArray(co.people)
      ? co.people.map((p) => `${p.name} ${p.role}`).join(" ")
      : "";
    const investorText = Array.isArray(co.investors) ? co.investors.join(" ") : "";
    const textMatch =
      !q ||
      [
        co.name, co.city, co.description, co.industry, co.stage,
        co.lastFundedRound, co.exitAcquirer, co.ipoSymbol, peopleText, investorText,
      ].some((t) => t && String(t).toLowerCase().includes(q));
    const stageMatch =
      state.activeStages.size === 0 || state.activeStages.has(co.stage);
    const industryMatch =
      state.activeIndustries.size === 0 || state.activeIndustries.has(co.industry);
    return textMatch && stageMatch && industryMatch;
  }

  function getFiltered() {
    return companies.filter(matchesCompany);
  }

  // ── Render cards ──
  function renderFirms() {
    const filtered = getFiltered();
    resultCountEl.textContent = `${filtered.length} compan${filtered.length !== 1 ? "ies" : "y"}`;
    shownCountEl.textContent = `${filtered.length} shown`;

    if (filtered.length === 0) {
      firmsContainer.innerHTML = `
        <div class="id-empty-state">
          <svg class="id-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <h3>No companies found</h3>
          <p>Try a different search term or clear the filters.</p>
        </div>`;
      return;
    }

    firmsContainer.innerHTML = `
      <div class="id-firms-grid">
        ${filtered.map((co) => companyCardHtml(co)).join("")}
      </div>`;

    // Inject "Read more" only where it's useful — the description overflows its
    // 3-line clamp, or the card has expandable extras (IPO / exit / investors).
    // The toggle reveals both the full description and the extras block.
    requestAnimationFrame(() => {
      firmsContainer.querySelectorAll(".id-firm-card").forEach((card) => {
        const name = card.getAttribute("data-firm");
        const desc = card.querySelector(".id-card-description");
        const extras = card.querySelector(".id-card-extras");
        if (!desc) return;
        const overflowing = desc.scrollHeight > desc.clientHeight + 2;
        if (!extras && !overflowing) return;

        const btn = document.createElement("button");
        btn.className = "id-read-more-btn";
        btn.type = "button";
        const apply = (exp) => {
          desc.classList.toggle("collapsed", !exp);
          if (extras) extras.classList.toggle("is-expanded", exp);
          btn.textContent = exp ? "Read less" : "Read more";
        };
        apply(state.expandedCards.has(name));
        btn.addEventListener("click", () => {
          const next = !state.expandedCards.has(name);
          if (next) state.expandedCards.add(name);
          else state.expandedCards.delete(name);
          apply(next);
        });
        desc.insertAdjacentElement("afterend", btn);
      });
    });

    if (state.highlightedFirm) {
      const sel = firmsContainer.querySelector(
        `.id-firm-card[data-firm="${cssEscape(state.highlightedFirm)}"]`
      );
      if (sel) sel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // ── Card sub-renderers (mirror cv_website tech directory) ──
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // "YYYY" / "YYYY-MM" / "YYYY-MM-DD" -> "Mon YYYY" (or bare year).
  function formatFundedDate(s) {
    if (!s) return "";
    const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(s));
    if (!m) return String(s);
    if (!m[2]) return m[1];
    return `${MONTHS[parseInt(m[2], 10) - 1] || ""} ${m[1]}`;
  }

  // Only surface a funding pill for reasonably recent rounds (2024+).
  function fundingIsRecent(co) {
    if (!co.lastFundedDate) return false;
    return parseInt(String(co.lastFundedDate).slice(0, 4), 10) >= 2024;
  }

  function renderFunding(co) {
    const recent = fundingIsRecent(co);
    const hasValuation = !!co.valuation;
    if (!recent && !hasValuation) return "";
    const out = [];
    if (recent) {
      const date = formatFundedDate(co.lastFundedDate);
      const round = co.lastFundedRound || "";
      const amt = co.lastFundedAmount ? ` &middot; ${escapeHtml(co.lastFundedAmount)}` : "";
      const label = date
        ? `${escapeHtml(round)}${round && date ? " " : ""}${escapeHtml(date)}`
        : escapeHtml(round);
      out.push(`<span class="id-funding-pill" title="Most recent funding round">${label}${amt}</span>`);
    }
    if (hasValuation) {
      out.push(`<span class="id-funding-pill is-valuation" title="Last known valuation">${escapeHtml(co.valuation)} valuation</span>`);
    }
    return out.join("");
  }

  // Stage pill is redundant when the funding pill already shows the same round.
  function renderStagePill(co) {
    if (fundingIsRecent(co) && co.lastFundedRound && co.lastFundedRound === co.stage) return "";
    return co.stage ? `<span>${escapeHtml(co.stage)}</span>` : "";
  }

  function renderStatusPills(co) {
    const out = [];
    if (co.ipoSymbol || co.ipoDate) {
      out.push(`<span class="id-status-pill is-ipo" title="Publicly traded company"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>IPO${co.ipoSymbol ? ` &middot; ${escapeHtml(co.ipoSymbol)}` : ""}</span>`);
    }
    if (co.exitAcquirer) {
      out.push(`<span class="id-status-pill is-exit" title="Successful exit / acquisition"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>Exit</span>`);
    }
    return out.join("");
  }

  // Expanded details: IPO breakdown, Exit breakdown, Major Investors.
  function renderExtras(co) {
    const blocks = [];
    if (co.ipoSymbol || co.ipoDate || co.ipoValuation || co.ipoExchange) {
      const rows = [];
      if (co.ipoDate) rows.push(`<dt>Date</dt><dd>${escapeHtml(formatFundedDate(co.ipoDate))}</dd>`);
      if (co.ipoSymbol) {
        const exch = co.ipoExchange ? ` (${escapeHtml(co.ipoExchange)})` : "";
        rows.push(`<dt>Symbol</dt><dd>${escapeHtml(co.ipoSymbol)}${exch}</dd>`);
      } else if (co.ipoExchange) {
        rows.push(`<dt>Exchange</dt><dd>${escapeHtml(co.ipoExchange)}</dd>`);
      }
      if (co.ipoValuation) rows.push(`<dt>IPO Valuation</dt><dd>${escapeHtml(co.ipoValuation)}</dd>`);
      if (rows.length) blocks.push(`<div><span class="id-card-extras-block-label">IPO</span><dl>${rows.join("")}</dl></div>`);
    }
    if (co.exitAcquirer || co.exitDate || co.exitValuation) {
      const rows = [];
      if (co.exitDate) rows.push(`<dt>Date</dt><dd>${escapeHtml(formatFundedDate(co.exitDate))}</dd>`);
      if (co.exitAcquirer) rows.push(`<dt>Acquirer</dt><dd>${escapeHtml(co.exitAcquirer)}</dd>`);
      if (co.exitValuation) rows.push(`<dt>Valuation</dt><dd>${escapeHtml(co.exitValuation)}</dd>`);
      if (rows.length) blocks.push(`<div><span class="id-card-extras-block-label">Successful Exit</span><dl>${rows.join("")}</dl></div>`);
    }
    if (Array.isArray(co.investors) && co.investors.length) {
      const items = co.investors.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
      blocks.push(`<div><span class="id-card-extras-block-label">Major Investors</span><ul class="id-investor-list">${items}</ul></div>`);
    }
    if (!blocks.length) return "";
    return `<div class="id-card-extras">${blocks.join("")}</div>`;
  }

  function renderLinks(co) {
    const items = [];
    if (co.website) {
      items.push(`<a class="id-card-link" href="${escapeHtml(co.website)}" target="_blank" rel="noopener noreferrer" aria-label="Visit ${escapeHtml(co.name)} website"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>Website</a>`);
    }
    if (co.linkedin) {
      items.push(`<a class="id-card-link is-linkedin" href="${escapeHtml(co.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="Visit ${escapeHtml(co.name)} on LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.26 2.36 4.26 5.43v6.31zM5.34 7.43a2.06 2.06 0 11.01-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.21 0 22.23 0z"/></svg>LinkedIn</a>`);
    }
    if (!items.length) return "";
    return `<div class="id-card-links">${items.join("")}</div>`;
  }

  function renderPeople(people) {
    if (!Array.isArray(people) || people.length === 0) return "";
    const items = people
      .map(
        (p) =>
          `<li><span class="id-person-name">${escapeHtml(p.name)}</span>${p.role ? `<span class="id-person-role">${escapeHtml(p.role)}</span>` : ""}</li>`
      )
      .join("");
    return `<div class="id-card-people"><span class="id-card-people-label">Key People</span><ul>${items}</ul></div>`;
  }

  function companyCardHtml(co) {
    const highlight = state.highlightedFirm === co.name;
    const badges = [];
    if (co.isPortfolio) badges.push(`<span class="id-portfolio-badge" title="Caruso Ventures portfolio company" aria-label="Caruso Ventures portfolio company"><img src="/assets/caruso-ventures-logo.webp" alt="Caruso Ventures portfolio company" /></span>`);
    if (co.isEndeavor) badges.push(`<span class="id-portfolio-badge is-endeavor-badge" title="Endeavor Colorado company" aria-label="Endeavor Colorado company"><img src="/assets/endeavor-colorado-logo.png" alt="Endeavor Colorado company" /></span>`);
    const cardClasses = [
      "id-firm-card",
      highlight ? "highlight" : "",
      co.isPortfolio ? "is-portfolio" : "",
      co.isEndeavor ? "is-endeavor" : "",
      badges.length === 2 ? "has-two-badges" : "",
    ].filter(Boolean).join(" ");

    return `
      <div class="${cardClasses}" data-firm="${escapeAttr(co.name)}">
        ${badges.length ? `<div class="id-badge-row">${badges.join("")}</div>` : ""}
        <div class="id-card-header">
          <h3 class="id-card-firm-name">${escapeHtml(co.name)}</h3>
          <div class="id-card-location">${escapeHtml(co.city)}${co.founded ? " &middot; Est. " + escapeHtml(String(co.founded)) : ""}</div>
        </div>
        <div class="id-card-details">
          <span>${escapeHtml(co.industry)}</span>
          ${renderStagePill(co)}
          ${co.size ? `<span>${escapeHtml(co.size)} employees</span>` : ""}
          ${renderStatusPills(co)}
          ${renderFunding(co)}
        </div>
        <div class="id-card-body">
          <div class="id-card-description collapsed">${escapeHtml(co.description)}</div>
          ${renderExtras(co)}
          ${renderLinks(co)}
        </div>
        ${renderPeople(co.people)}
      </div>`;
  }

  // ── Autocomplete ──
  function getSuggestions() {
    if (!state.searchQuery) return [];
    const lower = state.searchQuery.toLowerCase();
    const startsWith = companies.filter((co) => co.name.toLowerCase().startsWith(lower));
    const includes = companies.filter(
      (co) => !co.name.toLowerCase().startsWith(lower) && co.name.toLowerCase().includes(lower)
    );
    return startsWith.concat(includes).slice(0, 8);
  }

  function renderAutocomplete() {
    const suggestions = getSuggestions();
    if (!state.acOpen || suggestions.length === 0) {
      acDropdown.classList.remove("open");
      acDropdown.innerHTML = "";
      return;
    }
    acDropdown.innerHTML = suggestions
      .map(
        (co, i) =>
          `<div class="id-ac-item${i === state.acActiveIdx ? " active" : ""}" data-name="${escapeAttr(co.name)}"><span class="id-ac-name">${escapeHtml(co.name)}</span><span class="id-ac-meta">${escapeHtml(co.city)}</span></div>`
      )
      .join("");
    acDropdown.classList.add("open");
    acDropdown.querySelectorAll(".id-ac-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectSuggestion(el.getAttribute("data-name"));
      });
    });
  }

  function selectSuggestion(name) {
    state.searchQuery = name;
    searchInput.value = name;
    state.acOpen = false;
    state.highlightedFirm = name;
    renderAutocomplete();
    renderFirms();
    setTimeout(() => {
      state.highlightedFirm = null;
      const card = firmsContainer.querySelector(`.id-firm-card[data-firm="${cssEscape(name)}"]`);
      if (card) card.classList.remove("highlight");
    }, 2000);
  }

  // ── Events ──
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    state.acOpen = !!e.target.value;
    state.acActiveIdx = -1;
    renderAutocomplete();
    renderFirms();
  });

  searchInput.addEventListener("keydown", (e) => {
    const suggestions = getSuggestions();
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.acActiveIdx = Math.min(state.acActiveIdx + 1, suggestions.length - 1);
      renderAutocomplete();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.acActiveIdx = Math.max(state.acActiveIdx - 1, 0);
      renderAutocomplete();
    } else if (e.key === "Enter" && state.acActiveIdx >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[state.acActiveIdx].name);
    } else if (e.key === "Escape") {
      state.acOpen = false;
      renderAutocomplete();
    }
  });

  stageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    state.stageMenuOpen = !state.stageMenuOpen;
    if (state.industryMenuOpen) { state.industryMenuOpen = false; renderIndustryBtn(); }
    renderStageBtn();
  });

  stageClear.addEventListener("click", (e) => {
    e.stopPropagation();
    state.activeStages.clear();
    renderStageMenu();
    renderStageBtn();
    renderFirms();
  });

  industryBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    state.industryMenuOpen = !state.industryMenuOpen;
    if (state.stageMenuOpen) { state.stageMenuOpen = false; renderStageBtn(); }
    renderIndustryBtn();
  });

  industryClear.addEventListener("click", (e) => {
    e.stopPropagation();
    state.activeIndustries.clear();
    renderIndustryMenu();
    renderIndustryBtn();
    renderFirms();
  });

  clearAllBtn.addEventListener("click", () => {
    state.searchQuery = "";
    searchInput.value = "";
    state.activeStages.clear();
    state.activeIndustries.clear();
    state.acOpen = false;
    state.highlightedFirm = null;
    renderStageMenu();
    renderStageBtn();
    renderIndustryMenu();
    renderIndustryBtn();
    renderAutocomplete();
    renderFirms();
  });

  document.addEventListener("click", (e) => {
    if (searchWrapper && !searchWrapper.contains(e.target)) {
      state.acOpen = false;
      renderAutocomplete();
    }
    if (stageWrapper && !stageWrapper.contains(e.target)) {
      if (state.stageMenuOpen) { state.stageMenuOpen = false; renderStageBtn(); }
    }
    if (industryWrapper && !industryWrapper.contains(e.target)) {
      if (state.industryMenuOpen) { state.industryMenuOpen = false; renderIndustryBtn(); }
    }
  });

  // ── Helpers ──
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(str) { return escapeHtml(str); }
  function cssEscape(str) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(str);
    return String(str).replace(/["\\]/g, "\\$&");
  }

  // ── Live data from Supabase (mirrors cv_website tech directory) ──
  // Recomputes the ticker stats the same way scripts/pull-tech-directory.mjs
  // does, so the headline numbers stay accurate to the live dataset.
  function computeTickerStats() {
    const cityCount = new Set(companies.map((co) => co.city).filter(Boolean)).size;
    const industryCount = new Set(companies.map((co) => co.industry).filter(Boolean)).size;
    const industryCounts = {};
    for (const co of companies) {
      if (co.industry) industryCounts[co.industry] = (industryCounts[co.industry] || 0) + 1;
    }
    const top = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const stats = [
      { value: String(companies.length), label: "Colorado Companies" },
      { value: String(cityCount), label: "Cities Represented" },
      { value: String(industryCount), label: "Tech Industries" },
    ];
    for (const [label, count] of top) stats.push({ value: String(count), label });
    return stats;
  }

  function replaceCompanies(next) {
    if (!Array.isArray(next) || next.length === 0) return;
    companies = next;
    tickerStats = computeTickerStats();
    allStages = STAGE_ORDER.filter((s) =>
      new Set(companies.map((co) => co.stage).filter(Boolean)).has(s)
    );
    allIndustries = [...new Set(companies.map((co) => co.industry).filter(Boolean))].sort();
    // Rebuild menus so newly-seen stages/industries appear; renderStageMenu /
    // renderIndustryMenu restore checkbox state from the active-selection Sets.
    buildTicker();
    buildStageMenu();
    renderStageMenu();
    renderStageBtn();
    buildIndustryMenu();
    renderIndustryMenu();
    renderIndustryBtn();
    state.acOpen = false;
    if (acDropdown) acDropdown.classList.remove("open");
    renderFirms();
  }

  // ── Init ──
  buildTicker();
  buildStageMenu();
  renderStageBtn();
  buildIndustryMenu();
  renderIndustryBtn();
  renderFirms();

  // The Supabase module is <script type="module"> and may resolve after this
  // classic script runs, so poll briefly for ECFetchCompanies to appear.
  function startLiveSync() {
    if (typeof window.ECFetchCompanies !== "function") return false;
    window.ECFetchCompanies()
      .then(replaceCompanies)
      .catch((err) => console.error("EC: Supabase tech initial fetch failed", err));
    if (typeof window.ECSubscribeCompanies === "function") {
      window.ECSubscribeCompanies(replaceCompanies);
    }
    return true;
  }
  if (!startLiveSync()) {
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (startLiveSync() || tries > 40) clearInterval(interval);
    }, 50);
  }
})();
