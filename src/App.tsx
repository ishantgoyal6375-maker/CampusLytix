import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Database,
  Info,
  Landmark,
  LogOut,
  Menu,
  Network,
  RefreshCw,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  CgcDirectoryData,
  DashboardAnalytics,
  NavSection,
  StructureViewMode,
  UserProfile,
} from './types';
import { apiFetch } from './lib/api';
import {
  connectWorkspaceScopes,
  signInWithGoogleBase,
  signOutClubPulse,
  subscribeToAuth,
  type ClassifiedAuthError,
  type WorkspaceScopeGroup,
} from './lib/firebase';
import { initGA4, trackAppUsage } from './lib/analytics';
import { GoogleGLogo } from './components/GoogleIcons';
import { OverviewDashboard } from './components/OverviewDashboard';
import { CgcClubDirectoryView } from './components/CgcClubDirectoryView';
import { UniversityStructureView } from './components/UniversityStructureView';
import { ClubAnalyticsView } from './components/ClubAnalyticsView';
import { EventAnalyticsView } from './components/EventAnalyticsView';
import { DataManagementView } from './components/DataManagementView';
import { ClubPulseAIView } from './components/ClubPulseAIView';
import { IntegrationsView } from './components/IntegrationsView';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  breadcrumb: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', breadcrumb: 'Analytics / Executive Overview', icon: BarChart3 },
  { id: 'directory', label: 'Club Directory (CGC)', breadcrumb: 'CGC University / 11-Club Directory', icon: Landmark },
  { id: 'structure', label: 'University Structure', breadcrumb: 'CGC University / Organisational Map & Network', icon: Network },
  { id: 'clubs', label: 'Club Analytics', breadcrumb: 'Analytics / Clubs & Departments', icon: Building2 },
  { id: 'events', label: 'Event Analytics', breadcrumb: 'Analytics / Events & Calendar', icon: CalendarDays },
  { id: 'data', label: 'Data Management', breadcrumb: 'Operations / Data Management', icon: Database },
  { id: 'ai', label: 'CampusLytix AI', breadcrumb: 'Intelligence / CampusLytix AI', icon: Sparkles },
  { id: 'settings', label: 'Settings & Integrations', breadcrumb: 'Settings / Integrations & Connections', icon: Settings },
];

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  const [filters, setFilters] = useState({
    department: 'All',
    category: 'All',
    month: 'All',
  });
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [cgcData, setCgcData] = useState<CgcDirectoryData | null>(null);
  const [loadingCgc, setLoadingCgc] = useState(true);
  const [cgcError, setCgcError] = useState<string | null>(null);
  const [structureMode, setStructureMode] = useState<StructureViewMode>('verified');
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [highlightedStructureClubId, setHighlightedStructureClubId] = useState<number | null>(null);

  const [verifiedWorkspaceTests, setVerifiedWorkspaceTests] = useState<
    Record<string, { at: string; message: string }>
  >({});

  const [authNotice, setAuthNotice] = useState<{
    error: ClassifiedAuthError;
    retryContext:
      | { mode: 'base' }
      | { mode: 'workspace'; groups: WorkspaceScopeGroup[] };
  } | null>(null);

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: UserProfile }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    initGA4();
    trackAppUsage('dashboard_visit', { page: 'overview' });

    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserProfile();
      } else {
        setUser(null);
        setVerifiedWorkspaceTests({});
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfile]);

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const qs = new URLSearchParams();
      if (filters.department !== 'All') qs.set('department', filters.department);
      if (filters.category !== 'All') qs.set('category', filters.category);
      if (filters.month !== 'All') qs.set('month', filters.month);

      const url = `/api/analytics${qs.toString() ? `?${qs.toString()}` : ''}`;
      const data = await apiFetch<DashboardAnalytics>(url);
      setAnalytics(data);
    } catch (err: any) {
      setAnalyticsError(err.message || 'Unable to load institutional analytics.');
    } finally {
      setLoadingAnalytics(false);
    }
  }, [filters]);

  const loadCgcDirectory = useCallback(async () => {
    setLoadingCgc(true);
    setCgcError(null);
    try {
      const data = await apiFetch<CgcDirectoryData>('/api/cgc/directory');
      setCgcData(data);
    } catch (err: any) {
      setCgcError(err.message || 'Unable to load CGC University club directory.');
    } finally {
      setLoadingCgc(false);
    }
  }, []);

  const refreshAllData = useCallback(async () => {
    await Promise.all([loadAnalytics(), loadCgcDirectory()]);
  }, [loadAnalytics, loadCgcDirectory]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadCgcDirectory();
  }, [loadCgcDirectory]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthNotice(null);
    try {
      const result = await signInWithGoogleBase();
      if (!result.ok) {
        setAuthNotice({
          error: result.error,
          retryContext: { mode: 'base' },
        });
        return;
      }
      await fetchUserProfile();
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutClubPulse();
    setUser(null);
    setAuthNotice(null);
    setVerifiedWorkspaceTests({});
  };

  const handleConnectWorkspace = async (
    groups: WorkspaceScopeGroup[]
  ): Promise<boolean> => {
    setSigningIn(true);
    setAuthNotice(null);
    try {
      const result = await connectWorkspaceScopes(groups);
      if (!result.ok) {
        setAuthNotice({
          error: result.error,
          retryContext: { mode: 'workspace', groups },
        });
        return false;
      }
      await fetchUserProfile();
      return true;
    } finally {
      setSigningIn(false);
    }
  };

  const handleRetryAuth = async () => {
    if (!authNotice) return;
    if (authNotice.retryContext.mode === 'workspace') {
      await handleConnectWorkspace(authNotice.retryContext.groups);
    } else {
      await handleSignIn();
    }
  };

  const handleNavigate = (section: NavSection) => {
    setActiveNav(section);
    if (section !== 'directory') {
      setSelectedClubId(null);
    }
    setMobileMenuOpen(false);
    trackAppUsage('navigation_change', { section });
  };

  const handleOpenClubProfile = (clubId: number) => {
    setSelectedClubId(clubId);
    setActiveNav('directory');
    setMobileMenuOpen(false);
  };

  const handleOpenStructure = (clubId?: number) => {
    if (clubId !== undefined) {
      setHighlightedStructureClubId(clubId);
    }
    setActiveNav('structure');
    setMobileMenuOpen(false);
  };

  const currentNavMeta = NAV_ITEMS.find((n) => n.id === activeNav) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-[#F4F6FC] text-[#101B3A]">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#101B3A]/60 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Deep Navy Sidebar (#101B3A) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[#101B3A] text-white flex flex-col justify-between transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header — crisp white band aligned seamlessly with top bar so the CampusLytix logo integrates naturally */}
          <div className="h-16 px-4 bg-white border-b border-slate-200/90 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleNavigate('overview')}
              className="flex items-center min-w-0 focus:outline-none"
              aria-label="CampusLytix Home"
            >
              <img
                src="/assets/aistudio/image_5b6bbd4e.png"
                alt="CampusLytix"
                className="h-10 w-auto max-w-[196px] object-contain"
              />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 text-slate-500 hover:text-[#101B3A]"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Navigation */}
          <nav className="p-3.5 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#315EF8] text-white'
                      : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account & Google Sign-In Footer */}
        <div className="p-4 border-t border-white/10">
          {authLoading ? (
            <div className="text-xs text-slate-400 px-2 py-2">Checking session...</div>
          ) : user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-1">
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.displayName || user.email}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#7657E8] flex items-center justify-center text-xs font-bold shrink-0">
                    {(user.displayName || user.email).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono">
                    {user.role} · Google Auth
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full h-9 px-3 rounded-lg bg-white/8 hover:bg-white/14 text-xs font-medium text-slate-200 flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-[11px] text-slate-300 px-1 leading-relaxed">
                Sign in with Google to unlock admin imports, Workspace sync, and report exports.
              </div>
              <button
                type="button"
                disabled={signingIn}
                onClick={handleSignIn}
                className="gsi-material-button w-full"
              >
                <GoogleGLogo className="w-4 h-4" />
                <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, primary action on right */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-[#101B3A]"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 truncate">{currentNavMeta.breadcrumb}</div>
              <h1 className="text-base font-bold text-[#101B3A] leading-tight truncate">
                {currentNavMeta.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={loadingAnalytics || loadingCgc}
              onClick={refreshAllData}
              className="h-9 px-3 text-xs font-semibold text-slate-600 hover:text-[#101B3A] bg-[#F4F6FC] hover:bg-slate-200/70 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingAnalytics || loadingCgc ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>

            {!user && (
              <button
                type="button"
                disabled={signingIn}
                onClick={handleSignIn}
                className="gsi-material-button h-9!"
              >
                <GoogleGLogo className="w-4 h-4" />
                <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Viewport Workspace */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {authNotice && (
            <div
              role="status"
              className={`mb-6 rounded-xl px-4 py-3.5 border flex flex-wrap items-start justify-between gap-4 ${
                authNotice.error.kind === 'blocked'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : authNotice.error.kind === 'error'
                  ? 'bg-red-50 border-red-200 text-red-950'
                  : 'bg-white border-slate-200 text-[#101B3A]'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {authNotice.error.kind === 'blocked' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                ) : authNotice.error.kind === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-[#315EF8] mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{authNotice.error.title}</div>
                  <div className="text-xs mt-0.5 opacity-85">
                    {authNotice.error.message} {authNotice.error.hint}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={handleRetryAuth}
                  className="h-8 px-3.5 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-60 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                >
                  {signingIn
                    ? 'Opening Google...'
                    : authNotice.retryContext.mode === 'workspace'
                    ? 'Retry Connection'
                    : 'Retry Sign-In'}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthNotice(null)}
                  aria-label="Dismiss sign-in notice"
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 hover:text-[#101B3A] transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {analyticsError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-900 rounded-xl p-4 text-sm flex items-center justify-between gap-4">
              <span>{analyticsError}</span>
              <button
                type="button"
                onClick={loadAnalytics}
                className="text-xs font-semibold text-red-800 underline whitespace-nowrap shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {loadingAnalytics && !analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="bg-white border border-slate-200/90 rounded-xl p-5 h-28 animate-pulse"
                >
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                  <div className="h-7 w-20 bg-slate-200 rounded mt-4" />
                </div>
              ))}
            </div>
          ) : (
            analytics && (
              <>
                {activeNav === 'overview' && (
                  <OverviewDashboard
                    analytics={analytics}
                    filters={filters}
                    onFilterChange={setFilters}
                    onNavigate={handleNavigate}
                  />
                )}

                {activeNav === 'directory' && (
                  <CgcClubDirectoryView
                    data={cgcData}
                    loading={loadingCgc}
                    error={cgcError}
                    user={user}
                    structureMode={structureMode}
                    onStructureModeChange={setStructureMode}
                    selectedClubId={selectedClubId}
                    onSelectClub={setSelectedClubId}
                    onOpenStructure={handleOpenStructure}
                    onRefresh={refreshAllData}
                  />
                )}

                {activeNav === 'structure' && (
                  <UniversityStructureView
                    data={cgcData}
                    loading={loadingCgc}
                    error={cgcError}
                    structureMode={structureMode}
                    onStructureModeChange={setStructureMode}
                    highlightedClubId={highlightedStructureClubId}
                    onHighlightClub={setHighlightedStructureClubId}
                    onOpenClubProfile={handleOpenClubProfile}
                    onRefresh={refreshAllData}
                  />
                )}

                {activeNav === 'clubs' && (
                  <ClubAnalyticsView
                    analytics={analytics}
                    user={user}
                    onRequireWorkspaceConnect={(service) =>
                      handleConnectWorkspace([service])
                    }
                    onOpenCgcClub={handleOpenClubProfile}
                  />
                )}

                {activeNav === 'events' && (
                  <EventAnalyticsView
                    analytics={analytics}
                    user={user}
                    onRefreshAnalytics={refreshAllData}
                    onConnectCalendar={(mode) => handleConnectWorkspace([mode])}
                  />
                )}

                {activeNav === 'data' && (
                  <DataManagementView
                    analytics={analytics}
                    user={user}
                    onRefreshAnalytics={refreshAllData}
                    onConnectWorkspace={handleConnectWorkspace}
                  />
                )}

                {activeNav === 'ai' && <ClubPulseAIView />}

                {activeNav === 'settings' && (
                  <IntegrationsView
                    user={user}
                    onSignIn={handleSignIn}
                    onSignOut={handleSignOut}
                    onConnectWorkspace={handleConnectWorkspace}
                    verifiedWorkspaceTests={verifiedWorkspaceTests}
                    onWorkspaceTestVerified={(service, info) =>
                      setVerifiedWorkspaceTests((prev) => ({
                        ...prev,
                        [service]: info,
                      }))
                    }
                    onWorkspaceDisconnected={() => setVerifiedWorkspaceTests({})}
                  />
                )}
              </>
            )
          )}
        </main>
      </div>
    </div>
  );
}
