const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

const TOP_LEAGUES = new Set([
  "Premier League",
  "Primera Division",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "UEFA Champions League",
  "Champions League",
  "UEFA Europa League",
  "Eredivisie",
  "Primeira Liga",
  "Saudi Pro League"
]);

export default async function handler(req, res) {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const apiFootball = await getApiFootballMatches(date);
    if (apiFootball.length) {
      return res.status(200).json({
        source: "API-Football",
        date,
        count: apiFootball.length,
        matches: sortMatches(apiFootball)
      });
    }
  } catch (err) {
    console.error("API-Football failed:", err.message);
  }

  try {
    const backup = await getFootballDataMatches(date);
    return res.status(200).json({
      source: "football-data.org backup",
      date,
      count: backup.length,
      matches: sortMatches(backup)
    });
  } catch (err) {
    console.error("football-data failed:", err.message);
    return res.status(500).json({
      error: "Could not load football matches. Check API keys in Vercel Environment Variables.",
      detail: err.message
    });
  }
}

async function getApiFootballMatches(date) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("Missing API_FOOTBALL_KEY");

  const url = `${API_FOOTBALL_BASE}/fixtures?date=${encodeURIComponent(date)}`;
  const r = await fetch(url, {
    headers: { "x-apisports-key": key }
  });

  const data = await r.json();
  if (!r.ok || data.errors?.token) {
    throw new Error(data.errors?.token || data.message || `API-Football HTTP ${r.status}`);
  }

  return (data.response || []).map(item => ({
    id: `apifootball-${item.fixture?.id}`,
    utcDate: item.fixture?.date,
    statusShort: item.fixture?.status?.short || "NS",
    elapsed: item.fixture?.status?.elapsed || null,
    venue: item.fixture?.venue?.name || "",
    league: {
      name: item.league?.name || "Football",
      country: item.league?.country || "",
      logo: item.league?.logo || ""
    },
    home: {
      name: item.teams?.home?.name || "Home",
      logo: item.teams?.home?.logo || ""
    },
    away: {
      name: item.teams?.away?.name || "Away",
      logo: item.teams?.away?.logo || ""
    },
    score: {
      home: item.goals?.home,
      away: item.goals?.away
    },
    weight: TOP_LEAGUES.has(item.league?.name) ? 1 : 2
  }));
}

async function getFootballDataMatches(date) {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) throw new Error("Missing FOOTBALL_DATA_KEY");

  const url = `${FOOTBALL_DATA_BASE}/matches?dateFrom=${encodeURIComponent(date)}&dateTo=${encodeURIComponent(date)}`;
  const r = await fetch(url, {
    headers: { "X-Auth-Token": key }
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data.message || `football-data HTTP ${r.status}`);

  return (data.matches || []).map(item => ({
    id: `fd-${item.id}`,
    utcDate: item.utcDate,
    statusShort: mapFootballDataStatus(item.status),
    elapsed: null,
    venue: "",
    league: {
      name: item.competition?.name || "Football",
      country: item.area?.name || "",
      logo: item.competition?.emblem || ""
    },
    home: {
      name: item.homeTeam?.name || "Home",
      logo: item.homeTeam?.crest || ""
    },
    away: {
      name: item.awayTeam?.name || "Away",
      logo: item.awayTeam?.crest || ""
    },
    score: {
      home: item.score?.fullTime?.home ?? item.score?.halfTime?.home ?? null,
      away: item.score?.fullTime?.away ?? item.score?.halfTime?.away ?? null
    },
    weight: TOP_LEAGUES.has(item.competition?.name) ? 1 : 2
  }));
}

function mapFootballDataStatus(status) {
  const map = {
    SCHEDULED: "NS",
    TIMED: "NS",
    IN_PLAY: "LIVE",
    PAUSED: "HT",
    FINISHED: "FT",
    POSTPONED: "PST",
    SUSPENDED: "SUSP",
    CANCELLED: "CANC"
  };
  return map[status] || "NS";
}

function sortMatches(matches) {
  return matches.sort((a, b) => {
    const liveA = ["1H","2H","HT","ET","BT","P","SUSP","INT","LIVE"].includes(a.statusShort) ? 0 : 1;
    const liveB = ["1H","2H","HT","ET","BT","P","SUSP","INT","LIVE"].includes(b.statusShort) ? 0 : 1;
    return liveA - liveB || (a.weight || 2) - (b.weight || 2) || new Date(a.utcDate) - new Date(b.utcDate);
  });
}

