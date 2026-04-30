export default function handler(req, res) {
  return res.status(200).json({
    watchLink: process.env.WATCH_LINK || 'https://example.com/cpa-offer',
    timezoneLabel: 'توقيت الجزائر'
  });
}
