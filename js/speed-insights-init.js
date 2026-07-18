// Initialize Vercel Speed Insights
import { injectSpeedInsights } from './speed-insights.js';

// Inject Speed Insights when the page loads
if (typeof window !== 'undefined') {
  injectSpeedInsights();
}
