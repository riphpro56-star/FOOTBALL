
exports.handler=async function(){return{statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'},body:JSON.stringify({watchLink:process.env.WATCH_LINK||'https://example.com/cpa-offer',timezoneLabel:'توقيت الجزائر'})}};
