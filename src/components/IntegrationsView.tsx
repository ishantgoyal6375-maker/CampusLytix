import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Link2,
  Unlink,
  RefreshCw,
  Shield,
  BookOpen,
  Users,
  X,
} from 'lucide-react';
import type { UserProfile } from '../types';
import { apiFetch } from '../lib/api';
import {
  clearWorkspaceToken,
  getCachedWorkspaceToken,
  getGrantedScopeGroups,
  type WorkspaceScopeGroup,
} from '../lib/firebase';
import {
  getGA4Consent,
  getGA4MeasurementId,
  isGA4Configured,
  setGA4Consent,
  trackAppUsage,
} from '../lib/analytics';
import { GoogleServiceIcon } from './GoogleIcons';

interface IntegrationsViewProps {
  user: UserProfile | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onConnectWorkspace: (groups: WorkspaceScopeGroup[]) => Promise<boolean>;
  verifiedWorkspaceTests: Record<string, { at: string; message: string }>;
  onWorkspaceTestVerified: (service: string, info: { at: string; message: string }) => void;
  onWorkspaceDisconnected: () => void;
}

type SettingsTab = 'connections' | 'guide' | 'roles';
type ConnectionState = 'Connected' | 'Not Connected' | 'Configuration Required';

const ENV_TEMPLATE = `# ClubPulse Production Environment Variables
# Copy to .env locally or configure via Google Cloud Secret Manager on Cloud Run

PORT=3000
NODE_ENV=production

# Google Cloud SQL for PostgreSQL (Object Method via Cloud SQL Auth Proxy)
SQL_HOST=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
SQL_DB_NAME=clubpulse
SQL_USER=clubpulse_app
SQL_PASSWORD=
SQL_ADMIN_USER=postgres
SQL_ADMIN_PASSWORD=

# Gemini API (Server-side only — never expose in frontend code)
GEMINI_API_KEY=

# Optional Institutional Admin Bootstrap Email
ADMIN_EMAIL=

# Optional Google Cloud Storage (Private bucket — never public)
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_STORAGE_BUCKET=

# Optional Google Analytics 4 (Non-PII website usage only)
VITE_GA4_MEASUREMENT_ID=`;

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  user,
  onSignIn,
  onSignOut,
  onConnectWorkspace,
  verifiedWorkspaceTests,
  onWorkspaceTestVerified,
  onWorkspaceDisconnected,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('connections');
  const [statusData, setStatusData] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [ga4ConsentState, setGa4ConsentState] = useState(getGA4Consent());
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await apiFetch('/api/integrations/status');
      setStatusData(data);
    } catch (err: any) {
      setToast({ type: 'error', text: err.message || 'Unable to load integration status.' });
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchUsers = async () => {
    if (!user || user.role !== 'ADMIN') return;
    setLoadingUsers(true);
    try {
      const res = await apiFetch<{ users: UserProfile[] }>('/api/admin/users');
      setAdminUsers(res.users ?? []);
    } catch {
      // Ignore if unauthorized
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'roles' && user?.role === 'ADMIN') {
      fetchUsers();
    }
  }, [activeTab, user]);

  const hasWorkspaceToken = Boolean(getCachedWorkspaceToken());
  const grantedGroups = getGrantedScopeGroups();

  const handleTestService = async (serviceKey: string, isWorkspace: boolean) => {
    setToast(null);
    setTestingKey(serviceKey);
    try {
      if (isWorkspace) {
        if (!hasWorkspaceToken) {
          throw new Error('Connect this Google Workspace service before testing connectivity.');
        }
        const res = await apiFetch<{ connected: boolean; message: string; testedAt: string }>(
          `/api/google/test/${serviceKey}`,
          { method: 'POST', includeGoogleToken: true }
        );
        onWorkspaceTestVerified(serviceKey, { at: res.testedAt, message: res.message });
        setToast({ type: 'success', text: res.message });
      } else {
        const res = await apiFetch<{ connected: boolean; message: string }>(
          `/api/integrations/test/${serviceKey}`,
          { method: 'POST' }
        );
        setToast({ type: 'success', text: res.message });
      }
      trackAppUsage('integration_action', { service: serviceKey, action: 'test' });
      await fetchStatus();
    } catch (err: any) {
      setToast({ type: 'error', text: err.message || `Connectivity test failed for ${serviceKey}.` });
    } finally {
      setTestingKey(null);
    }
  };

  const handleConnectWorkspaceCard = async (
    serviceKey: string,
    group: WorkspaceScopeGroup
  ) => {
    setToast(null);
    setTestingKey(serviceKey);
    try {
      const ok = await onConnectWorkspace([group]);
      if (!ok) return;
      // Immediately run a real connectivity test so Connected status is truthfully verified
      const res = await apiFetch<{ connected: boolean; message: string; testedAt: string }>(
        `/api/google/test/${serviceKey}`,
        { method: 'POST', includeGoogleToken: true }
      );
      onWorkspaceTestVerified(serviceKey, { at: res.testedAt, message: res.message });
      setToast({ type: 'success', text: res.message });
      await fetchStatus();
    } catch (err: any) {
      setToast({ type: 'error', text: err.message || 'Authorization or connectivity test failed.' });
    } finally {
      setTestingKey(null);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!confirmDisconnect) return;
    if (confirmDisconnect.key === 'firebase_auth') {
      await onSignOut();
      setToast({ type: 'success', text: 'Signed out and cleared all active Google session tokens.' });
    } else {
      clearWorkspaceToken();
      onWorkspaceDisconnected();
      setToast({
        type: 'success',
        text: `Disconnected ${confirmDisconnect.name} and cleared in-memory Workspace OAuth tokens.`,
      });
    }
    setConfirmDisconnect(null);
    await fetchStatus();
  };

  const handleToggleRole = async (targetUser: UserProfile) => {
    const nextRole = targetUser.role === 'ADMIN' ? 'VIEWER' : 'ADMIN';
    try {
      await apiFetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      setToast({ type: 'success', text: `Updated ${targetUser.email} to ${nextRole}.` });
      await fetchUsers();
    } catch (err: any) {
      setToast({ type: 'error', text: err.message || 'Unable to update role.' });
    }
  };

  const caps = statusData?.capabilities;

  const cards: Array<{
    key:
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
    name: string;
    description: string;
    functionality: string;
    permissions: string;
    state: ConnectionState;
    lastSync: string | null;
    accountInfo: string | null;
    isWorkspace?: boolean;
    scopeGroup?: WorkspaceScopeGroup;
    canTest?: boolean;
  }> = [
    {
      key: 'cloud_sql',
      name: 'Google Cloud SQL (PostgreSQL)',
      description: 'Primary relational database storing students, clubs, memberships, events, attendance, and import history.',
      functionality: 'Drizzle ORM · pg connection pool · Relational constraints',
      permissions: 'Server-side SQL_USER pool via Cloud SQL Auth Proxy',
      state: caps?.cloud_sql?.verifiedConnected
        ? 'Connected'
        : caps?.cloud_sql?.configured
        ? 'Not Connected'
        : 'Configuration Required',
      lastSync: caps?.cloud_sql?.lastSync ?? null,
      accountInfo: caps?.cloud_sql?.detail ?? null,
      canTest: true,
    },
    {
      key: 'firebase_auth',
      name: 'Firebase Authentication',
      description: 'Institutional Google Sign-In, verified Firebase ID token sessions, and PostgreSQL role-based access.',
      functionality: 'Google Sign-In · ADMIN & VIEWER RBAC · Protected API routes',
      permissions: 'openid · email · profile',
      state: user && caps?.firebase_auth?.verifiedConnected
        ? 'Connected'
        : caps?.firebase_auth?.configured
        ? 'Not Connected'
        : 'Configuration Required',
      lastSync: caps?.firebase_auth?.lastSync ?? null,
      accountInfo: user ? `${user.email} (${user.role})` : 'Not signed in',
      canTest: true,
    },
    {
      key: 'google_sheets',
      name: 'Google Sheets',
      description: 'Import validated club and student spreadsheets into PostgreSQL and export filtered analytical summaries.',
      functionality: 'Spreadsheet & tab picker · Column mapping · Filtered report export',
      permissions: 'spreadsheets · drive.readonly',
      state:
        hasWorkspaceToken &&
        grantedGroups.includes('sheets') &&
        Boolean(verifiedWorkspaceTests.google_sheets)
          ? 'Connected'
          : 'Not Connected',
      lastSync:
        verifiedWorkspaceTests.google_sheets?.at ||
        statusData?.workspaceLastSync?.google_sheets?.at ||
        null,
      accountInfo:
        hasWorkspaceToken && user ? user.email : 'Requires Google Workspace authorization',
      isWorkspace: true,
      scopeGroup: 'sheets',
      canTest: true,
    },
    {
      key: 'google_drive',
      name: 'Google Drive',
      description: 'Browse source CSV/Excel datasets and organize exported reports inside the CampusLytix/ Drive folder.',
      functionality: 'Dataset picker · CampusLytix/ folder hierarchy · Report archive',
      permissions: 'drive.file · drive.readonly',
      state:
        hasWorkspaceToken &&
        grantedGroups.includes('drive') &&
        Boolean(verifiedWorkspaceTests.google_drive)
          ? 'Connected'
          : 'Not Connected',
      lastSync:
        verifiedWorkspaceTests.google_drive?.at ||
        statusData?.workspaceLastSync?.google_drive?.at ||
        null,
      accountInfo:
        hasWorkspaceToken && user ? user.email : 'Requires Google Workspace authorization',
      isWorkspace: true,
      scopeGroup: 'drive',
      canTest: true,
    },
    {
      key: 'google_calendar',
      name: 'Google Calendar',
      description: 'View upcoming institutional events with read-only access, link to clubs, and add confirmed events.',
      functionality: 'Read-only event sync · Duplicate prevention · Confirmed event creation',
      permissions: 'calendar.events.readonly (incremental calendar.events on write)',
      state:
        hasWorkspaceToken &&
        (grantedGroups.includes('calendarRead') || grantedGroups.includes('calendarWrite')) &&
        Boolean(verifiedWorkspaceTests.google_calendar)
          ? 'Connected'
          : 'Not Connected',
      lastSync:
        verifiedWorkspaceTests.google_calendar?.at ||
        statusData?.workspaceLastSync?.google_calendar?.at ||
        null,
      accountInfo:
        hasWorkspaceToken && user ? user.email : 'Starts with read-only Calendar access',
      isWorkspace: true,
      scopeGroup: 'calendarRead',
      canTest: true,
    },
    {
      key: 'google_forms',
      name: 'Google Forms',
      description: 'Collect student club registrations, event sign-ups, and preference surveys with validation.',
      functionality: 'Form response reader · Linked Google Sheet fallback · Duplicate checks',
      permissions: 'forms.body.readonly · forms.responses.readonly',
      state:
        hasWorkspaceToken &&
        grantedGroups.includes('forms') &&
        Boolean(verifiedWorkspaceTests.google_forms)
          ? 'Connected'
          : 'Not Connected',
      lastSync:
        verifiedWorkspaceTests.google_forms?.at ||
        statusData?.workspaceLastSync?.google_forms?.at ||
        null,
      accountInfo:
        hasWorkspaceToken && user ? user.email : 'Requires Google Workspace authorization',
      isWorkspace: true,
      scopeGroup: 'forms',
      canTest: true,
    },
    {
      key: 'gemini_ai',
      name: 'Gemini API (CampusLytix AI)',
      description: 'Server-side AI analyst answering natural-language questions strictly from verified PostgreSQL metrics.',
      functionality: 'Grounded club comparisons · Executive summaries · Recommendations',
      permissions: 'Server-side GEMINI_API_KEY (gemini-4-hydrogen)',
      state: !caps?.gemini_ai?.configured
        ? 'Configuration Required'
        : caps?.gemini_ai?.verifiedConnected
        ? 'Connected'
        : 'Not Connected',
      lastSync: caps?.gemini_ai?.lastSync ?? null,
      accountInfo: caps?.gemini_ai?.configured
        ? 'Server key configured · Click Test Connection to verify'
        : 'Set GEMINI_API_KEY in server secrets',
      canTest: true,
    },
    {
      key: 'cloud_storage',
      name: 'Google Cloud Storage',
      description: 'Private authenticated storage for uploaded original datasets and archived PDF/CSV reports.',
      functionality: '10 MB limit · File-type validation · Authenticated downloads',
      permissions: 'Private bucket via GOOGLE_CLOUD_STORAGE_BUCKET (no public access)',
      state: !caps?.cloud_storage?.configured
        ? 'Configuration Required'
        : caps?.cloud_storage?.verifiedConnected
        ? 'Connected'
        : 'Not Connected',
      lastSync: caps?.cloud_storage?.lastSync ?? null,
      accountInfo: caps?.cloud_storage?.configured
        ? `Bucket: ${statusData?.storageBucket}`
        : 'Private server archive active; set GOOGLE_CLOUD_STORAGE_BUCKET for GCS',
      canTest: true,
    },
    {
      key: 'cloud_run',
      name: 'Google Cloud Run',
      description: 'Containerized serverless deployment with Cloud SQL Auth Proxy, Secret Manager, and /api/health.',
      functionality: 'Dockerfile · Production start script · /api/health endpoint',
      permissions: 'Cloud Run IAM + Cloud SQL Client role',
      state: caps?.cloud_run?.verifiedConnected ? 'Connected' : 'Configuration Required',
      lastSync: null,
      accountInfo: caps?.cloud_run?.serviceName
        ? `Service: ${caps.cloud_run.serviceName}`
        : 'Deployment assets ready — see Configuration Guide',
      canTest: true,
    },
    {
      key: 'ga4',
      name: 'Google Analytics 4',
      description: 'Optional privacy-respecting telemetry for dashboard usage events without student PII.',
      functionality: 'Dashboard visits · Navigation · Report download counts',
      permissions: 'Client consent required · VITE_GA4_MEASUREMENT_ID',
      state:
        isGA4Configured() && ga4ConsentState
          ? 'Connected'
          : isGA4Configured()
          ? 'Not Connected'
          : 'Configuration Required',
      lastSync: null,
      accountInfo: getGA4MeasurementId()
        ? `Measurement ID: ${getGA4MeasurementId()}`
        : 'Set VITE_GA4_MEASUREMENT_ID to enable',
      canTest: false,
    },
  ];

  const connectedCount = cards.filter((c) => c.state === 'Connected').length;
  const configRequiredCount = cards.filter((c) => c.state === 'Configuration Required').length;
  const latestSync = cards
    .map((c) => c.lastSync)
    .filter((x): x is string => Boolean(x))
    .sort()
    .reverse()[0];

  const renderStatusIndicator = (state: ConnectionState) => {
    if (state === 'Connected') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Connected
        </span>
      );
    }
    if (state === 'Configuration Required') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          Configuration Required
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Unlink className="w-3.5 h-3.5 text-slate-400" />
        Not Connected
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Settings Sub-Navigation */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('connections')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'connections'
                ? 'bg-[#101B3A] text-white'
                : 'text-slate-600 hover:bg-[#F4F6FC]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Integrations &amp; Connections
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'guide'
                ? 'bg-[#101B3A] text-white'
                : 'text-slate-600 hover:bg-[#F4F6FC]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Configuration Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'roles'
                ? 'bg-[#101B3A] text-white'
                : 'text-slate-600 hover:bg-[#F4F6FC]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Access &amp; Roles
          </button>
        </div>

        <button
          type="button"
          disabled={loadingStatus}
          onClick={fetchStatus}
          className="h-8 px-3 text-xs font-medium text-slate-600 hover:text-[#101B3A] inline-flex items-center gap-1.5 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {toast && (
        <div
          className={`rounded-xl px-4 py-3 border text-sm flex items-center gap-2.5 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* TAB 1: INTEGRATIONS & CONNECTIONS */}
      {activeTab === 'connections' && (
        <>
          {/* Integration Status Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Available Integrations</div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#101B3A]">
                {cards.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">Google Cloud &amp; Workspace</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Verified Connected</div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#18B6A0]">
                {connectedCount}
              </div>
              <div className="mt-1 text-xs text-slate-500">Passed live auth &amp; health checks</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Configuration Required</div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-600">
                {configRequiredCount}
              </div>
              <div className="mt-1 text-xs text-slate-500">Awaiting external env / deploy</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Last Successful Sync</div>
              <div className="mt-1.5 text-sm font-bold font-mono tabular-nums text-[#101B3A]">
                {latestSync ? new Date(latestSync).toLocaleString() : 'No sync yet'}
              </div>
              <div className="mt-1 text-xs text-slate-500">Tracked in PostgreSQL audit log</div>
            </div>
          </div>

          {/* Integration Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {cards.map((card) => {
              const isBusy = testingKey === card.key;
              return (
                <div
                  key={card.key}
                  className="bg-white border border-slate-200/90 rounded-xl p-6 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#F4F6FC] flex items-center justify-center shrink-0">
                          <GoogleServiceIcon service={card.key} className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#101B3A]">{card.name}</h3>
                          <div className="mt-0.5">{renderStatusIndicator(card.state)}</div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                      {card.description}
                    </p>

                    <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400 shrink-0">Capabilities</span>
                        <span className="text-slate-700 text-right">{card.functionality}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400 shrink-0">Permissions</span>
                        <span className="font-mono text-[11px] text-slate-600 text-right">
                          {card.permissions}
                        </span>
                      </div>
                      {card.accountInfo && (
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-400 shrink-0">Account / Target</span>
                          <span className="text-slate-700 text-right truncate max-w-[260px]">
                            {card.accountInfo}
                          </span>
                        </div>
                      )}
                      {card.lastSync && (
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-400 shrink-0">Last Verified Sync</span>
                          <span className="font-mono tabular-nums text-[11px] text-slate-600">
                            {new Date(card.lastSync).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {card.key === 'firebase_auth' &&
                        (user ? (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDisconnect({ key: 'firebase_auth', name: card.name })
                            }
                            className="h-8 px-3 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                          >
                            Sign Out
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={onSignIn}
                            className="h-8 px-3.5 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] rounded-lg"
                          >
                            Sign In with Google
                          </button>
                        ))}

                      {card.isWorkspace && card.scopeGroup && (
                        <>
                          {card.state === 'Connected' ? (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDisconnect({ key: card.key, name: card.name })
                              }
                              className="h-8 px-3 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                            >
                              Disconnect
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleConnectWorkspaceCard(card.key, card.scopeGroup!)
                              }
                              className="h-8 px-3.5 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-60 rounded-lg"
                            >
                              {isBusy ? 'Connecting...' : 'Connect & Verify'}
                            </button>
                          )}
                        </>
                      )}

                      {card.key === 'ga4' && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = !ga4ConsentState;
                            setGA4Consent(next);
                            setGa4ConsentState(next);
                            setToast({
                              type: 'success',
                              text: next
                                ? 'Usage analytics consent enabled (non-PII events only).'
                                : 'Usage analytics consent disabled.',
                            });
                          }}
                          className="h-8 px-3 text-xs font-semibold text-[#101B3A] bg-[#F4F6FC] hover:bg-slate-200/70 rounded-lg"
                        >
                          {ga4ConsentState ? 'Revoke Consent' : 'Enable Consent'}
                        </button>
                      )}

                      {card.state === 'Configuration Required' && !card.isWorkspace && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('guide')}
                          className="h-8 px-3 text-xs font-semibold text-[#7657E8] bg-[#F3F0FF] hover:bg-[#E8E2FF] rounded-lg"
                        >
                          View Setup Guide
                        </button>
                      )}
                    </div>

                    {card.canTest && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTestService(card.key, Boolean(card.isWorkspace))}
                        className="h-8 px-3 text-xs font-semibold text-[#101B3A] bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <RefreshCw className={`w-3 h-3 ${isBusy ? 'animate-spin' : ''}`} />
                        Test Connection
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* TAB 2: CONFIGURATION GUIDE */}
      {activeTab === 'guide' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-[#101B3A]">
              Environment Variable Configuration Template
            </h2>
            <p className="text-xs text-slate-600">
              All sensitive secrets (PostgreSQL credentials and Gemini API key) remain strictly on the server via environment variables or Google Secret Manager. Never place secrets in browser code.
            </p>
            <pre className="p-4 bg-[#101B3A] text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
              {ENV_TEMPLATE}
            </pre>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-[#101B3A]">Required Google Cloud APIs</h3>
              <ul className="space-y-2 text-xs text-slate-600 font-mono">
                <li>• sqladmin.googleapis.com — Cloud SQL PostgreSQL</li>
                <li>• identitytoolkit.googleapis.com — Firebase Authentication</li>
                <li>• sheets.googleapis.com — Google Sheets Import/Export</li>
                <li>• drive.googleapis.com — Google Drive Picker &amp; Reports</li>
                <li>• calendar-json.googleapis.com — Google Calendar Sync</li>
                <li>• forms.googleapis.com — Google Forms Collection</li>
                <li>• generativelanguage.googleapis.com — Gemini API (CampusLytix AI)</li>
                <li>• storage.googleapis.com — Cloud Storage (Optional)</li>
                <li>• run.googleapis.com — Cloud Run Deployment</li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-[#101B3A]">Minimum OAuth Scopes Matrix</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                  <span className="font-semibold text-[#101B3A]">Sign-In</span>
                  <span className="font-mono text-slate-600">openid, email, profile</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                  <span className="font-semibold text-[#101B3A]">Sheets</span>
                  <span className="font-mono text-slate-600">spreadsheets, drive.readonly</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                  <span className="font-semibold text-[#101B3A]">Drive</span>
                  <span className="font-mono text-slate-600">drive.file, drive.readonly</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                  <span className="font-semibold text-[#101B3A]">Calendar</span>
                  <span className="font-mono text-slate-600">calendar.events.readonly (+ calendar.events on write)</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5">
                  <span className="font-semibold text-[#101B3A]">Forms</span>
                  <span className="font-mono text-slate-600">forms.body.readonly, forms.responses.readonly</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-[#101B3A]">Google Cloud Run Deployment Command</h3>
            <p className="text-xs text-slate-600">
              A production <span className="font-mono">Dockerfile</span>, <span className="font-mono">/api/health</span> readiness endpoint, and <span className="font-mono">DEPLOYMENT.md</span> are included in the repository.
            </p>
            <pre className="p-4 bg-[#101B3A] text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
{`gcloud run deploy clubpulse \\
  --source . \\
  --region asia-south1 \\
  --add-cloudsql-instances ${statusData?.projectId || 'PROJECT_ID'}:asia-south1:ai-studio-c7bd1112 \\
  --set-env-vars "NODE_ENV=production,SQL_HOST=/cloudsql/${statusData?.projectId || 'PROJECT_ID'}:asia-south1:ai-studio-c7bd1112,SQL_DB_NAME=clubpulse,SQL_USER=clubpulse_app" \\
  --set-secrets "SQL_PASSWORD=clubpulse-sql-password:latest,GEMINI_API_KEY=clubpulse-gemini-key:latest" \\
  --allow-unauthenticated`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: ROLE-BASED ACCESS CONTROL (RBAC) */}
      {activeTab === 'roles' && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-[#315EF8]" />
              <div>
                <h2 className="text-base font-bold text-[#101B3A]">
                  Server-Enforced User Roles (ADMIN / VIEWER)
                </h2>
                <p className="text-xs text-slate-500">
                  Roles are stored in PostgreSQL and verified on every administrative API endpoint
                </p>
              </div>
            </div>
            {user && (
              <span className="text-xs font-mono font-semibold text-[#315EF8]">
                Current Role: {user.role}
              </span>
            )}
          </div>

          {!user ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-slate-600">Sign in with Google to view your session role.</p>
              <button
                type="button"
                onClick={onSignIn}
                className="h-9 px-4 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] rounded-lg"
              >
                Sign in with Google
              </button>
            </div>
          ) : user.role !== 'ADMIN' ? (
            <div className="p-6 text-sm text-slate-600">
              You are signed in as <strong>{user.email}</strong> with <strong>VIEWER</strong> privileges. You can inspect analytics, apply dashboard filters, and query CampusLytix AI. Contact an administrator to manage datasets or integrations.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500">
                    <th className="py-3 px-6">User</th>
                    <th className="py-3 px-4">Firebase UID</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        Loading registered users...
                      </td>
                    </tr>
                  ) : (
                    adminUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F8FAFF]">
                        <td className="py-3.5 px-6">
                          <div className="font-semibold text-[#101B3A]">
                            {u.displayName || u.email}
                          </div>
                          <div className="text-slate-500">{u.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">{u.uid.slice(0, 14)}…</td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-[#315EF8]">
                          {u.role}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          {u.id !== user.id ? (
                            <button
                              type="button"
                              onClick={() => handleToggleRole(u)}
                              className="h-8 px-3 font-semibold text-[#101B3A] bg-[#F4F6FC] hover:bg-slate-200 rounded-lg"
                            >
                              Switch to {u.role === 'ADMIN' ? 'VIEWER' : 'ADMIN'}
                            </button>
                          ) : (
                            <span className="text-slate-400">Active Admin</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 bg-[#101B3A]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#101B3A]">
                Disconnect {confirmDisconnect.name}?
              </h3>
              <button
                type="button"
                onClick={() => setConfirmDisconnect(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              This will immediately clear your in-memory OAuth access tokens for this session. Existing institutional records stored in PostgreSQL will remain intact.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDisconnect(null)}
                className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                className="h-9 px-4 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
