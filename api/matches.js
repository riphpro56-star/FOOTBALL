export default async function handler(req, res) {
  try {
    const token = process.env.FOOTBALL_API_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: 'Missing FOOTBALL_API_TOKEN'
      });
    }

    const days = Number(req.query.days || 7);
    const today = new Date();

    const from = today.toISOString().split('T')[0];

    const toDate = new Date(today);
    toDate.setDate(today.getDate() + days);

    const to = toDate.toISOString().split('T')[0];

    const url = `https://api.football-data.org/v4/matches?dateFrom=${from}&dateTo=${to}`;

    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': token
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json({
      source: 'football-data.org',
      count: data.matches?.length || 0,
      matches: data.matches || []
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
}
