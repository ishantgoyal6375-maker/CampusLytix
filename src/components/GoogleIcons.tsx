import React from 'react';

export const GoogleGLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export const GoogleServiceIcon: React.FC<{
  service:
    | 'cloud_sql'
    | 'firebase_auth'
    | 'google_sheets'
    | 'google_drive'
    | 'google_calendar'
    | 'google_forms'
    | 'gemini_ai'
    | 'cloud_storage'
    | 'cloud_run'
    | 'ga4';
  className?: string;
}> = ({ service, className = 'w-7 h-7' }) => {
  switch (service) {
    case 'google_sheets':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <rect x="4" y="2" width="24" height="28" rx="3" fill="#0F9D58" />
          <path d="M20 2l8 8h-8V2z" fill="#87CEAC" />
          <rect x="8" y="13" width="16" height="11" rx="1" fill="#FFFFFF" fillOpacity="0.95" />
          <line x1="14" y1="13" x2="14" y2="24" stroke="#0F9D58" strokeWidth="1.5" />
          <line x1="8" y1="17" x2="24" y2="17" stroke="#0F9D58" strokeWidth="1.5" />
          <line x1="8" y1="20.5" x2="24" y2="20.5" stroke="#0F9D58" strokeWidth="1.5" />
        </svg>
      );
    case 'google_drive':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <path d="M11 4h10l9 15.5-5 8.5H7L2 19.5 11 4z" fill="none" />
          <polygon points="11.2,4 20.8,4 30,20 20.4,20" fill="#FBBC04" />
          <polygon points="2,20 11.2,4 16,12.3 6.8,28" fill="#0F9D58" />
          <polygon points="6.8,28 11.6,20 30,20 25.2,28" fill="#4285F4" />
        </svg>
      );
    case 'google_calendar':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <rect x="3" y="4" width="26" height="24" rx="3" fill="#4285F4" />
          <rect x="7" y="9" width="18" height="15" rx="1.5" fill="#FFFFFF" />
          <rect x="3" y="22" width="6" height="6" rx="1" fill="#1967D2" />
          <rect x="23" y="22" width="6" height="6" rx="1" fill="#EA4335" />
          <text
            x="16"
            y="20.5"
            textAnchor="middle"
            fill="#1967D2"
            fontSize="10"
            fontWeight="700"
            fontFamily="sans-serif"
          >
            31
          </text>
        </svg>
      );
    case 'google_forms':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <rect x="4" y="2" width="24" height="28" rx="3" fill="#7248B9" />
          <path d="M20 2l8 8h-8V2z" fill="#C4B0EA" />
          <circle cx="10" cy="14" r="1.5" fill="#FFFFFF" />
          <rect x="13.5" y="13" width="10" height="2" rx="1" fill="#FFFFFF" />
          <circle cx="10" cy="19" r="1.5" fill="#FFFFFF" />
          <rect x="13.5" y="18" width="10" height="2" rx="1" fill="#FFFFFF" />
          <circle cx="10" cy="24" r="1.5" fill="#FFFFFF" />
          <rect x="13.5" y="23" width="7" height="2" rx="1" fill="#FFFFFF" />
        </svg>
      );
    case 'firebase_auth':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <path d="M6 24L10 6l5 9-9 9z" fill="#FFA000" />
          <path d="M6 24l10 5 10-5-4-16-6 7-10 9z" fill="#F57C00" />
          <path d="M6 24l10-12 6 12-6 5-10-5z" fill="#FFCA28" />
        </svg>
      );
    case 'cloud_sql':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <ellipse cx="16" cy="8" rx="11" ry="4.5" fill="#4285F4" />
          <path d="M5 8v7c0 2.5 4.9 4.5 11 4.5s11-2 11-4.5V8c0 2.5-4.9 4.5-11 4.5S5 10.5 5 8z" fill="#669DF6" />
          <path d="M5 16v7c0 2.5 4.9 4.5 11 4.5s11-2 11-4.5v-7c0 2.5-4.9 4.5-11 4.5S5 18.5 5 16z" fill="#1A73E8" />
        </svg>
      );
    case 'gemini_ai':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="geminiGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#315EF8" />
              <stop offset="55%" stopColor="#7657E8" />
              <stop offset="100%" stopColor="#18B6A0" />
            </linearGradient>
          </defs>
          <path
            d="M16 2C16.8 10.2 21.8 15.2 30 16C21.8 16.8 16.8 21.8 16 30C15.2 21.8 10.2 16.8 2 16C10.2 15.2 15.2 10.2 16 2Z"
            fill="url(#geminiGrad)"
          />
        </svg>
      );
    case 'cloud_storage':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <rect x="3" y="5" width="26" height="9" rx="2" fill="#4285F4" />
          <rect x="3" y="18" width="26" height="9" rx="2" fill="#1A73E8" />
          <circle cx="8" cy="9.5" r="1.7" fill="#FFFFFF" />
          <rect x="13" y="8.5" width="11" height="2" rx="1" fill="#FFFFFF" />
          <circle cx="8" cy="22.5" r="1.7" fill="#FFFFFF" />
          <rect x="13" y="21.5" width="11" height="2" rx="1" fill="#FFFFFF" />
        </svg>
      );
    case 'cloud_run':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <polygon points="4,16 14,5 20,5 10,16 20,27 14,27" fill="#4285F4" />
          <polygon points="14,16 22,7 28,16 22,25" fill="#1A73E8" />
        </svg>
      );
    case 'ga4':
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
          <rect x="21" y="4" width="6" height="24" rx="3" fill="#F9AB00" />
          <rect x="13" y="12" width="6" height="16" rx="3" fill="#E37400" />
          <circle cx="8" cy="25" r="3" fill="#E37400" />
        </svg>
      );
  }
};
