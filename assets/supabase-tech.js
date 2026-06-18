/* Engage Colorado — Tech Directory Supabase data layer
 *
 * Live source for the Colorado Tech Directory — same Supabase project and
 * `companies` table that cv_website/public/tech-directory/index.html reads.
 * Loads @supabase/supabase-js@2 from esm.sh — no build step required.
 *
 * Exposes on window:
 *   ECFetchCompanies()                  -> Promise<Company[]>
 *   ECSubscribeCompanies(onChange)      -> () => void  (unsubscribe)
 *
 * Both are no-ops if window.EC_SUPABASE_URL is not set, so the page still
 * functions with only the static fallback file (assets/tech-data.js).
 *
 * The returned shape matches assets/tech-data.js exactly (the snapshot
 * produced by scripts/pull-tech-directory.mjs), so the renderer is unchanged.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = window.EC_SUPABASE_URL;
const key = window.EC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("EC: Supabase config missing; live tech directory disabled.");
} else {
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  // Tables that, when changed, should refresh the directory.
  const TECH_TABLES = ["companies", "company_people", "company_investors"];

  // Columns + embeds mirror cv_website/public/tech-directory/index.html so the
  // directory shows the same information (funding, IPO/exit, key people,
  // investors, portfolio/Endeavor badges).
  const SELECT = `
    id, slug, name, city, founded, stage, size, industry,
    website, linkedin, description,
    is_portfolio, is_endeavor,
    last_funded_date, last_funded_round, last_funded_amount_text,
    valuation_text,
    ipo_date, ipo_symbol, ipo_exchange, ipo_valuation_text,
    exit_date, exit_acquirer, exit_valuation_text,
    company_people(role, sort_order, people(full_name)),
    company_investors(sort_order, investors(name))
  `.replace(/\s+/g, " ").trim();

  function adaptRow(co) {
    const people = (co.company_people || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((cp) => {
        const name = cp.people && cp.people.full_name;
        if (!name) return null;
        return { name, role: cp.role || "" };
      })
      .filter(Boolean);

    const investors = (co.company_investors || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((ci) => ci.investors && ci.investors.name)
      .filter(Boolean);

    return {
      id: co.id,
      slug: co.slug ?? "",
      name: co.name ?? "",
      city: co.city ?? "",
      founded: co.founded ?? null,
      stage: co.stage ?? "",
      size: co.size ?? "",
      industry: co.industry ?? "",
      website: co.website ?? "",
      linkedin: co.linkedin ?? "",
      description: co.description ?? "",
      // Keep the full date (YYYY / YYYY-MM / YYYY-MM-DD) so the renderer can
      // format it as "Mon YYYY" the way cv_website does.
      lastFundedDate: co.last_funded_date ? String(co.last_funded_date) : "",
      lastFundedRound: co.last_funded_round ?? "",
      lastFundedAmount: co.last_funded_amount_text ?? "",
      valuation: co.valuation_text ?? "",
      ipoDate: co.ipo_date ?? "",
      ipoSymbol: co.ipo_symbol ?? "",
      ipoExchange: co.ipo_exchange ?? "",
      ipoValuation: co.ipo_valuation_text ?? "",
      exitDate: co.exit_date ?? "",
      exitAcquirer: co.exit_acquirer ?? "",
      exitValuation: co.exit_valuation_text ?? "",
      isPortfolio: co.is_portfolio ?? false,
      isEndeavor: co.is_endeavor ?? false,
      people,
      investors,
    };
  }

  async function fetchCompanies() {
    const { data, error } = await supabase
      .from("companies")
      .select(SELECT)
      .order("name", { ascending: true })
      .limit(10000);

    if (error) throw error;
    return (data || []).map(adaptRow);
  }

  function subscribe(onChange) {
    let pending = null;

    const refresh = async () => {
      try {
        onChange(await fetchCompanies());
      } catch (err) {
        console.error("EC: Supabase tech refresh failed", err);
      }
    };

    const channel = supabase.channel("ctd-directory");
    for (const table of TECH_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (pending) clearTimeout(pending);
          pending = setTimeout(refresh, 150);
        }
      );
    }
    channel.subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }

  window.ECFetchCompanies = fetchCompanies;
  window.ECSubscribeCompanies = subscribe;
}
