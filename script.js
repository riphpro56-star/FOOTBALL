const state = {
  matches: [],
  videos: [],
  selectedDate: todayISO(),
  status: "all",
  search: "",
  visibleCount: 12
};

const els = {
  liveCards: document.getElementById("liveCards"),
  matchList: document.getElementById("matchList"),
  videoRow: document.getElementById("videoRow"),
  dateStrip: document.getElementById("dateStrip"),
  searchPanel: document.getElementById("searchPanel"),
  searchToggle: document.getElementById("searchToggle"),
  searchInput: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  toast: document.getElementById("toast")
};

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function niceDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function niceDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function matchTime(dateStr) {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function escapeHTML(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

function teamLogo(team) {
  return team?.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(team?.name || "FC")}&background=111827&color=fff&bold=true`;
}

function isLive(m) {
  return ["1H","2H","HT","ET","BT","P","SUSP","INT","LIVE"].includes(m.statusShort);
}

function isFinished(m) {
  return ["FT","AET","PEN"].includes(m.statusShort);
}

function statusText(m) {
  if (isLive(m)) return m.elapsed ? `${m.elapsed}'` : "LIVE";
  if (isFinished(m)) return "FT";
  return matchTime(m.utcDate);
}

function scoreText(m) {
  const h = m.score?.home;
  const a = m.score?.away;
  if (h === null || h === undefined || a === null || a === undefined) return "VS";
  return `${h} - ${a}`;
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2500);
}

function buildDateStrip() {
  const dates = [0,1,2,3,4].map(todayISO);
  els.dateStrip.innerHTML = dates.map((date, i) => `
    <button class="date-btn ${date === state.selectedDate ? "active" : ""}" data-date="${date}">
      ${i === 0 ? "Today" : niceDay(date)}
      <small>${niceDate(date)}</small>
    </button>
  `).join("");

  els.dateStrip.querySelectorAll(".date-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedDate = btn.dataset.date;
      state.visibleCount = 12;
      buildDateStrip();
      loadMatches();
    });
  });
}

function filteredMatches() {
  let list = [...state.matches];

  if (state.status === "live") list = list.filter(isLive);
  if (state.status === "upcoming") list = list.filter(m => !isLive(m) && !isFinished(m));
  if (state.status === "finished") list = list.filter(isFinished);

  const q = state.search.trim().toLowerCase();
  if (q) {
    list = list.filter(m => [
      m.league?.name, m.home?.name, m.away?.name, m.venue
    ].filter(Boolean).join(" ").toLowerCase().includes(q));
  }

  return list;
}

function renderLiveCards() {
  const live = state.matches.filter(isLive).slice(0, 10);
  if (!live.length) {
    const upcoming = state.matches.filter(m => !isFinished(m)).slice(0, 6);
    els.liveCards.innerHTML = upcoming.length
      ? upcoming.map(liveCard).join("")
      : `<div class="empty">No live matches right now.</div>`;
    return;
  }
  els.liveCards.innerHTML = live.map(liveCard).join("");
}

function liveCard(m) {
  return `
    <article class="live-card">
      <div class="live-top">
        <span>${escapeHTML(m.league?.name || "Football")}</span>
        <strong class="live-time">${escapeHTML(statusText(m))}</strong>
      </div>
      <div class="teams-score">
        <div class="team">
          <img src="${teamLogo(m.home)}" alt="${escapeHTML(m.home?.name)}" loading="lazy" />
          <span>${escapeHTML(m.home?.name || "Home")}</span>
        </div>
        <div class="score">${escapeHTML(scoreText(m))}</div>
        <div class="team">
          <img src="${teamLogo(m.away)}" alt="${escapeHTML(m.away?.name)}" loading="lazy" />
          <span>${escapeHTML(m.away?.name || "Away")}</span>
        </div>
      </div>
      <div class="live-state"><i class="red-dot"></i>${isLive(m) ? "LIVE" : "Upcoming"}</div>
      <div class="venue">⌖ ${escapeHTML(m.venue || "Stadium not available")}</div>
    </article>
  `;
}

function renderMatches() {
  const list = filteredMatches();
  const visible = list.slice(0, state.visibleCount);

  if (!visible.length) {
    els.matchList.innerHTML = `<div class="empty">No matches found.</div>`;
    els.loadMoreBtn.style.display = "none";
    return;
  }

  els.matchList.innerHTML = visible.map(m => `
    <article class="match-row">
      <div class="match-time">
        <strong>${escapeHTML(statusText(m))}</strong>
        <small>${isLive(m) ? "Live" : isFinished(m) ? "Finished" : "Today"}</small>
      </div>

      <div class="match-team home">
        <span>${escapeHTML(m.home?.name || "Home")}</span>
        <img src="${teamLogo(m.home)}" alt="" loading="lazy" />
      </div>

      <div class="vs">${escapeHTML(scoreText(m))}</div>

      <div class="match-team">
        <img src="${teamLogo(m.away)}" alt="" loading="lazy" />
        <span>${escapeHTML(m.away?.name || "Away")}</span>
      </div>

      <div class="stadium">${escapeHTML(m.venue || m.league?.name || "")}</div>
      <div class="arrow">›</div>
    </article>
  `).join("");

  els.loadMoreBtn.style.display = list.length > state.visibleCount ? "block" : "none";
}

function renderVideos() {
  const vids = state.videos.slice(0, 10);
  if (!vids.length) {
    els.videoRow.innerHTML = `<div class="empty">No videos available.</div>`;
    return;
  }

  els.videoRow.innerHTML = vids.map(v => `
    <a class="video-card" href="${escapeHTML(v.url || "#")}" target="_blank" rel="noopener">
      <div class="video-thumb">
        <img src="${escapeHTML(v.thumbnail || "")}" alt="${escapeHTML(v.title)}" loading="lazy" />
        <span class="play">▶</span>
        <span class="video-time">${escapeHTML(v.duration || "HD")}</span>
      </div>
      <div class="video-title">${escapeHTML(v.title || "Match highlights")}</div>
      <div class="video-league">${escapeHTML(v.competition || "Football")}</div>
    </a>
  `).join("");
}

async function loadMatches() {
  els.matchList.innerHTML = `<div class="loading">Loading matches...</div>`;
  try {
    const res = await fetch(`/api/matches?date=${state.selectedDate}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to load matches");
    state.matches = data.matches || [];
    renderLiveCards();
    renderMatches();
    if (data.source) showToast(`Loaded from ${data.source}`);
  } catch (err) {
    els.matchList.innerHTML = `<div class="error">${escapeHTML(err.message)}</div>`;
    els.liveCards.innerHTML = `<div class="error">Could not load live matches.</div>`;
  }
}

async function loadVideos() {
  try {
    const res = await fetch("/api/highlights");
    const data = await res.json();
    state.videos = data.videos || [];
    renderVideos();
  } catch {
    els.videoRow.innerHTML = `<div class="error">Could not load videos.</div>`;
  }
}

function setupEvents() {
  document.querySelectorAll(".pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.status = btn.dataset.status;
      renderMatches();
    });
  });

  els.loadMoreBtn.addEventListener("click", () => {
    state.visibleCount += 10;
    renderMatches();
  });

  els.searchToggle.addEventListener("click", () => {
    els.searchPanel.classList.toggle("show");
    if (els.searchPanel.classList.contains("show")) els.searchInput.focus();
  });

  els.clearSearch.addEventListener("click", () => {
    state.search = "";
    els.searchInput.value = "";
    renderMatches();
  });

  els.searchInput.addEventListener("input", e => {
    state.search = e.target.value;
    renderLiveCards();
    renderMatches();
  });

  document.querySelectorAll("[data-section]").forEach(btn => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      const map = {
        home: ".live-section",
        live: ".live-section",
        fixtures: ".fixtures-section",
        leagues: ".leagues-section",
        videos: ".videos-section"
      };
      document.querySelector(map[section] || ".live-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.toggle("active", b.dataset.section === section));
      document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.section === section));
    });
  });

  document.querySelectorAll("#leagueGrid button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.search = btn.dataset.league;
      els.searchInput.value = state.search;
      renderMatches();
      document.querySelector(".fixtures-section").scrollIntoView({ behavior: "smooth" });
    });
  });
}

buildDateStrip();
setupEvents();
loadMatches();
loadVideos();
