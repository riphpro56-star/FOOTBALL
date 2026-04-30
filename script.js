const themeBtn = document.getElementById('themeBtn');
const refreshBtn = document.getElementById('refreshBtn');
const matchesList = document.getElementById('matchesList');
const leagueFilter = document.getElementById('leagueFilter');
const searchInput = document.getElementById('searchInput');

const fields = {
  statAll: document.getElementById('statAll'),
  statLive: document.getElementById('statLive'),
  statFinished: document.getElementById('statFinished'),
  statUpcoming: document.getElementById('statUpcoming'),

  heroLeague: document.getElementById('heroLeague'),
  heroHome: document.getElementById('heroHome'),
  heroAway: document.getElementById('heroAway'),
  heroScore: document.getElementById('heroScore'),
  heroTime: document.getElementById('heroTime'),
  heroStatus: document.getElementById('heroStatus'),
  heroHomeLogo: document.getElementById('heroHomeLogo'),
  heroAwayLogo: document.getElementById('heroAwayLogo')
};

let allMatches = [];
let currentTab = 'ALL';
let selectedMatchId = null;

/* =========================
   أزرار عامة
========================= */

if (themeBtn) {
  themeBtn.onclick = () => {
    document.body.classList.toggle('light');
    localStorage.setItem(
      'theme',
      document.body.classList.contains('light') ? 'light' : 'dark'
    );
  };
}

if (localStorage.getItem('theme') === 'light') {
  document.body.classList.add('light');
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

if (leagueFilter) {
  leagueFilter.onchange = renderMatches;
}

if (searchInput) {
  searchInput.oninput = renderMatches;
}

/* =========================
   الوقت والحالة
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
  if (['FINISHED'].includes(m.status)) return 'FINISHED';
  if (['SCHEDULED', 'TIMED'].includes(m.status)) return 'UPCOMING';
  return 'OTHER';
}

function badgeClass(m) {
  const g = matchGroup(m);

  if (g === 'LIVE') return 'badge live';
  if (g === 'FINISHED') return 'badge finished';
  if (g === 'UPCOMING') return 'badge upcoming';

  return 'badge';
}

/* =========================
   النتيجة والشعارات
========================= */

function scoreOf(m) {
  const home =
    m.score?.fullTime?.home ??
    m.score?.halfTime?.home ??
    m.score?.regularTime?.home ??
    '-';

  const away =
    m.score?.fullTime?.away ??
    m.score?.halfTime?.away ??
    m.score?.regularTime?.away ??
    '-';

  return `${home} - ${away}`;
}

function fallbackLogo(name) {
  const text = encodeURIComponent((name || 'TEAM').slice(0, 12));

  return `https://placehold.co/100x100/0b1411/22c55e?text=${text}`;
}

function logoUrl(url, name) {
  if (url) return url;

  return fallbackLogo(name);
}

function teamName(team) {
  if (!team) return '-';
  if (typeof team === 'string') return team;

  return team.name || team.shortName || team.tla || '-';
}

function teamLogo(team) {
  if (!team || typeof team === 'string') {
    return fallbackLogo(team);
  }

  return logoUrl(
    team.crest || team.logo || team.emblem || team.image || '',
    teamName(team)
  );
}

/* =========================
   جلب البيانات
========================= */

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return null;

    return await res.json();
  } catch (e) {
    console.warn('Config error:', e);
    return null;
  }
}

async function loadMatches() {
  if (matchesList) {
    matchesList.innerHTML = `<div class="loading">جاري تحميل المباريات...</div>`;
  }

  try {
    const res = await fetch('/api/matches');

    if (!res.ok) {
      throw new Error('API error');
    }

    const data = await res.json();

    allMatches = Array.isArray(data.matches) ? data.matches : [];

    buildLeagueFilter();
  } catch (e) {
    console.error(e);

    allMatches = [];

    if (matchesList) {
      matchesList.innerHTML = `
        <div class="empty">
          حدث خطأ أثناء تحميل المباريات.
          <br>
          تأكد أن رابط /api/matches يعمل.
        </div>
      `;
    }
  }
}

/* =========================
   الفلترة والإحصائيات
========================= */

function buildLeagueFilter() {
  if (!leagueFilter) return;

  const currentValue = leagueFilter.value;

  const leagues = [...new Set(
    allMatches
      .map(m => m.competition?.name || m.competition || 'بطولة غير معروفة')
      .filter(Boolean)
  )];

  leagueFilter.innerHTML = `<option value="ALL">كل البطولات</option>`;

  leagues.forEach(league => {
    const option = document.createElement('option');
    option.value = league;
    option.textContent = league;
    leagueFilter.appendChild(option);
  });

  if ([...leagueFilter.options].some(o => o.value === currentValue)) {
    leagueFilter.value = currentValue;
  }
}

function filteredMatches() {
  let list = [...allMatches];

  if (currentTab === 'LIVE') {
    list = list.filter(m => matchGroup(m) === 'LIVE');
  }

  if (currentTab === 'FINISHED') {
    list = list.filter(m => matchGroup(m) === 'FINISHED');
  }

  if (currentTab === 'UPCOMING') {
    list = list.filter(m => matchGroup(m) === 'UPCOMING');
  }

  if (leagueFilter && leagueFilter.value && leagueFilter.value !== 'ALL') {
    list = list.filter(m => {
      const league = m.competition?.name || m.competition || 'بطولة غير معروفة';
      return league === leagueFilter.value;
    });
  }

  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.trim().toLowerCase();

    list = list.filter(m => {
      const home = teamName(m.homeTeam).toLowerCase();
      const away = teamName(m.awayTeam).toLowerCase();
      const league = String(m.competition?.name || m.competition || '').toLowerCase();

      return home.includes(q) || away.includes(q) || league.includes(q);
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

  if (fields.statFinished) {
    fields.statFinished.textContent = allMatches.filter(m => matchGroup(m) === 'FINISHED').length;
  }

  if (fields.statUpcoming) {
    fields.statUpcoming.textContent = allMatches.filter(m => matchGroup(m) === 'UPCOMING').length;
  }
}

/* =========================
   مباراة الواجهة الكبيرة
========================= */

function autoSelectHeroMatch() {
  const liveMatch = allMatches.find(m =>
    ['IN_PLAY', 'LIVE', 'PAUSED'].includes(m.status)
  );

  const upcomingMatch = allMatches.find(m =>
    ['SCHEDULED', 'TIMED'].includes(m.status)
  );

  selectedMatchId =
    liveMatch?.id ||
    upcomingMatch?.id ||
    allMatches[0]?.id ||
    null;
}

function renderHero() {
  if (!selectedMatchId && allMatches.length) {
    autoSelectHeroMatch();
  }

  const match =
    allMatches.find(m => String(m.id) === String(selectedMatchId)) ||
    allMatches[0];

  if (!match) return;

  const home = teamName(match.homeTeam);
  const away = teamName(match.awayTeam);
  const league = match.competition?.name || match.competition || 'بطولة غير معروفة';

  if (fields.heroLeague) fields.heroLeague.textContent = league;
  if (fields.heroHome) fields.heroHome.textContent = home;
  if (fields.heroAway) fields.heroAway.textContent = away;
  if (fields.heroScore) fields.heroScore.textContent = scoreOf(match);
  if (fields.heroTime) fields.heroTime.textContent = formatDZTime(match.utcDate);
  if (fields.heroStatus) fields.heroStatus.textContent = statusAr(match.status);

  if (fields.heroHomeLogo) {
    fields.heroHomeLogo.src = teamLogo(match.homeTeam);
    fields.heroHomeLogo.alt = home;
  }

  if (fields.heroAwayLogo) {
    fields.heroAwayLogo.src = teamLogo(match.awayTeam);
    fields.heroAwayLogo.alt = away;
  }
}

function selectMatch(m) {
  selectedMatchId = m.id;
  renderHero();

  window.location.hash = 'hero';
}

/* =========================
   عرض المباريات
========================= */

function renderAll() {
  updateStats();
  renderHero();
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
  const league = m.competition?.name || m.competition || 'بطولة غير معروفة';

  const card = document.createElement('div');
  card.className = 'match-card';

  card.innerHTML = `
    <div class="match-top">
      <span class="${badgeClass(m)}">${statusAr(m.status)}</span>
      <span class="match-time">${onlyTime(m.utcDate)}</span>
    </div>

    <div class="match-body">
      <div class="team">
        <img src="${teamLogo(m.homeTeam)}" alt="${home}">
        <strong>${home}</strong>
      </div>

      <div class="score">
        ${scoreOf(m)}
      </div>

      <div class="team">
        <img src="${teamLogo(m.awayTeam)}" alt="${away}">
        <strong>${away}</strong>
      </div>
    </div>

    <div class="match-footer">
      <span>${league}</span>
      <button class="details-btn">عرض في الواجهة</button>
    </div>
  `;

  const btn = card.querySelector('.details-btn');
  if (btn) {
    btn.onclick = () => selectMatch(m);
  }

  return card;
}

/* =========================
   قائمة مختصرة للمباشر والقادمة
========================= */

function renderCompactLists() {
  const liveBox = document.getElementById('liveList');
  const upcomingBox = document.getElementById('upcomingList');

  if (liveBox) {
    const live = allMatches.filter(m => matchGroup(m) === 'LIVE').slice(0, 5);

    liveBox.innerHTML = live.length
      ? live.map(compactItem).join('')
      : `<div class="empty-small">لا توجد مباريات مباشرة الآن</div>`;
  }

  if (upcomingBox) {
    const upcoming = allMatches.filter(m => matchGroup(m) === 'UPCOMING').slice(0, 5);

    upcomingBox.innerHTML = upcoming.length
      ? upcoming.map(compactItem).join('')
      : `<div class="empty-small">لا توجد مباريات قادمة</div>`;
  }
}

function compactItem(m) {
  const home = teamName(m.homeTeam);
  const away = teamName(m.awayTeam);

  return `
    <div class="compact-item">
      <span>${home}</span>
      <b>${scoreOf(m)}</b>
      <span>${away}</span>
      <small>${onlyTime(m.utcDate)}</small>
    </div>
  `;
}

/* =========================
   تشغيل الموقع
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
