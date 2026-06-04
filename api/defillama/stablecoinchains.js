export default async function handler(req, res) {
  try {
    const maxChainsRaw = parseInt(req.query.max_chains || "20", 10);
    const maxChains = Math.min(Math.max(maxChainsRaw || 20, 1), 20);

    const upstream = await fetch("https://stablecoins.llama.fi/stablecoinchains", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "TradeHunterDefiLlamaWrapper/1.0"
      }
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({
        status: "error",
        error: "defillama_stablecoinchains_failed",
        http_status: upstream.status,
        body_preview: text.slice(0, 240)
      });
    }

    const data = JSON.parse(text);

    const rows = Array.isArray(data) ? data : [];
    const chains = rows
      .slice(0, maxChains)
      .map((row) => ({
        name: row.name || row.chain || row.gecko_id || "",
        stablecoins_mcap: row.totalCirculatingUSD || row.mcap || row.circulating || null,
        change_1d: row.change_1d ?? null,
        change_7d: row.change_7d ?? null,
        change_1m: row.change_1m ?? null
      }));

    return res.status(200).json({
      status: "ok",
      source: "DefiLlama stablecoinchains",
      chain_count_total: rows.length,
      chain_count_returned: chains.length,
      chains,
      caveat: "Stablecoin chain data is macro/context only, not token identity or trade actionability."
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      error: "wrapper_exception",
      message: String(err && err.message ? err.message : err)
    });
  }
}
