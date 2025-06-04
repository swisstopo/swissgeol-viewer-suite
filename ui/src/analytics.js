const GA_MEASUREMENT_ID = 'G-E15CQLC985';

export function initAnalytics(active) {
  if (active) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      // eslint-disable-next-line prefer-rest-params
      dataLayer.push(arguments);
    }
    gtag('js', new Date());
    gtag('config', 'G-E15CQLC985');
  }
}
