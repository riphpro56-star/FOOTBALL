const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

const FEATURED_LEAGUES = [
  "Premier League",
  "La Liga",
  "Primera Division",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "UEFA Champions League",
  "Champions League",
  "UEFA Europa League",
  "Europa League",
  "Saudi Pro League",
  "FIFA World Cup",
  "UEFA European Championship",
  "Copa America"
];

const FEATURED_SET = new Set(FEATURED_LEAGUES.map(x => normalize(x)));

const BAD_TEAM_WORDS = [
  "u19", "u20", "u21", "u23", "youth", "women", "wfc", "reserves", " b ", " ii "
];

export default async function handler(req, res) {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const mode = String(req.query.mode || "featured").toLowerCase(); // featured | all

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const apiFootball = await getApiFootballMatches(date);
    const cleaned = prepareMatches(apiFootball, mode);

    if (cleaned.length || mode === "featured") {
      return res.status(200).json({
        source: "API-Football",
        mode,
        date,
        count: cleaned.length,
        matches: cleaned
      });
    }
  } catch (err) {
    console.error("API-Football failed:", err.message);
  }

  try {
    const backup = await getFootballDataMatches(date);
    const cleaned = prepareMatches(backup, mode);

    return res.status(200).json({
      source: "football-data.org backup",
      mode,
      date,
      count: cleaned.length,
      matches: cleaned
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
    }
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
    }
  }));
}

function prepareMatches(matches, mode) {
  let list = matches.map(m => ({
    ...m,
    featured: isFeaturedLeague(m),
    badYouth: isYouthOrReserve(m),
    weight: getWeight(m)
  }));

  if (mode !== "all") {
    list = list.filter(m => m.featured && !m.badYouth);
  }

  return sortMatches(list).slice(0, mode === "all" ? 120 : 40);
}

function isFeaturedLeague(m) {
  const league = normalize(m.league?.name || "");
  if (FEATURED_SET.has(league)) return true;

  return FEATURED_LEAGUES.some(name => {
    const n = normalize(name);
    return league.includes(n) || n.includes(league);
  });
}

function isYouthOrReserve(m) {
  const text = ` ${normalize(`${m.home?.name || ""} ${m.away?.name || ""} ${m.league?.name || ""}`)} `;
  return BAD_TEAM_WORDS.some(w => text.includes(w));
}

function getWeight(m) {
  const league = normalize(m.league?.name || "");
  const idx = FEATURED_LEAGUES.findIndex(x => league.includes(normalize(x)) || normalize(x).includes(league));
  const base = idx >= 0 ? idx : 99;
  const liveBonus = isLiveStatus(m.statusShort) ? -10 : 0;
  return base + liveBonus + (isYouthOrReserve(m) ? 70 : 0);
}

function sortMatches(matches) {
  return matches.sort((a, b) => {
    const liveA = isLiveStatus(a.statusShort) ? 0 : 1;
    const liveB = isLiveStatus(b.statusShort) ? 0 : 1;
    return liveA - liveB || (a.weight || 99) - (b.weight || 99) || new Date(a.utcDate) - new Date(b.utcDate);
  });
}

function isLiveStatus(s) {
  return ["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(s);
}

function normalize(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
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
