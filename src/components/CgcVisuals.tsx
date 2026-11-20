import React from 'react';
import { CheckCircle2, Clock, FlaskConical, ShieldCheck, Layers } from 'lucide-react';
import type { StructureViewMode, VerificationStatus } from '../types';

/**
 * Clean, WCAG-AA compliant verification indicator (rectangular, never a decorative pill).
 * Always pairs color with explicit icon + text label.
 */
export const VerificationTag: React.FC<{
  status: VerificationStatus | string;
  compact?: boolean;
}> = ({ status, compact = false }) => {
  const normalized = String(status || 'PENDING_VERIFICATION').toUpperCase();

  if (normalized === 'CONFIRMED') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold whitespace-nowrap shrink-0 ${
          compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
        }`}
      >
        <CheckCircle2 className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        <span>Verified</span>
      </span>
    );
  }

  if (normalized === 'DEMO') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-900 font-semibold whitespace-nowrap shrink-0 ${
          compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
        }`}
      >
        <FlaskConical className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        <span>Demo / Illustrative</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 text-slate-700 font-semibold whitespace-nowrap shrink-0 ${
        compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <Clock className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      <span>Pending Verification</span>
    </span>
  );
};

/**
 * Global switcher between Verified Institutional Structure and University Demo Structure.
 */
export const StructureModeSwitcher: React.FC<{
  mode: StructureViewMode;
  onChange: (mode: StructureViewMode) => void;
}> = ({ mode, onChange }) => {
  return (
    <div
      role="group"
      aria-label="Institutional structure view mode"
      className="inline-flex items-center p-1 bg-[#F4F6FC] border border-slate-200/90 rounded-lg"
    >
      <button
        type="button"
        onClick={() => onChange('verified')}
        className={`h-8 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
          mode === 'verified'
            ? 'bg-[#101B3A] text-white shadow-xs'
            : 'text-slate-600 hover:text-[#101B3A]'
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Verified Institutional Structure</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('demo')}
        className={`h-8 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
          mode === 'demo'
            ? 'bg-amber-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-[#101B3A]'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>University Demo Structure</span>
      </button>
    </div>
  );
};

/**
 * Bespoke abstract institutional SVG emblem for each of the 11 CGC University clubs.
 * Strictly avoids stock photography or unverified unofficial club logos.
 */
export const CgcClubEmblem: React.FC<{
  code: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ code, size = 'md' }) => {
  const dims =
    size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-14 h-14' : 'w-11 h-11';
  const c = code.toUpperCase();

  // Distinct geometric SVG signatures grounded in ClubPulse's palette
  const palette: Record<string, { bg: string; primary: string; secondary: string }> = {
    DSA: { bg: '#EEF2FF', primary: '#101B3A', secondary: '#315EF8' },
    SAC: { bg: '#EEF2FF', primary: '#1E3A8A', secondary: '#315EF8' },
    CSM: { bg: '#F3EFFE', primary: '#7657E8', secondary: '#315EF8' },
    VNEST: { bg: '#ECFDF5', primary: '#0F766E', secondary: '#18B6A0' },
    DCC: { bg: '#FEF3C7', primary: '#92400E', secondary: '#D97706' },
    DRR: { bg: '#FEF3C7', primary: '#92400E', secondary: '#D97706' },
    NCC: { bg: '#F1F5F9', primary: '#101B3A', secondary: '#475569' },
    NGO: { bg: '#ECFDF5', primary: '#047857', secondary: '#18B6A0' },
    ICA: { bg: '#EFF6FF', primary: '#315EF8', secondary: '#18B6A0' },
    D4C: { bg: '#F3EFFE', primary: '#101B3A', secondary: '#7657E8' },
    ICTSE: { bg: '#EFF6FF', primary: '#1E40AF', secondary: '#7657E8' },
  };

  const colors = palette[c] ?? {
    bg: '#EEF2FF',
    primary: '#101B3A',
    secondary: '#315EF8',
  };

  return (
    <div
      className={`${dims} rounded-xl border border-slate-200/90 flex items-center justify-center shrink-0`}
      style={{ backgroundColor: colors.bg }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="w-7 h-7" fill="none">
        {c === 'DSA' && (
          <>
            <polygon points="18,4 31,11 18,18 5,11" fill={colors.primary} />
            <path d="M8 15.5V24.5L18 30L28 24.5V15.5" stroke={colors.secondary} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="18" cy="18" r="2.5" fill="#FFFFFF" />
          </>
        )}
        {c === 'SAC' && (
          <>
            <path d="M18 4L29 8.5V17.5C29 24 24.2 28.8 18 31C11.8 28.8 7 24 7 17.5V8.5L18 4Z" stroke={colors.primary} strokeWidth="2.4" fill="none" />
            <path d="M13.5 18L16.5 21L23 14.5" stroke={colors.secondary} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {c === 'CSM' && (
          <>
            <circle cx="10" cy="18" r="3.5" fill={colors.primary} />
            <circle cx="26" cy="10" r="3.5" fill={colors.secondary} />
            <circle cx="26" cy="26" r="3.5" fill={colors.primary} />
            <path d="M13.2 16.4L22.8 11.6M13.2 19.6L22.8 24.4" stroke={colors.primary} strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}
        {c === 'VNEST' && (
          <>
            <path d="M7 26L15 17L20 21L29 10" stroke={colors.primary} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M23 10H29V16" stroke={colors.secondary} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="7" y1="29" x2="29" y2="29" stroke={colors.secondary} strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {c === 'NCC' && (
          <>
            <polygon points="18,5 21.5,13 30,13.8 23.5,19.5 25.5,28 18,23.5 10.5,28 12.5,19.5 6,13.8 14.5,13" stroke={colors.primary} strokeWidth="2.2" fill="none" strokeLinejoin="round" />
            <circle cx="18" cy="17.5" r="3" fill={colors.secondary} />
          </>
        )}
        {c === 'NGO' && (
          <>
            <circle cx="13" cy="14" r="4" stroke={colors.primary} strokeWidth="2.2" />
            <circle cx="23" cy="14" r="4" stroke={colors.secondary} strokeWidth="2.2" />
            <path d="M7 27C7 22.8 9.8 20.5 13 20.5C15.5 20.5 17 21.6 18 23C19 21.6 20.5 20.5 23 20.5C26.2 20.5 29 22.8 29 27" stroke={colors.primary} strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}
        {c === 'ICA' && (
          <>
            <rect x="6" y="6" width="10" height="10" rx="2" fill={colors.primary} />
            <rect x="20" y="6" width="10" height="10" rx="2" fill={colors.secondary} />
            <rect x="6" y="20" width="10" height="10" rx="2" fill={colors.secondary} fillOpacity="0.45" />
            <rect x="20" y="20" width="10" height="10" rx="2" stroke={colors.primary} strokeWidth="2.2" />
          </>
        )}
        {c === 'D4C' && (
          <>
            <path d="M13 11L6 18L13 25" stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M23 11L30 18L23 25" stroke={colors.secondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="20" y1="9" x2="16" y2="27" stroke={colors.secondary} strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}
        {c === 'ICTSE' && (
          <>
            <rect x="11" y="11" width="14" height="14" rx="2.5" stroke={colors.primary} strokeWidth="2.2" />
            <rect x="15" y="15" width="6" height="6" rx="1" fill={colors.secondary} />
            <path d="M15 6V11M21 6V11M15 25V30M21 25V30M6 15H11M6 21H11M25 15H30M25 21H30" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {(c === 'DCC' || c === 'DRR' || !['DSA', 'SAC', 'CSM', 'VNEST', 'NCC', 'NGO', 'ICA', 'D4C', 'ICTSE'].includes(c)) && (
          <>
            <rect x="6" y="6" width="24" height="24" rx="5" stroke={colors.primary} strokeWidth="2" strokeDasharray="3 2.5" />
            <text
              x="18"
              y="21.5"
              textAnchor="middle"
              fill={colors.primary}
              fontSize="10"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {c.slice(0, 3)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
};
