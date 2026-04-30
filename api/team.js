export default async function handler(req, res) {
  const name = String(req.query.name || "").trim();
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400");

  if (!name) return res.status(400).json({ error: "Missing team name" });

  try {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    const data = await r.json();
    const team = data.teams?.[0] || null;

    res.status(200).json({
      source: "TheSportsDB",
      team: team ? {
        name: team.strTeam,
        badge: team.strBadge,
        logo: team.strLogo,
        banner: team.strBanner,
        stadium: team.strStadium,
        league: team.strLeague,
        country: team.strCountry,
        website: team.strWebsite
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load team", detail: err.message });
  }
}

