/* Engage Colorado — Colorado Tech Directory interactivity */
(function () {
  "use strict";

  const companies = window.EC_TECH_COMPANIES || [];
  const tickerStats = window.EC_TECH_STATS || [];

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
  const dataStages = new Set(companies.map((co) => co.stage).filter(Boolean));
  const allStages = STAGE_ORDER.filter((s) => dataStages.has(s));

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
  const allIndustries = [...new Set(companies.map((co) => co.industry).filter(Boolean))].sort();

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
    const textMatch =
      !q ||
      [co.name, co.city, co.description, co.industry, co.stage, co.lastFundedRound].some(
        (t) => t && String(t).toLowerCase().includes(q)
      );
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

    firmsContainer.querySelectorAll(".id-read-more-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".id-firm-card");
        const name = card.getAttribute("data-firm");
        const desc = card.querySelector(".id-card-description");
        if (state.expandedCards.has(name)) {
          state.expandedCards.delete(name);
          desc.classList.add("collapsed");
          btn.textContent = "Read more";
        } else {
          state.expandedCards.add(name);
          desc.classList.remove("collapsed");
          btn.textContent = "Read less";
        }
      });
    });

    if (state.highlightedFirm) {
      const sel = firmsContainer.querySelector(
        `.id-firm-card[data-firm="${cssEscape(state.highlightedFirm)}"]`
      );
      if (sel) sel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function companyCardHtml(co) {
    const expanded = state.expandedCards.has(co.name);
    const highlight = state.highlightedFirm === co.name;
    const fundingParts = [co.lastFundedRound, co.lastFundedAmount, co.lastFundedDate].filter(Boolean);
    const fundingStr = fundingParts.length > 0 ? fundingParts.join(" · ") : null;
    return `
      <div class="id-firm-card${highlight ? " highlight" : ""}" data-firm="${escapeAttr(co.name)}">
        <div class="id-card-header">
          <h3 class="id-card-firm-name">${escapeHtml(co.name)}</h3>
          <div class="id-card-location">${escapeHtml(co.city)}${co.founded ? " &middot; Est. " + escapeHtml(String(co.founded)) : ""}</div>
        </div>
        <div class="id-card-details">
          <span>${escapeHtml(co.stage)}</span>
          ${co.size ? `<span>${escapeHtml(co.size)} employees</span>` : ""}
          <span>${escapeHtml(co.industry)}</span>
        </div>
        <div class="id-card-body">
          <div class="id-card-description${expanded ? "" : " collapsed"}">${escapeHtml(co.description)}</div>
          <button class="id-read-more-btn" type="button">${expanded ? "Read less" : "Read more"}</button>
        </div>
        ${
          fundingStr
            ? `<div class="id-card-portfolio"><span class="id-portfolio-label">Last Funded:</span> ${escapeHtml(fundingStr)}</div>`
            : ""
        }
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

  // ── Init ──
  buildTicker();
  buildStageMenu();
  renderStageBtn();
  buildIndustryMenu();
  renderIndustryBtn();
  renderFirms();
})();
