export default async function handler(req, res) {
  try {
    const q = req.query.q;

    if (!q || q.length > 160) {
      return res.status(400).json({
        status: "error",
        error: "missing_or_too_long_q"
      });
    }

    const hl = req.query.hl || "en-US";
    const gl = req.query.gl || "US";
    const ceid = req.query.ceid || "US:en";
    const maxItemsRaw = parseInt(req.query.max_items || "5", 10);
    const maxItems = Math.min(Math.max(maxItemsRaw || 5, 1), 5);

    const rssUrl = new URL("https://news.google.com/rss/search");
    rssUrl.searchParams.set("q", q);
    rssUrl.searchParams.set("hl", hl);
    rssUrl.searchParams.set("gl", gl);
    rssUrl.searchParams.set("ceid", ceid);

    const upstream = await fetch(rssUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": `${hl},en;q=0.9`
      }
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({
        status: "error",
        error: "google_news_fetch_failed",
        http_status: upstream.status,
        upstream_url: rssUrl.toString(),
        body_preview: clean(stripTags(text)).slice(0, 240)
      });
    }

    const itemBlocks = getItemBlocks(text, maxItems);

    const items = itemBlocks.map((block) => ({
      title: clean(extractTag(block, "title")),
      source: clean(extractTag(block, "source")),
      published: clean(extractTag(block, "pubDate")),
      link: clean(extractTag(block, "link")),
      snippet: trim(clean(stripTags(extractTag(block, "description"))), 240)
    }));

    return res.status(200).json({
      status: "ok",
      query: q,
      item_count: items.length,
      items,
      caveat: "Google News RSS is narrative discovery only, not catalyst proof."
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      error: "wrapper_exception",
      message: String(err && err.message ? err.message : err)
    });
  }
}

function getItemBlocks(xml, maxItems) {
  const itemRe = new RegExp("<item>([\\s\\S]*?)<\\/item>", "g");
  return Array.from(xml.matchAll(itemRe))
    .slice(0, maxItems)
    .map((match) => match[1]);
}

function extractTag(block, tag) {
  const safeTag = String(tag).replace(/[^a-zA-Z0-9:_-]/g, "");
  const re = new RegExp(
    "<" + safeTag + "[^>]*>([\\s\\S]*?)<\\/" + safeTag + ">",
    "i"
  );
  const match = block.match(re);
  return match ? decode(match[1]) : "";
}

function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ");
}

function trim(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
