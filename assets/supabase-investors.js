/* Engage Colorado — Investor Directory Supabase data layer
 *
 * Port of cv_website/src/lib/supabase.ts to a browser ES module.
 * Loads @supabase/supabase-js@2 from esm.sh — no build step required.
 *
 * Exposes on window:
 *   ECFetchInvestors()                  -> Promise<Investor[]>
 *   ECSubscribeInvestors(onChange)      -> () => void  (unsubscribe)
 *
 * Both are no-ops if window.EC_SUPABASE_URL is not set, so the page
 * still functions with only the static fallback file.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = window.EC_SUPABASE_URL;
const key = window.EC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("EC: Supabase config missing; live directory disabled.");
} else {
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const CID_TABLES = [
    "cid_investors",
    "cid_stages",
    "cid_sectors",
    "cid_investor_stages",
    "cid_investor_sectors",
    "cid_investor_locations",
    "cid_portfolio_companies",
  ];

  function prettyRange(s) {
    return s ? s.replace(/(\S)–(\S)/g, "$1 – $2") : "";
  }

  function formatHq(locs) {
    if (!locs || !locs.length) return "";
    const sorted = [...locs].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary)
    );
    return sorted
      .map((l) => (l.state ? `${l.city}, ${l.state}` : String(l.city)))
      .join(" & ");
  }

  function groupBy(rows) {
    const m = new Map();
    for (const r of rows) {
      const a = m.get(r.investor_id) || [];
      a.push(r);
      m.set(r.investor_id, a);
    }
    return m;
  }

  async function fetchInvestors() {
    const [
      { data: investors, error: e1 },
      { data: stages, error: e2 },
      { data: sectors, error: e3 },
      { data: investorStages, error: e4 },
      { data: investorSectors, error: e5 },
      { data: locations, error: e6 },
      { data: portfolio, error: e7 },
    ] = await Promise.all([
      supabase
        .from("cid_investors")
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("cid_stages").select("*").order("sort_order"),
      supabase.from("cid_sectors").select("*").order("label"),
      supabase.from("cid_investor_stages").select("*"),
      supabase.from("cid_investor_sectors").select("*"),
      supabase
        .from("cid_investor_locations")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("id", { ascending: true }),
      supabase.from("cid_portfolio_companies").select("*").order("sort_order"),
    ]);

    const err = e1 || e2 || e3 || e4 || e5 || e6 || e7;
    if (err) throw err;

    const stageById = new Map((stages || []).map((s) => [s.id, s]));
    const sectorById = new Map((sectors || []).map((s) => [s.id, s]));

    const stagesByInv = groupBy(investorStages || []);
    const sectorsByInv = groupBy(investorSectors || []);
    const locsByInv = groupBy(locations || []);
    const portByInv = groupBy(portfolio || []);

    return (investors || []).map((inv) => {
      const stageRows = (stagesByInv.get(inv.id) || [])
        .map((r) => stageById.get(r.stage_id))
        .filter(Boolean)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const sectorRows = (sectorsByInv.get(inv.id) || [])
        .map((r) => sectorById.get(r.sector_id))
        .filter(Boolean);

      return {
        name: inv.name,
        website: inv.website || undefined,
        stages: stageRows.map((s) => s.label),
        founded: inv.founded_year ? String(inv.founded_year) : "",
        checkSize: prettyRange(inv.check_size_bracket),
        aum: prettyRange(inv.aum_bracket),
        hq: formatHq(locsByInv.get(inv.id) || []),
        description: inv.description || "",
        portfolio: (portByInv.get(inv.id) || []).map((p) => p.company_name),
        sectors: sectorRows.map((s) => s.label),
      };
    });
  }

  function subscribe(onChange) {
    let pending = null;

    const refresh = async () => {
      try {
        const next = await fetchInvestors();
        onChange(next);
      } catch (err) {
        console.error("EC: Supabase refresh failed", err);
      }
    };

    const channel = supabase.channel("cid-directory");
    for (const table of CID_TABLES) {
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

  window.ECFetchInvestors = fetchInvestors;
  window.ECSubscribeInvestors = subscribe;
}
