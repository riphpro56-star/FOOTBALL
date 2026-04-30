exports.handler=async()=>({statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({watchLink:process.env.WATCH_LINK||'https://example.com/cpa-offer'})});
