const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

/*
  Featured mode:
  Shows only famous competitions on the homepage.

  All mode:
  /api/matches?mode=all
  Shows all available matches.
*/

const FEATURED_RULES = [
  { country: "England", names: ["Premier League", "FA Cup", "League Cup"] },
  { country: "Spain", names: ["La Liga", "Primera Division", "Copa del Rey", "Super Cup"] },
  { country: "Italy", names: ["Serie A", "Coppa Italia", "Super Cup"] },
  { country: "Germany", names: ["Bundesliga", "DFB Pokal", "Super Cup"] },
  { country: "France", names: ["Ligue 1", "Coupe de France", "Super Cup"] },
  { country: "Europe", names: ["UEFA Champions League", "Champions League", "UEFA Europa League", "Europa League", "UEFA Conference League", "Conference League"] },
  { country: "World", names: ["FIFA World Cup", "Club World Cup", "World Cup"] },
  { country: "Saudi-Arabia", names: ["Saudi Pro League", "Pro League", "Kings Cup"] },
  { country: "Netherlands", names: ["Eredivisie"] },
  { country: "Portugal", names: ["Primeira Liga"] }
];

const LEAGUE_PRIORITY = [
  "UEFA Champions League",
  "Champions League",
  "Premier League",
  "La Liga",
  "Primera Division",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "UEFA Europa League",
  "Europa League",
  "Saudi Pro League",
  "Pro League",
  "Eredivisie",
  "Primeira Liga"
];

const BAD_TEAM_WORDS = [
  "u19", "u20", "u21", "u23", "youth", "women", "wfc", "reserves", " ii ", " b "
];

export default async function handler(req, res) {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const mode = String(req.query.mode || "featured").toLowerCase() === "all" ? "all" : "featured";

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    const apiFootball = await getApiFootballMatches(date);
    const matches = prepareMatches(apiFootball, mode);

    return res.status(200).json({
      source: "API-Football",
      mode,
      date,
      count: matches.length,
      matches
    });
  } catch (err) {
    console.error("API-Football failed:", err.message);
  }

  try {
    const backup = await getFootballDataMatches(date);
    const matches = prepareMatches(backup, mode);

    return res.status(200).json({
      source: "football-data.org backup",
      mode,
      date,
      count: matches.length,
      matches
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
    headers: {
      "x-apisports-key": key
    }
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
    headers: {
      "X-Auth-Token": key
    }
  });

  const data = await r.json();

  if (!r.ok) {
    throw new Error(data.message || `football-data HTTP ${r.status}`);
  }

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
    featured: isFeaturedMatch(m),
    badYouth: isYouthOrReserve(m),
    weight: getWeight(m)
  }));

  if (mode === "featured") {
    list = list.filter(m => m.featured && !m.badYouth);
  }

  return sortMatches(list).slice(0, mode === "all" ? 150 : 50);
}

function isFeaturedMatch(match) {
  const leagueName = normalize(match.league?.name || "");
  const country = normalizeCountry(match.league?.country || "");

  return FEATURED_RULES.some(rule => {
    const sameCountry = normalizeCountry(rule.country) === country;
    if (!sameCountry) return false;

    return rule.names.some(name => {
      const n = normalize(name);
      return leagueName === n || leagueName.includes(n) || n.includes(leagueName);
    });
  });
}

function isYouthOrReserve(m) {
  const text = ` ${normalize(`${m.home?.name || ""} ${m.away?.name || ""} ${m.league?.name || ""}`)} `;
  return BAD_TEAM_WORDS.some(w => text.includes(w));
}

function getWeight(m) {
  const league = normalize(m.league?.name || "");
  const country = normalizeCountry(m.league?.country || "");
  const idx = LEAGUE_PRIORITY.findIndex(name => {
    const n = normalize(name);
    return league === n || league.includes(n) || n.includes(league);
  });

  let base = idx >= 0 ? idx : 99;

  if (country === "england") base -= 2;
  if (country === "europe") base -= 4;
  if (isLiveStatus(m.statusShort)) base -= 20;
  if (isYouthOrReserve(m)) base += 80;

  return base;
}

function sortMatches(matches) {
  return matches.sort((a, b) => {
    const liveA = isLiveStatus(a.statusShort) ? 0 : 1;
    const liveB = isLiveStatus(b.statusShort) ? 0 : 1;

    return (
      liveA - liveB ||
      (a.weight || 99) - (b.weight || 99) ||
      new Date(a.utcDate) - new Date(b.utcDate)
    );
  });
}

function isLiveStatus(status) {
  return ["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(status);
}

function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCountry(s) {
  return String(s)
    .toLowerCase()
    .replace("saudi arabia", "saudi-arabia")
    .replace("saudi-arabia", "saudi-arabia")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
