export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

  try {
    const r = await fetch("https://www.scorebat.com/video-api/v3/");
    const data = await r.json();

    const items = data.response || data || [];
    const videos = items.slice(0, 30).map((item, index) => {
      const firstVideo = item.videos?.[0] || {};
      return {
        id: firstVideo.id || `video-${index}`,
        title: item.title || "Match highlights",
        competition: item.competition || "Football",
        thumbnail: item.thumbnail || "",
        date: item.date || "",
        url: item.matchviewUrl || item.url || "https://www.scorebat.com/",
        embed: firstVideo.embed || "",
        duration: getDuration(item),
        teams: {
          home: item.side1?.name || item.homeTeam?.name || "",
          away: item.side2?.name || item.awayTeam?.name || ""
        }
      };
    });

    res.status(200).json({
      source: "ScoreBat",
      count: videos.length,
      videos
    });
  } catch (err) {
    res.status(500).json({
      error: "Could not load videos",
      detail: err.message
    });
  }
}

function getDuration(item) {
  const title = item.videos?.[0]?.title || "";
  if (/highlight/i.test(title)) return "HD";
  return "HD";
}
