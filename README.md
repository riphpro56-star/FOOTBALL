# Football Live Vercel

Dark mobile-first football live scores website for Vercel.

## Files
- `index.html`
- `style.css`
- `script.js`
- `api/matches.js`
- `api/highlights.js`
- `api/team.js`

## Vercel Environment Variables

Add these in:

`Vercel → Project → Settings → Environment Variables`

```txt
API_FOOTBALL_KEY=your_new_api_sports_key
FOOTBALL_DATA_KEY=your_new_football_data_key
```

Important: regenerate the keys you shared publicly before using them in production.

## Deploy

Upload this folder to GitHub, then import it in Vercel.

After adding environment variables, press:

`Deployments → Redeploy`

## API routes

- `/api/matches?date=YYYY-MM-DD`
- `/api/highlights`
- `/api/team?name=Barcelona`

## Notes

The website uses:
- API-Football for live scores and fixtures
- football-data.org as backup
- ScoreBat for videos
- TheSportsDB for team info
