/* Engage Colorado — Investor Directory interactivity
   Vanilla JS port of cv_website/src/app/investor-directory/page.tsx */
(function () {
  "use strict";

  let investors = window.EC_INVESTORS || [];
  const tickerStats = window.EC_TICKER_STATS || [];

  const STAGES = [
    { label: "Pre Seed", value: ["Pre Seed", "Pre-Seed"] },
    { label: "Seed", value: "Seed" },
    { label: "Series A", value: "Series A" },
    { label: "Series B", value: "Series B" },
    { label: "Growth / Late Stage", value: ["Growth / Late Stage", "Growth equity", "Late stage"] },
  ];

  const state = {
    searchQuery: "",
    activeStages: new Set(),
    activeSectors: new Set(),
    stageMenuOpen: false,
    sectorMenuOpen: false,
    acOpen: false,
    acActiveIdx: -1,
    highlightedFirm: null,
    expandedCards: new Set(),
  };

  // DOM refs
  const tickerTrack = document.getElementById("idTickerTrack");
  const stageListEl = document.getElementById("idStageList");
  const stageBtn = document.getElementById("idStageBtn");
  const stageBtnLabel = document.getElementById("idStageBtnLabel");
  const stageMenu = document.getElementById("idStageMenu");
  const stageClear = document.getElementById("idStageClear");
  const stageWrapper = document.getElementById("idStageWrapper");
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

  // ── Stage menu ──
  function buildStageMenu() {
    stageListEl.innerHTML = STAGES.map(
      (s) =>
        `<label class="id-sector-option" data-stage="${escapeAttr(s.label)}">
          <input type="checkbox" />
          <span class="id-sector-option-label">${escapeHtml(s.label)}</span>
        </label>`
    ).join("");

    stageListEl.querySelectorAll(".id-sector-option").forEach((label) => {
      label.addEventListener("click", (e) => {
        const stage = label.getAttribute("data-stage");
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
      const stage = label.getAttribute("data-stage");
      const checked = state.activeStages.has(stage);
      label.classList.toggle("checked", checked);
      const input = label.querySelector("input");
      if (input.checked !== checked) input.checked = checked;
    });
  }

  function renderStageBtn() {
    const count = state.activeStages.size;
    stageBtnLabel.textContent = count > 0 ? `Stages (${count}) ` : "Stages ";
    stageBtn.classList.toggle("has-selection", count > 0);
    stageBtn.classList.toggle("open", state.stageMenuOpen);
    stageMenu.classList.toggle("open", state.stageMenuOpen);
    stageBtn.setAttribute("aria-expanded", state.stageMenuOpen ? "true" : "false");
  }

  // ── Sector menu ──
  let allSectors = [...new Set(investors.flatMap((f) => f.sectors))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

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
    const activeStageValues = [...state.activeStages].flatMap((label) => {
      const opt = STAGES.find((o) => o.label === label);
      if (!opt) return [label];
      return Array.isArray(opt.value) ? opt.value : [opt.value];
    });
    const stageMatch =
      state.activeStages.size === 0 ||
      firm.stages.some((s) =>
        activeStageValues.some((a) => s.toLowerCase() === a.toLowerCase())
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

  stageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    state.stageMenuOpen = !state.stageMenuOpen;
    if (state.stageMenuOpen && state.sectorMenuOpen) {
      state.sectorMenuOpen = false;
      renderSectorBtn();
    }
    renderStageBtn();
  });

  stageClear.addEventListener("click", (e) => {
    e.stopPropagation();
    state.activeStages.clear();
    renderStageMenu();
    renderStageBtn();
    renderFirms();
  });

  sectorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    state.sectorMenuOpen = !state.sectorMenuOpen;
    if (state.sectorMenuOpen && state.stageMenuOpen) {
      state.stageMenuOpen = false;
      renderStageBtn();
    }
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
    renderStageMenu();
    renderStageBtn();
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
    if (stageWrapper && !stageWrapper.contains(e.target)) {
      if (state.stageMenuOpen) {
        state.stageMenuOpen = false;
        renderStageBtn();
      }
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

  // ── Supabase live data hook ──
  function replaceInvestors(next) {
    if (!Array.isArray(next) || next.length === 0) return;
    investors = next;
    allSectors = [...new Set(investors.flatMap((f) => f.sectors))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    // Rebuild the sector menu so newly-seen sectors appear (and removed ones go).
    // Active selections survive because state.activeSectors is a separate Set.
    buildSectorMenu();
    renderSectorMenu();
    renderSectorBtn();
    // Close any open autocomplete so it doesn't show stale suggestions.
    state.acOpen = false;
    if (acDropdown) acDropdown.classList.remove("open");
    renderFirms();
  }

  // ── Init ──
  buildTicker();
  buildStageMenu();
  buildSectorMenu();
  renderStageBtn();
  renderSectorBtn();
  renderFirms();

  // ── Live data from Supabase (mirrors cv_website investor-directory) ──
  // Polls for the module to finish loading, since it's <script type="module">
  // and may resolve after this classic script runs.
  function startLiveSync() {
    if (typeof window.ECFetchInvestors !== "function") return false;
    window.ECFetchInvestors()
      .then(replaceInvestors)
      .catch((err) => console.error("EC: Supabase initial fetch failed", err));
    if (typeof window.ECSubscribeInvestors === "function") {
      window.ECSubscribeInvestors(replaceInvestors);
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

  // ───────────────────────────────────────────────────────────────────────
  // Tech Directory — merged via directory toggle (mirrors carusoventures.com)
  //
  // The Colorado Tech Directory lives as its own app; here it is embedded in
  // an <iframe>. The parent renders the Stage / Industry / Region + smart-
  // search filter bar and relays commands into the iframe, while the iframe
  // relays its height and filter state back out. Message contract:
  //   iframe → parent: { type:"td-height", height }
  //                     { type:"td-filter-state", options, active, search,
  //                                              count, lifecycle, smartChips }
  //   parent → iframe: { type:"td-filter-cmd", cmd:"toggleFilter", axis, value, checked }
  //                     { type:"td-filter-cmd", cmd:"setSearch", value }
  //                     { type:"td-filter-cmd", cmd:"clearAll" }
  // ───────────────────────────────────────────────────────────────────────
  (function initTech() {
    // The standalone tech app lives in /tech-directory-app/ — copied verbatim
    // from cv_website's public/tech-directory-app, served from Engage Colorado's
    // own origin so the height/filter postMessage relay is same-origin.
    // With Vercel cleanUrls the directory path serves index.html; on a plain
    // file server (local preview) the explicit index.html is needed.
    const TECH_SRC =
      location.protocol === "file:" || location.port
        ? "/tech-directory-app/index.html"
        : "/tech-directory-app";

    const dirInvestorsBtn = document.getElementById("idDirInvestors");
    const dirTechBtn = document.getElementById("idDirTech");
    const investorsView = document.getElementById("idInvestorsView");
    const techView = document.getElementById("idTechView");
    const heroTitle = document.getElementById("idHeroTitle");
    const heroSubtitle = document.getElementById("idHeroSubtitle");
    const frame = document.getElementById("idTechFrame");
    if (!dirTechBtn || !frame) return;

    const AXES = [
      { axis: "stages", btn: "idTechStagesBtn", label: "idTechStagesLabel", menu: "idTechStagesMenu", list: "idTechStagesList", wrapper: "idTechStagesWrapper", title: "Stage" },
      { axis: "industries", btn: "idTechIndustriesBtn", label: "idTechIndustriesLabel", menu: "idTechIndustriesMenu", list: "idTechIndustriesList", wrapper: "idTechIndustriesWrapper", title: "Industry" },
      { axis: "regions", btn: "idTechRegionsBtn", label: "idTechRegionsLabel", menu: "idTechRegionsMenu", list: "idTechRegionsList", wrapper: "idTechRegionsWrapper", title: "Region" },
    ];
    const axisEls = {};
    AXES.forEach((a) => {
      axisEls[a.axis] = {
        cfg: a,
        btn: document.getElementById(a.btn),
        label: document.getElementById(a.label),
        menu: document.getElementById(a.menu),
        list: document.getElementById(a.list),
        wrapper: document.getElementById(a.wrapper),
      };
    });

    const techSearchInput = document.getElementById("idTechSearchInput");
    const techResultCount = document.getElementById("idTechResultCount");
    const techClearAll = document.getElementById("idTechClearAll");
    const smartChipsWrap = document.getElementById("idTechSmartChips");
    const smartChipsList = document.getElementById("idTechSmartChipsList");
    const smartChipsClear = document.getElementById("idTechSmartChipsClear");

    const HERO = {
      investors: {
        title: "Colorado Investor Directory",
        subtitle: "Venture capital and growth equity firms investing in Colorado's tech ecosystem.",
      },
      tech: {
        title: "Colorado Tech Company Directory",
        subtitle: "Companies building, scaling, and shipping product across Colorado — from early-stage startups to public industry leaders.",
      },
    };

    let mode = "investors";
    let frameLoaded = false;
    let openMenu = null;
    let searchDebounce = null;

    // Latest filter state relayed from the iframe.
    let fstate = {
      options: { stages: [], industries: [], regions: [] },
      active: { stages: [], industries: [], regions: [] },
      search: "",
      count: 0,
      lifecycle: "loading",
      smartChips: { stages: [], industries: [], regions: [] },
    };

    function postCmd(payload) {
      if (frame.contentWindow) {
        frame.contentWindow.postMessage(Object.assign({ type: "td-filter-cmd" }, payload), "*");
      }
    }

    // ── Inbound messages from the tech iframe ──
    window.addEventListener("message", (e) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "td-height" && typeof d.height === "number") {
        // Trust the iframe's measured content height. On mobile the grid is a
        // single tall column (300+ companies stacked), so the total can run well
        // past 60k px — an earlier upper-bound guard wrongly rejected those real
        // readings and left the iframe stuck short (clipped around "Zero Homes").
        // Just floor it so a transient sub-1px reading can't collapse the frame.
        if (d.height < 1) return;
        frame.style.height = Math.max(d.height, 800) + "px";
        return;
      }
      if (d.type === "td-filter-state") {
        fstate = {
          options: d.options || fstate.options,
          active: d.active || fstate.active,
          search: typeof d.search === "string" ? d.search : fstate.search,
          count: typeof d.count === "number" ? d.count : fstate.count,
          lifecycle: d.lifecycle || fstate.lifecycle,
          smartChips: d.smartChips || fstate.smartChips,
        };
        renderTechFilters();
      }
    });

    // ── Render the parent filter bar from relayed state ──
    function renderTechFilters() {
      AXES.forEach((a) => {
        const els = axisEls[a.axis];
        const opts = fstate.options[a.axis] || [];
        const active = fstate.active[a.axis] || [];

        // Rebuild option list if it changed.
        const signature = opts.join("") + "|" + active.join("");
        if (els.list.getAttribute("data-sig") !== signature) {
          els.list.setAttribute("data-sig", signature);
          els.list.innerHTML = opts
            .map(
              (v) =>
                `<label class="id-sector-option${active.indexOf(v) > -1 ? " checked" : ""}" data-value="${escapeAttr(v)}">
                  <input type="checkbox" ${active.indexOf(v) > -1 ? "checked" : ""} />
                  <span class="id-sector-option-label">${escapeHtml(v)}</span>
                </label>`
            )
            .join("");
          els.list.querySelectorAll(".id-sector-option").forEach((label) => {
            label.addEventListener("click", (ev) => {
              const value = label.getAttribute("data-value");
              const input = label.querySelector("input");
              if (ev.target.tagName !== "INPUT") input.checked = !input.checked;
              postCmd({ cmd: "toggleFilter", axis: a.axis, value: value, checked: input.checked });
            });
          });
        }

        // Button label + state.
        els.label.textContent = active.length > 0 ? `${a.title} (${active.length}) ` : `${a.title} `;
        els.btn.classList.toggle("has-selection", active.length > 0);
      });

      // Result count.
      if (techResultCount) {
        techResultCount.textContent = `${fstate.count} compan${fstate.count !== 1 ? "ies" : "y"}`;
      }

      // Smart-search "Interpreted as" chips.
      const chips = [
        ...(fstate.smartChips.stages || []).map((v) => ({ axis: "stages", v })),
        ...(fstate.smartChips.industries || []).map((v) => ({ axis: "industries", v })),
        ...(fstate.smartChips.regions || []).map((v) => ({ axis: "regions", v })),
      ];
      if (chips.length === 0) {
        smartChipsWrap.classList.remove("is-active");
        smartChipsList.innerHTML = "";
      } else {
        smartChipsWrap.classList.add("is-active");
        smartChipsList.innerHTML = chips
          .map(
            (c) =>
              `<span class="id-smart-chip" data-axis="${escapeAttr(c.axis)}" data-value="${escapeAttr(c.v)}">${escapeHtml(c.v)}<button class="id-smart-chip-x" type="button" aria-label="Remove ${escapeAttr(c.v)}">&times;</button></span>`
          )
          .join("");
        smartChipsList.querySelectorAll(".id-smart-chip-x").forEach((btn) => {
          btn.addEventListener("click", () => {
            const chip = btn.closest(".id-smart-chip");
            postCmd({ cmd: "toggleFilter", axis: chip.getAttribute("data-axis"), value: chip.getAttribute("data-value"), checked: false });
          });
        });
      }
    }

    // ── Dropdown open/close ──
    function closeMenus() {
      AXES.forEach((a) => {
        axisEls[a.axis].menu.classList.remove("open");
        axisEls[a.axis].btn.classList.remove("open");
        axisEls[a.axis].btn.setAttribute("aria-expanded", "false");
      });
      openMenu = null;
    }

    AXES.forEach((a) => {
      const els = axisEls[a.axis];
      els.btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = openMenu === a.axis;
        closeMenus();
        if (!wasOpen) {
          els.menu.classList.add("open");
          els.btn.classList.add("open");
          els.btn.setAttribute("aria-expanded", "true");
          openMenu = a.axis;
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (openMenu) {
        const wrapper = axisEls[openMenu].wrapper;
        if (wrapper && !wrapper.contains(e.target)) closeMenus();
      }
    });

    // ── Search (debounced, mirrors CV's 180ms) ──
    if (techSearchInput) {
      techSearchInput.addEventListener("input", (e) => {
        const value = e.target.value;
        if (searchDebounce) clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => postCmd({ cmd: "setSearch", value: value }), 180);
      });
    }

    // ── Clear all ──
    function techClear() {
      postCmd({ cmd: "clearAll" });
      if (techSearchInput) techSearchInput.value = "";
    }
    if (techClearAll) techClearAll.addEventListener("click", techClear);
    if (smartChipsClear) smartChipsClear.addEventListener("click", techClear);

    // ── URL routing: /tech-directory ⇄ /investor-directory ──
    // Mirrors cv_website: the active view is reflected in the path and swapped
    // in place via the History API so the tech view is directly shareable.
    function directoryForPath(path) {
      return path.replace(/\/+$/, "").endsWith("/tech-directory") ? "tech" : "investors";
    }

    function syncUrl(next) {
      const path = next === "tech" ? "/tech-directory" : "/investor-directory";
      if (location.pathname.replace(/\/+$/, "") !== path) {
        history.pushState(null, "", path + location.search + location.hash);
      }
    }

    // ── Toggle between directories ──
    function setMode(next, opts) {
      opts = opts || {};
      if (next === mode && opts.force !== true) return;
      mode = next;
      const isTech = next === "tech";

      if (opts.updateUrl !== false) syncUrl(next);

      dirInvestorsBtn.classList.toggle("active", !isTech);
      dirTechBtn.classList.toggle("active", isTech);

      investorsView.hidden = isTech;
      techView.hidden = !isTech;

      heroTitle.textContent = HERO[next].title;
      heroSubtitle.textContent = HERO[next].subtitle;

      // Drop the NEW badge once the user has visited the tech directory.
      if (isTech) {
        const badge = dirTechBtn.querySelector(".id-dir-new-badge");
        if (badge) badge.remove();
      }

      if (isTech && !frameLoaded) {
        frameLoaded = true;
        frame.style.height = "120000px"; // generous until first td-height arrives
        frame.src = TECH_SRC;
      }

      // When the tech tab opens, ask the iframe for its current state so the
      // parent bar can populate dropdowns even before the user interacts.
      if (isTech) {
        setTimeout(() => postCmd({ cmd: "requestState" }), 300);
      }
    }

    dirInvestorsBtn.addEventListener("click", () => setMode("investors"));
    dirTechBtn.addEventListener("click", () => setMode("tech"));

    // Browser back/forward swaps the view to match the URL.
    window.addEventListener("popstate", () => {
      setMode(directoryForPath(location.pathname), { updateUrl: false });
    });

    // Open whichever directory the URL asked for (e.g. a /tech-directory link).
    const initialMode = directoryForPath(location.pathname);
    if (initialMode === "tech") {
      setMode("tech", { updateUrl: false, force: true });
    }
  })();
})();
