/* Engage Colorado — Investor Directory interactivity
   Vanilla JS port of cv_website/src/app/investor-directory/page.tsx */
(function () {
  "use strict";

  const investors = window.EC_INVESTORS || [];
  const tickerStats = window.EC_TICKER_STATS || [];

  const STAGES = [
    { label: "Pre Seed", value: "Pre Seed" },
    { label: "Seed", value: "Seed" },
    { label: "Series A", value: "Series A" },
    { label: "Series B", value: "Series B" },
    { label: "Growth Equity", value: "Growth equity" },
    { label: "Late Stage", value: "Late stage" },
  ];

  const state = {
    searchQuery: "",
    activeStages: new Set(),
    activeSectors: new Set(),
    sectorMenuOpen: false,
    acOpen: false,
    acActiveIdx: -1,
    highlightedFirm: null,
    expandedCards: new Set(),
  };

  // DOM refs
  const tickerTrack = document.getElementById("idTickerTrack");
  const stageChipsEl = document.getElementById("idStageChips");
  const sectorListEl = document.getElementById("idSectorList");
  const sectorBtn = document.getElementById("idSectorBtn");
  const sectorBtnLabel = document.getElementById("idSectorBtnLabel");
  const sectorMenu = document.getElementById("idSectorMenu");
  const sectorClear = document.getElementById("idSectorClear");
  const sectorWrapper = document.getElementById("idSectorWrapper");
  const searchInput = document.getElementById("idSearchInput");
  const searchWrapper = document.getElementById("idSearchWrapper");
  const acDropdown = document.getElementById("idAutocomplete");
  const resultCountEl = document.getElementById("idResultCount");
  const shownCountEl = document.getElementById("idShownCount");
  const firmsContainer = document.getElementById("idFirmsContainer");
  const clearAllBtn = document.getElementById("idClearAll");

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

  // ── Stage chips ──
  function buildStageChips() {
    stageChipsEl.innerHTML = STAGES.map(
      (s) =>
        `<button class="id-chip" data-stage="${escapeAttr(s.value)}">${escapeHtml(s.label)}</button>`
    ).join("");
    stageChipsEl.querySelectorAll(".id-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stage = btn.getAttribute("data-stage");
        if (state.activeStages.has(stage)) state.activeStages.delete(stage);
        else state.activeStages.add(stage);
        renderStageChips();
        renderFirms();
      });
    });
  }

  function renderStageChips() {
    stageChipsEl.querySelectorAll(".id-chip").forEach((btn) => {
      const stage = btn.getAttribute("data-stage");
      btn.classList.toggle("active", state.activeStages.has(stage));
    });
  }

  // ── Sector menu ──
  const allSectors = [...new Set(investors.flatMap((f) => f.sectors))].sort();

  function buildSectorMenu() {
    sectorListEl.innerHTML = allSectors
      .map(
        (sector) =>
          `<label class="id-sector-option" data-sector="${escapeAttr(sector)}">
            <input type="checkbox" />
            <span class="id-sector-option-label">${escapeHtml(sector)}</span>
          </label>`
      )
      .join("");

    sectorListEl.querySelectorAll(".id-sector-option").forEach((label) => {
      label.addEventListener("click", (e) => {
        // checkbox handles the click; prevent double-toggle when input itself is clicked
        const sector = label.getAttribute("data-sector");
        if (e.target.tagName !== "INPUT") {
          // toggle via input
          const input = label.querySelector("input");
          input.checked = !input.checked;
        }
        if (state.activeSectors.has(sector)) state.activeSectors.delete(sector);
        else state.activeSectors.add(sector);
        renderSectorMenu();
        renderSectorBtn();
        renderFirms();
      });
    });
  }

  function renderSectorMenu() {
    sectorListEl.querySelectorAll(".id-sector-option").forEach((label) => {
      const sector = label.getAttribute("data-sector");
      const checked = state.activeSectors.has(sector);
      label.classList.toggle("checked", checked);
      const input = label.querySelector("input");
      if (input.checked !== checked) input.checked = checked;
    });
  }

  function renderSectorBtn() {
    const count = state.activeSectors.size;
    sectorBtnLabel.textContent = count > 0 ? `Sectors (${count}) ` : "Sectors ";
    sectorBtn.classList.toggle("has-selection", count > 0);
    sectorBtn.classList.toggle("open", state.sectorMenuOpen);
    sectorMenu.classList.toggle("open", state.sectorMenuOpen);
    sectorBtn.setAttribute("aria-expanded", state.sectorMenuOpen ? "true" : "false");
  }

  // ── Filtering ──
  function matchesFirm(firm) {
    const q = state.searchQuery.toLowerCase();
    const textMatch =
      !q ||
      [firm.name, firm.hq, firm.description, ...firm.portfolio, ...firm.stages, ...firm.sectors].some(
        (t) => String(t).toLowerCase().includes(q)
      );
    const stageMatch =
      state.activeStages.size === 0 ||
      firm.stages.some((s) =>
        [...state.activeStages].some((a) => s.toLowerCase() === a.toLowerCase())
      );
    const sectorMatch =
      state.activeSectors.size === 0 ||
      firm.sectors.some((s) => state.activeSectors.has(s));
    return textMatch && stageMatch && sectorMatch;
  }

  function getFiltered() {
    return investors.filter(matchesFirm);
  }

  // ── Render firm cards ──
  function renderFirms() {
    const filtered = getFiltered();
    resultCountEl.textContent = `${filtered.length} firm${filtered.length !== 1 ? "s" : ""}`;
    shownCountEl.textContent = `${filtered.length} shown`;

    if (filtered.length === 0) {
      firmsContainer.innerHTML = `
        <div class="id-empty-state">
          <svg class="id-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <h3>No firms found</h3>
          <p>Try a different search term or clear the filters.</p>
        </div>`;
      return;
    }

    const cardsHtml = `
      <div class="id-firms-grid">
        ${filtered.map((firm) => firmCardHtml(firm)).join("")}
      </div>`;
    firmsContainer.innerHTML = cardsHtml;

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

  function firmCardHtml(firm) {
    const expanded = state.expandedCards.has(firm.name);
    const highlight = state.highlightedFirm === firm.name;
    const portfolioStr = firm.portfolio.slice(0, 4).join(", ");
    return `
      <div class="id-firm-card${highlight ? " highlight" : ""}" data-firm="${escapeAttr(firm.name)}">
        <div class="id-card-header">
          <h3 class="id-card-firm-name">${escapeHtml(firm.name)}</h3>
          <div class="id-card-location">${escapeHtml(firm.hq)} &middot; Est. ${escapeHtml(firm.founded)}</div>
        </div>
        <div class="id-card-details">
          <span>${escapeHtml(firm.stages.join(", "))}</span>
          <span>${escapeHtml(firm.checkSize)}</span>
          <span>${escapeHtml(firm.aum)} AUM</span>
        </div>
        <div class="id-card-body">
          <div class="id-card-description${expanded ? "" : " collapsed"}">${escapeHtml(firm.description)}</div>
          <button class="id-read-more-btn" type="button">${expanded ? "Read less" : "Read more"}</button>
        </div>
        ${
          firm.portfolio.length > 0
            ? `<div class="id-card-portfolio"><span class="id-portfolio-label">Select Portfolio Companies:</span> ${escapeHtml(portfolioStr)}</div>`
            : ""
        }
      </div>`;
  }

  // ── Autocomplete ──
  function getSuggestions() {
    if (!state.searchQuery) return [];
    const lower = state.searchQuery.toLowerCase();
    const startsWith = investors.filter((f) => f.name.toLowerCase().startsWith(lower));
    const includes = investors.filter(
      (f) =>
        !f.name.toLowerCase().startsWith(lower) && f.name.toLowerCase().includes(lower)
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
        (f, i) =>
          `<div class="id-ac-item${i === state.acActiveIdx ? " active" : ""}" data-name="${escapeAttr(f.name)}"><span class="id-ac-name">${escapeHtml(f.name)}</span><span class="id-ac-meta">${escapeHtml(f.hq)}</span></div>`
      )
      .join("");
    acDropdown.classList.add("open");
    acDropdown.querySelectorAll(".id-ac-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const name = el.getAttribute("data-name");
        selectSuggestion(name);
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
      // re-render to remove highlight class
      const card = firmsContainer.querySelector(
        `.id-firm-card[data-firm="${cssEscape(name)}"]`
      );
      if (card) card.classList.remove("highlight");
    }, 2000);
  }

  // ── Wire events ──
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

  sectorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    state.sectorMenuOpen = !state.sectorMenuOpen;
    renderSectorBtn();
  });

  sectorClear.addEventListener("click", (e) => {
    e.stopPropagation();
    state.activeSectors.clear();
    renderSectorMenu();
    renderSectorBtn();
    renderFirms();
  });

  clearAllBtn.addEventListener("click", () => {
    state.searchQuery = "";
    searchInput.value = "";
    state.activeStages.clear();
    state.activeSectors.clear();
    state.acOpen = false;
    state.highlightedFirm = null;
    renderStageChips();
    renderSectorMenu();
    renderSectorBtn();
    renderAutocomplete();
    renderFirms();
  });

  document.addEventListener("click", (e) => {
    if (searchWrapper && !searchWrapper.contains(e.target)) {
      state.acOpen = false;
      renderAutocomplete();
    }
    if (sectorWrapper && !sectorWrapper.contains(e.target)) {
      if (state.sectorMenuOpen) {
        state.sectorMenuOpen = false;
        renderSectorBtn();
      }
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
  function escapeAttr(str) {
    return escapeHtml(str);
  }
  function cssEscape(str) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(str);
    return String(str).replace(/["\\]/g, "\\$&");
  }

  // ── Init ──
  buildTicker();
  buildStageChips();
  buildSectorMenu();
  renderSectorBtn();
  renderFirms();
})();
