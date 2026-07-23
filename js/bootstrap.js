if (window.location.protocol === 'https:') {
  const insights = document.createElement('script');
  insights.src = '/_vercel/speed-insights/script.js';
  insights.defer = true;
  document.body.append(insights);
}
