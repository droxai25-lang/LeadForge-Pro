// Web Vitals RUM (Real User Monitoring) Setup
// Tracks Core Web Vitals: LCP, INP, CLS for real users

export function initializeWebVitals() {
  // Dynamic import to avoid breaking if web-vitals not available
  import('web-vitals').then((module) => {
    const { getCLS, getFCP, getFID, getLCP, getTTFB } = module as any;
    
    getCLS(sendToAnalytics);
    getFCP(sendToAnalytics);
    getFID(sendToAnalytics);
    getLCP(sendToAnalytics);
    getTTFB(sendToAnalytics);
  });
}

// Send metric to your analytics service
function sendToAnalytics(metric: any) {
  // Google Analytics event
  if ((window as any).gtag) {
    (window as any).gtag('event', metric.name, {
      event_category: 'Web Vitals',
      value: Math.round(metric.value),
      event_label: metric.id,
      non_interaction: true,
    });
  }

  console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms`);
}
