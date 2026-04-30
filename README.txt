KOORA LIVE V5 - NETLIFY API ENHANCED

ماذا تضيف هذه النسخة؟
- مباريات اليوم والقادمة حتى 14 يوم.
- تبويب: الكل / مباشر الآن / قادمة / منتهية.
- شعارات الفرق إذا أرجعها API.
- فلتر بطولات ديناميكي، أي بطولة ترجع من API تظهر وحدها.
- بحث باسم الفريق أو البطولة.
- قائمة جانبية للمباريات المباشرة.
- قائمة جانبية لأقرب المباريات.
- تحسين كبير في هيكل الموقع والتصميم.
- رابط مشاهدة / CPA من WATCH_LINK.
- تحديث تلقائي كل 5 دقائق.

طريقة التحديث في GitHub:
ارفع واستبدل الملفات:
index.html
style.css
script.js
netlify.toml
netlify/functions/matches.js
netlify/functions/config.js

متغيرات Netlify المطلوبة:
FOOTBALL_DATA_TOKEN = مفتاح football-data.org
WATCH_LINK = رابط CPA أو مشاهدة قانونية

بعد رفع الملفات:
Netlify سيعمل Deploy تلقائيا.
إذا لم يعمل:
Deploys > Trigger deploy > Deploy site

اختبار API:
https://your-site.netlify.app/api/matches?days=7

ملاحظة:
عدد المباريات والدوريات يرجع حسب صلاحيات خطة API الخاصة بك.
