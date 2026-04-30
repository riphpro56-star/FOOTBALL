const themeBtn = document.getElementById('themeBtn');
const refreshBtn = document.getElementById('refreshBtn');
const matchesList = document.getElementById('matchesList');
const leagueFilter = document.getElementById('leagueFilter');
const daysFilter = document.getElementById('daysFilter');
const searchInput = document.getElementById('searchInput');
const apiStatus = document.getElementById('apiStatus');
const copyMatchBtn = document.getElementById('copyMatchBtn');

const fields = {
  statAll: document.getElementById('statAll'),
  statLive: document.getElementById('statLive'),
  statUpcoming: document.getElementById('statUpcoming'),
  statFinished: document.getElementById('statFinished'),

  heroLeague: document.getElementById('heroLeague'),
  heroHomeTeam: document.getElementById('heroHomeTeam'),
  heroAwayTeam: document.getElementById('heroAwayTeam'),
  heroScore: document.getElementById('heroScore'),
  heroTime: document.getElementById('heroTime'),
  heroHomeLogo: document.getElementById('heroHomeLogo'),
  heroAwayLogo: document.getElementById('heroAwayLogo'),

  selectedTitle: document.getElementById('selectedTitle'),
  homeLogo: document.getElementById('homeLogo'),
  awayLogo: document.getElementById('awayLogo'),
  homeTeam: document.getElementById('homeTeam'),
  awayTeam: document.getElementById('awayTeam'),
  scoreText: document.getElementById('scoreText'),
  matchStatus: document.getElementById('matchStatus'),
  competitionName: document.getElementById('competitionName'),
  matchTime: document.getElementById('matchTime'),
  statusSmall: document.getElementById('statusSmall'),
  lastUpdate: document.getElementById('lastUpdate'),
  autoArticle: document.getElementById('autoArticle'),

  liveList: document.getElementById('liveList'),
  nextList: document.getElementById('nextList')
};

let allMatches = [];
let currentTab = 'ALL';
let selectedMatchId = null;
let watchLink = '#';

/* =========================
   Theme + Buttons
========================= */

if (localStorage.getItem('theme') === 'light') {
  document.body.classList.add('light');
}

if (themeBtn) {
  themeBtn.onclick = () => {
    document.body.classList.toggle('light');
    localStorage.setItem(
      'theme',
      document.body.classList.contains('light') ? 'light' : 'dark'
    );
  };
}

if (refreshBtn) {
  refreshBtn.onclick = async () => {
    await loadMatches();
    autoSelectHeroMatch();
    renderAll();
  };
}

document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.onclick = () => {
    currentTab = btn.dataset.tab || 'ALL';

    document.querySelectorAll('[data-tab]').forEach(b => {
      b.classList.remove('active');
    });

    btn.classList.add('active');
    renderMatches();
  };
});

if (leagueFilter) leagueFilter.onchange = renderMatches;
if (daysFilter) daysFilter.onchange = renderMatches;
if (searchInput) searchInput.oninput = renderMatches;

if (copyMatchBtn) {
  copyMatchBtn.onclick = () => {
    const match = getSelectedMatch();
    if (!match) return;

    const text = `${teamName(match.homeTeam)} ضد ${teamName(match.awayTeam)}
البطولة: ${competitionName(match)}
النتيجة: ${scoreOf(match)}
الوقت: ${formatDZTime(match.utcDate)}
الحالة: ${statusAr(match.status)}`;

    navigator.clipboard.writeText(text);
    copyMatchBtn.textContent = 'تم النسخ ✅';

    setTimeout(() => {
      copyMatchBtn.textContent = 'نسخ تفاصيل المباراة';
    }, 2000);
  };
}

/* =========================
   Helpers
========================= */

function formatDZTime(dateStr) {
  if (!dateStr) return '-';

  return new Date(dateStr).toLocaleString('ar-DZ', {
    timeZone: 'Africa/Algiers',
    weekday: 'long',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function onlyTime(dateStr) {
  if (!dateStr) return '-';

  return new Date(dateStr).toLocaleTimeString('ar-DZ', {
    timeZone: 'Africa/Algiers',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function statusAr(status) {
  return {
    SCHEDULED: 'قادمة',
    TIMED: 'قادمة',
    IN_PLAY: 'مباشر الآن',
    LIVE: 'مباشر الآن',
    PAUSED: 'استراحة',
    FINISHED: 'منتهية',
    POSTPONED: 'مؤجلة',
    SUSPENDED: 'متوقفة',
    CANCELLED: 'ملغاة'
  }[status] || status || '-';
}

function matchGroup(m) {
  if (['IN_PLAY', 'LIVE', 'PAUSED'].includes(m.status)) return 'LIVE';
  if (m.status === 'FINISHED') return 'FINISHED';
  if (['SCHEDULED', 'TIMED'].includes(m.status)) return 'UPCOMING';
  return 'OTHER';
}

function badgeClass(m) {
  const group = matchGroup(m);

  if (group === 'LIVE') return 'badge live';
  if (group === 'FINISHED') return 'badge finished';
  if (group === 'UPCOMING') return 'badge upcoming';

  return 'badge';
}

function teamName(team) {
  if (!team) return '-';
  if (typeof team === 'string') return team;

  return team.name || team.shortName || team.tla || team.fullName || '-';
}

function competitionName(m) {
  if (!m) return 'بطولة غير معروفة';

  if (typeof m.competition === 'string') {
    return m.competition;
  }

  return m.competition?.name || m.competitionCode || 'بطولة غير معروفة';
}

function scoreOf(m) {
  if (!m || !m.score) return '- - -';

  const home =
    m.score?.fullTime?.home ??
    m.score?.halfTime?.home ??
    m.score?.regularTime?.home;

  const away =
    m.score?.fullTime?.away ??
    m.score?.halfTime?.away ??
    m.score?.regularTime?.away;

  if (home === null || home === undefined || away === null || away === undefined) {
    return '- - -';
  }

  return `${home} - ${away}`;
}

function fallbackLogo(name) {
  const text = encodeURIComponent((name || 'TEAM').slice(0, 14));
  return `https://placehold.co/100x100/0b1411/22c55e?text=${text}`;
}

function teamLogo(team) {
  if (!team) return fallbackLogo('TEAM');

  if (typeof team === 'string') {
    return fallbackLogo(team);
  }

  return (
    team.crest ||
    team.logo ||
    team.emblem ||
    team.image ||
    fallbackLogo(teamName(team))
  );
}

function getSelectedMatch() {
  return (
    allMatches.find(m => String(m.id) === String(selectedMatchId)) ||
    allMatches[0] ||
    null
  );
}

/* =========================
   API
========================= */

async function loadConfig() {
  try {
    const res = await fetch('/api/config');

    if (!res.ok) return;

    const config = await res.json();

    if (config.watchLink) {
      watchLink = config.watchLink;
    }

    const officialWatchLink = document.getElementById('officialWatchLink');
    const cpaSideLink = document.getElementById('cpaSideLink');

    if (officialWatchLink) officialWatchLink.href = watchLink;
    if (cpaSideLink) cpaSideLink.href = watchLink;
  } catch (e) {
    console.warn('Config error:', e);
  }
}

async function loadMatches() {
  if (matchesList) {
    matchesList.innerHTML = `<div class="loading">جاري تحميل المباريات...</div>`;
  }

  if (apiStatus) {
    apiStatus.textContent = 'جاري الاتصال بـ API...';
  }

  try {
    const days = daysFilter?.value || '7';
    const res = await fetch(`/api/matches?days=${days}`);

    if (!res.ok) {
      throw new Error('API error');
    }

    const data = await res.json();

    allMatches = Array.isArray(data.matches) ? data.matches : [];

    buildLeagueFilter();

    if (apiStatus) {
      apiStatus.textContent = `متصل ✅ تم جلب ${allMatches.length} مباراة.`;
    }
  } catch (e) {
    console.error(e);

    allMatches = [];

    if (apiStatus) {
      apiStatus.textContent = 'فشل الاتصال بـ API ❌';
    }

    if (matchesList) {
      matchesList.innerHTML = `
        <div class="empty">
          حدث خطأ أثناء تحميل المباريات.
          <br>
          تأكد أن /api/matches يعمل.
        </div>
      `;
    }
  }
}

/* =========================
   Filters + Stats
========================= */

function buildLeagueFilter() {
  if (!leagueFilter) return;

  const oldValue = leagueFilter.value || 'ALL';

  const leagues = [...new Set(
    allMatches
      .map(m => competitionName(m))
      .filter(Boolean)
  )];

  leagueFilter.innerHTML = `<option value="ALL">كل البطولات</option>`;

  leagues.forEach(league => {
    const option = document.createElement('option');
    option.value = league;
    option.textContent = league;
    leagueFilter.appendChild(option);
  });

  if ([...leagueFilter.options].some(o => o.value === oldValue)) {
    leagueFilter.value = oldValue;
  }
}

function filteredMatches() {
  let list = [...allMatches];

  if (currentTab === 'LIVE') {
    list = list.filter(m => matchGroup(m) === 'LIVE');
  }

  if (currentTab === 'UPCOMING') {
    list = list.filter(m => matchGroup(m) === 'UPCOMING');
  }

  if (currentTab === 'FINISHED') {
    list = list.filter(m => matchGroup(m) === 'FINISHED');
  }

  if (leagueFilter && leagueFilter.value !== 'ALL') {
    list = list.filter(m => competitionName(m) === leagueFilter.value);
  }

  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.trim().toLowerCase();

    list = list.filter(m => {
      const home = teamName(m.homeTeam).toLowerCase();
      const away = teamName(m.awayTeam).toLowerCase();
      const comp = competitionName(m).toLowerCase();

      return home.includes(q) || away.includes(q) || comp.includes(q);
    });
  }

  return list;
}

function updateStats() {
  if (fields.statAll) {
    fields.statAll.textContent = allMatches.length;
  }

  if (fields.statLive) {
    fields.statLive.textContent = allMatches.filter(m => matchGroup(m) === 'LIVE').length;
  }

  if (fields.statUpcoming) {
    fields.statUpcoming.textContent = allMatches.filter(m => matchGroup(m) === 'UPCOMING').length;
  }

  if (fields.statFinished) {
    fields.statFinished.textContent = allMatches.filter(m => matchGroup(m) === 'FINISHED').length;
  }
}

/* =========================
   Hero + Details
========================= */

function autoSelectHeroMatch() {
  const liveMatch = allMatches.find(m => matchGroup(m) === 'LIVE');
  const upcomingMatch = allMatches.find(m => matchGroup(m) === 'UPCOMING');
  const finishedMatch = allMatches.find(m => matchGroup(m) === 'FINISHED');

  selectedMatchId =
    liveMatch?.id ||
    upcomingMatch?.id ||
    finishedMatch?.id ||
    allMatches[0]?.id ||
    null;
}

function renderHero() {
  const match = getSelectedMatch();

  if (!match) return;

  const home = teamName(match.homeTeam);
  const away = teamName(match.awayTeam);
  const comp = competitionName(match);

  if (fields.heroLeague) fields.heroLeague.textContent = comp;
  if (fields.heroHomeTeam) fields.heroHomeTeam.textContent = home;
  if (fields.heroAwayTeam) fields.heroAwayTeam.textContent = away;
  if (fields.heroScore) fields.heroScore.textContent = scoreOf(match);
  if (fields.heroTime) fields.heroTime.textContent = formatDZTime(match.utcDate);

  if (fields.heroHomeLogo) {
    fields.heroHomeLogo.src = teamLogo(match.homeTeam);
    fields.heroHomeLogo.alt = home;
  }

  if (fields.heroAwayLogo) {
    fields.heroAwayLogo.src = teamLogo(match.awayTeam);
    fields.heroAwayLogo.alt = away;
  }
}

function renderDetails() {
  const match = getSelectedMatch();

  if (!match) return;

  const home = teamName(match.homeTeam);
  const away = teamName(match.awayTeam);
  const comp = competitionName(match);
  const score = scoreOf(match);
  const status = statusAr(match.status);
  const time = formatDZTime(match.utcDate);

  if (fields.selectedTitle) fields.selectedTitle.textContent = `${home} ضد ${away}`;
  if (fields.homeTeam) fields.homeTeam.textContent = home;
  if (fields.awayTeam) fields.awayTeam.textContent = away;
  if (fields.scoreText) fields.scoreText.textContent = score;
  if (fields.matchStatus) fields.matchStatus.textContent = status;
  if (fields.competitionName) fields.competitionName.textContent = comp;
  if (fields.matchTime) fields.matchTime.textContent = time;
  if (fields.statusSmall) fields.statusSmall.textContent = status;
  if (fields.lastUpdate) fields.lastUpdate.textContent = new Date().toLocaleTimeString('ar-DZ');

  if (fields.homeLogo) {
    fields.homeLogo.src = teamLogo(match.homeTeam);
    fields.homeLogo.alt = home;
  }

  if (fields.awayLogo) {
    fields.awayLogo.src = teamLogo(match.awayTeam);
    fields.awayLogo.alt = away;
  }

  if (fields.autoArticle) {
    fields.autoArticle.innerHTML = `
      <p>
        يلتقي <b>${home}</b> مع <b>${away}</b> ضمن منافسات <b>${comp}</b>.
        موعد المباراة هو <b>${time}</b> بتوقيت الجزائر،
        وحالة المباراة الحالية: <b>${status}</b>.
      </p>
    `;
  }
}

function selectMatch(m) {
  selectedMatchId = m.id;
  renderHero();
  renderDetails();

  const details = document.querySelector('.match-page');
  if (details) {
    details.scrollIntoView({ behavior: 'smooth' });
  }
}

/* =========================
   Render Matches
========================= */

function renderAll() {
  updateStats();
  renderHero();
  renderDetails();
  renderMatches();
  renderCompactLists();
}

function renderMatches() {
  if (!matchesList) return;

  const list = filteredMatches();

  if (!list.length) {
    matchesList.innerHTML = `
      <div class="empty">
        لا توجد مباريات حسب الفلترة الحالية.
      </div>
    `;
    return;
  }

  matchesList.innerHTML = '';

  list.forEach(m => {
    matchesList.appendChild(matchCard(m));
  });
}

function matchCard(m) {
  const home = teamName(m.homeTeam);
  const away = teamName(m.awayTeam);
  const comp = competitionName(m);

  const card = document.createElement('article');
  card.className = 'match-card';

  card.innerHTML = `
    <div class="match-top">
      <span class="${badgeClass(m)}">${statusAr(m.status)}</span>
      <span>${onlyTime(m.utcDate)}</span>
    </div>

    <div class="match-teams">
      <div class="mini-team">
        <img src="${teamLogo(m.homeTeam)}" alt="${home}">
        <b>${home}</b>
      </div>

      <div class="mini-score">${scoreOf(m)}</div>

      <div class="mini-team">
        <img src="${teamLogo(m.awayTeam)}" alt="${away}">
        <b>${away}</b>
      </div>
    </div>

    <div class="match-bottom">
      <small>${comp}</small>
      <button type="button">عرض التفاصيل</button>
    </div>
  `;

  const btn = card.querySelector('button');
  if (btn) {
    btn.onclick = () => selectMatch(m);
  }

  return card;
}

function renderCompactLists() {
  if (fields.liveList) {
    const live = allMatches.filter(m => matchGroup(m) === 'LIVE').slice(0, 6);

    fields.liveList.innerHTML = live.length
      ? live.map(compactItem).join('')
      : `<div class="empty">لا توجد مباريات مباشرة الآن.</div>`;
  }

  if (fields.nextList) {
    const next = allMatches.filter(m => matchGroup(m) === 'UPCOMING').slice(0, 6);

    fields.nextList.innerHTML = next.length
      ? next.map(compactItem).join('')
      : `<div class="empty">لا توجد مباريات قادمة.</div>`;
  }
}

function compactItem(m) {
  return `
    <div class="compact-item">
      <span>${teamName(m.homeTeam)}</span>
      <b>${scoreOf(m)}</b>
      <span>${teamName(m.awayTeam)}</span>
      <small>${onlyTime(m.utcDate)}</small>
    </div>
  `;
}

/* =========================
   Start
========================= */

async function init() {
  await loadConfig();
  await loadMatches();

  autoSelectHeroMatch();
  renderAll();
}

init();

setInterval(async () => {
  await loadMatches();
  autoSelectHeroMatch();
  renderAll();
}, 60000);
