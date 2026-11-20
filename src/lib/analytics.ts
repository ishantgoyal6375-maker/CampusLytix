// Optional Google Analytics 4 usage tracking (strictly non-PII application usage events)

const CONSENT_KEY = 'clubpulse.ga4.consent';
const MEASUREMENT_ID = (import.meta.env.VITE_GA4_MEASUREMENT_ID || '').trim();

let initialized = false;

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export function isGA4Configured(): boolean {
  return Boolean(MEASUREMENT_ID);
}

export function getGA4MeasurementId(): string | null {
  return MEASUREMENT_ID || null;
}

export function getGA4Consent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function setGA4Consent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {
    // Ignore storage errors
  }
  if (granted && MEASUREMENT_ID) {
    initGA4();
  }
}

export function initGA4(): boolean {
  if (!MEASUREMENT_ID || !getGA4Consent() || initialized) {
    return initialized;
  }
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false,
  });
  initialized = true;
  return true;
}

export type PermittedUsageEvent =
  | 'dashboard_visit'
  | 'navigation_change'
  | 'report_download'
  | 'data_import'
  | 'integration_action';

export function trackAppUsage(
  eventName: PermittedUsageEvent,
  params: Record<string, string | number | boolean> = {}
) {
  if (!MEASUREMENT_ID || !getGA4Consent()) return;
  if (!initialized) {
    initGA4();
  }
  // Never transmit personally identifiable student information
  const safeParams: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (/email|name|student|phone|uid/i.test(k)) continue;
    safeParams[k] = v;
  }
  window.gtag?.('event', eventName, safeParams);
}
