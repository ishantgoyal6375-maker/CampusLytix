import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  Edit3,
  GitBranch,
  Info,
  Network,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CgcClub,
  CgcDirectoryData,
  StructureViewMode,
  UserProfile,
} from '../types';
import { apiFetch } from '../lib/api';
import {
  CgcClubEmblem,
  StructureModeSwitcher,
  VerificationTag,
} from './CgcVisuals';

interface CgcClubDirectoryViewProps {
  data: CgcDirectoryData | null;
  loading: boolean;
  error: string | null;
  user: UserProfile | null;
  structureMode: StructureViewMode;
  onStructureModeChange: (mode: StructureViewMode) => void;
  selectedClubId: number | null;
  onSelectClub: (clubId: number | null) => void;
  onOpenStructure: (clubId?: number) => void;
  onRefresh: () => Promise<void>;
}

const AWAITING_TEXT = 'Information awaiting institutional verification.';

export const CgcClubDirectoryView: React.FC<CgcClubDirectoryViewProps> = ({
  data,
  loading,
  error,
  user,
  structureMode,
  onStructureModeChange,
  selectedClubId,
  onSelectClub,
  onOpenStructure,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [scopeFilter, setScopeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Admin Modals
  const [showAddClubModal, setShowAddClubModal] = useState(false);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [editingClub, setEditingClub] = useState<CgcClub | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const clubs = data?.clubs ?? [];
  const selectedClub = useMemo(
    () => (selectedClubId !== null ? clubs.find((c) => c.id === selectedClubId) ?? null : null),
    [clubs, selectedClubId]
  );

  // Filter options derived cleanly from live DB directory
  const filterMeta = useMemo(() => {
    const categories = Array.from(new Set(clubs.map((c) => c.category))).sort();
    const scopes = Array.from(
      new Set(clubs.map((c) => c.operationalIdentity).filter(Boolean) as string[])
    ).sort();
    const blocksList =
      structureMode === 'verified'
        ? data?.verifiedBlocks ?? []
        : data?.blocks ?? [];
    return { categories, scopes, blocksList };
  }, [clubs, data, structureMode]);

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs.filter((club) => {
      if (q) {
        const hay = [
          club.name,
          club.fullName,
          club.code,
          club.category,
          club.operationalIdentity,
          club.operationalScope,
          club.verifiedBlock?.blockName,
          club.confirmedLeadership?.supervisingAuthority,
          club.confirmedLeadership?.coordinatorName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (categoryFilter !== 'All' && club.category !== categoryFilter) {
        return false;
      }
      if (scopeFilter !== 'All' && club.operationalIdentity !== scopeFilter) {
        return false;
      }
      if (statusFilter !== 'All' && club.verificationStatus !== statusFilter) {
        return false;
      }
      if (blockFilter !== 'All') {
        if (blockFilter === 'UNASSIGNED') {
          if (structureMode === 'verified' && club.verifiedBlock) return false;
          if (structureMode === 'demo' && (club.verifiedBlock || club.demoBlock)) return false;
        } else {
          const targetId = Number(blockFilter);
          const effectiveBlock =
            club.verifiedBlock ?? (structureMode === 'demo' ? club.demoBlock : null);
          if (!effectiveBlock || effectiveBlock.id !== targetId) return false;
        }
      }
      return true;
    });
  }, [clubs, search, categoryFilter, scopeFilter, statusFilter, blockFilter, structureMode]);

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div
            key={n}
            className="bg-white border border-slate-200/90 rounded-xl p-5 h-56 animate-pulse"
          >
            <div className="h-4 w-36 bg-slate-200 rounded" />
            <div className="h-3 w-48 bg-slate-100 rounded mt-3" />
            <div className="h-16 w-full bg-slate-100 rounded mt-6" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-5 flex items-center justify-between gap-4">
        <div className="text-sm">{error}</div>
        <button
          type="button"
          onClick={onRefresh}
          className="h-9 px-3.5 text-xs font-semibold bg-white border border-red-200 text-red-800 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // CLUB PROFILE DETAILS VIEW
  // -------------------------------------------------------------------------
  if (selectedClub) {
    return (
      <ClubProfileDetails
        club={selectedClub}
        allClubs={clubs}
        data={data!}
        structureMode={structureMode}
        onStructureModeChange={onStructureModeChange}
        isAdmin={isAdmin}
        onBack={() => onSelectClub(null)}
        onSelectClub={onSelectClub}
        onOpenStructure={() => onOpenStructure(selectedClub.id)}
        onEditClub={() => setEditingClub(selectedClub)}
        onRefresh={onRefresh}
        actionFeedback={actionFeedback}
        setActionFeedback={setActionFeedback}
        editingClub={editingClub}
        setEditingClub={setEditingClub}
      />
    );
  }

  const counts = data?.verificationCounts;

  return (
    <div className="space-y-6">
      {/* Header & Mode Control Strip */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#315EF8]">
              {data?.university.universityName ?? 'CGC University'} · Institutional Directory
            </div>
            <h2 className="text-xl font-bold text-[#101B3A] mt-0.5">
              University Club Directory ({clubs.length} Clubs)
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              {structureMode === 'verified'
                ? 'Displaying only institutionally confirmed block assignments, supervising authorities, and club coordinators. Unverified records explicitly state pending verification.'
                : 'Displaying confirmed CGC University clubs alongside clearly labeled demonstration placeholders (DEMO ONLY) for clubs awaiting official block and faculty assignment.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <StructureModeSwitcher
              mode={structureMode}
              onChange={(m) => {
                onStructureModeChange(m);
                setBlockFilter('All');
              }}
            />
            <button
              type="button"
              onClick={() => onOpenStructure()}
              className="h-10 px-3.5 text-xs font-semibold text-[#101B3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Network className="w-3.5 h-3.5 text-[#315EF8]" />
              Organisational Map
            </button>
          </div>
        </div>

        {/* Institutional Verification Summary Bar */}
        {counts && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-lg px-3.5 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">Confirmed Clubs</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                {counts.confirmedClubs}
                <span className="text-xs font-normal text-slate-500 ml-1">/ {clubs.length}</span>
              </div>
            </div>
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-lg px-3.5 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">Confirmed Full Hierarchies</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[#315EF8] mt-0.5">
                {counts.confirmedHierarchies}
                <span className="text-xs font-normal text-slate-500 ml-1">
                  ({counts.confirmedBlocks} Blocks)
                </span>
              </div>
            </div>
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-lg px-3.5 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">Pending Block / Leadership</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-700 mt-0.5">
                {counts.unverifiedHierarchies}
              </div>
            </div>
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-lg px-3.5 py-2.5">
              <div className="text-[11px] font-medium text-slate-500">Illustrative / Demo Profiles</div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-0.5">
                {counts.demoClubs}
              </div>
            </div>
          </div>
        )}
      </div>

      {actionFeedback && (
        <div
          className={`rounded-xl px-4 py-3 border text-sm flex items-center justify-between gap-4 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-xs font-semibold opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search, Filter & Admin Management Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[210px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search club, block, or faculty..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-[#F4F6FC] border border-slate-200 rounded-lg focus:outline-none focus:border-[#315EF8]"
            />
          </div>

          <select
            aria-label="Filter by University Block"
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="h-9 px-3 text-xs font-medium bg-[#F4F6FC] border border-slate-200 rounded-lg text-[#101B3A]"
          >
            <option value="All">All Blocks</option>
            {filterMeta.blocksList.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.blockName}
              </option>
            ))}
            <option value="UNASSIGNED">Block Pending Verification</option>
          </select>

          <select
            aria-label="Filter by Club Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 text-xs font-medium bg-[#F4F6FC] border border-slate-200 rounded-lg text-[#101B3A]"
          >
            <option value="All">All Categories</option>
            {filterMeta.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Operational Scope"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="h-9 px-3 text-xs font-medium bg-[#F4F6FC] border border-slate-200 rounded-lg text-[#101B3A]"
          >
            <option value="All">All Operational Scopes</option>
            {filterMeta.scopes.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Verification Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 text-xs font-medium bg-[#F4F6FC] border border-slate-200 rounded-lg text-[#101B3A]"
          >
            <option value="All">All Verification Statuses</option>
            <option value="CONFIRMED">Verified</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="DEMO">Demo / Illustrative</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => setShowAddBlockModal(true)}
                className="h-9 px-3 text-xs font-semibold text-[#101B3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-[#7657E8]" />
                Add Block
              </button>
              <button
                type="button"
                onClick={() => setShowAddClubModal(true)}
                className="h-9 px-3.5 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Confirmed Club
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Admin sign-in required to edit hierarchy
            </span>
          )}
        </div>
      </div>

      {/* 11-Club Card Grid */}
      {filteredClubs.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-xl p-10 text-center">
          <p className="text-sm font-semibold text-[#101B3A]">
            No clubs match the selected filter criteria.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setBlockFilter('All');
              setCategoryFilter('All');
              setScopeFilter('All');
              setStatusFilter('All');
            }}
            className="mt-3 text-xs font-semibold text-[#315EF8] hover:underline"
          >
            Reset Directory Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredClubs.map((club) => {
            const effectiveBlock =
              club.verifiedBlock ??
              (structureMode === 'demo' ? club.demoBlock : null);
            const isDemoBlockShown =
              !club.verifiedBlock && structureMode === 'demo' && Boolean(club.demoBlock);

            const effectiveLeader =
              club.confirmedLeadership ??
              (structureMode === 'demo' ? club.demoLeadership : null);
            const isDemoLeaderShown =
              !club.confirmedLeadership &&
              structureMode === 'demo' &&
              Boolean(club.demoLeadership);

            const isIllustrativeProfile =
              club.code === 'DCC' || club.code === 'DRR' || club.code === 'NGO';

            return (
              <article
                key={club.id}
                className="bg-white border border-slate-200/90 hover:border-[#315EF8]/50 rounded-xl flex flex-col justify-between transition-colors overflow-hidden"
              >
                <div>
                  {/* Top Institutional Distinction Strip (only when confirmed distinction exists) */}
                  {club.institutionalDistinction && (
                    <div className="px-5 py-2 bg-[#101B3A] text-white flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase">
                      <Award className="w-3.5 h-3.5 text-[#18B6A0] shrink-0" />
                      <span className="truncate">{club.institutionalDistinction}</span>
                    </div>
                  )}

                  {/* Explicit Illustrative Notice for DCC / DRR / NGO */}
                  {isIllustrativeProfile && !club.institutionalDistinction && (
                    <div className="px-5 py-1.5 bg-amber-50 border-b border-amber-200/80 text-amber-900 text-[11px] font-semibold tracking-wide uppercase">
                      {club.code === 'NGO'
                        ? 'PROVISIONAL PROFILE — DEMONSTRATION ASSUMPTION'
                        : 'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION'}
                    </div>
                  )}

                  <div className="p-5 space-y-4">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <CgcClubEmblem code={club.code} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-[#101B3A] leading-snug truncate">
                              {club.name}
                            </h3>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              {club.code}
                            </span>
                          </div>
                          {club.fullName && club.fullName !== club.name && (
                            <div className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                              {club.fullName}
                            </div>
                          )}
                          <div className="text-xs font-medium text-[#315EF8] mt-1">
                            {club.category}
                            {club.operationalIdentity ? ` · ${club.operationalIdentity}` : ''}
                          </div>
                        </div>
                      </div>
                      <VerificationTag status={club.verificationStatus} compact />
                    </div>

                    {/* Parent-Child Derivation Callout (e.g. DSA └── SAC) */}
                    {club.parentClub && (
                      <div className="px-3 py-2 rounded-lg bg-[#F4F6FC] border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 text-[#101B3A] font-semibold">
                          <GitBranch className="w-3.5 h-3.5 text-[#315EF8]" />
                          Derived from {club.parentClub.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {club.parentClub.code} └── {club.code}
                        </span>
                      </div>
                    )}

                    {/* Institutional Hierarchy Metadata */}
                    <div className="space-y-2 pt-1 text-xs border-t border-slate-100">
                      <div className="flex items-start gap-2 pt-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-slate-500">Block: </span>
                          {effectiveBlock ? (
                            <span
                              className={
                                isDemoBlockShown
                                  ? 'text-amber-800 font-medium'
                                  : 'text-[#101B3A] font-semibold'
                              }
                            >
                              {effectiveBlock.blockName}
                              {effectiveBlock.schoolName && !isDemoBlockShown
                                ? ` — ${effectiveBlock.schoolName}`
                                : ''}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">{AWAITING_TEXT}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-slate-500">Authority: </span>
                          {effectiveLeader?.supervisingAuthority ? (
                            <span
                              className={
                                isDemoLeaderShown
                                  ? 'text-amber-800 font-medium'
                                  : 'text-[#101B3A] font-semibold'
                              }
                            >
                              {effectiveLeader.supervisingAuthority}
                              {effectiveLeader.authorityDesignation
                                ? ` (${effectiveLeader.authorityDesignation})`
                                : ''}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">{AWAITING_TEXT}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-slate-500">Coordinator: </span>
                          {effectiveLeader?.coordinatorName ? (
                            <span
                              className={
                                isDemoLeaderShown
                                  ? 'text-amber-800 font-medium'
                                  : 'text-[#101B3A] font-semibold'
                              }
                            >
                              {effectiveLeader.coordinatorName}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">{AWAITING_TEXT}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Operational Scope Summary */}
                    {club.operationalScope && (
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {club.operationalScope}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-5 py-3 bg-[#F8FAFC] border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-500">
                    <span>
                      {club.analytics.memberCount} members
                    </span>
                    <span>·</span>
                    <span>{club.analytics.eventCount} events</span>
                    {club.isSyntheticData && (
                      <span className="text-amber-700 font-semibold">DEMO DATA</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectClub(club.id)}
                    className="text-xs font-semibold text-[#315EF8] hover:text-[#1E40AF] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    View Details
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Admin Modals */}
      {showAddClubModal && data && (
        <AddClubModal
          blocks={data.verifiedBlocks}
          clubs={clubs}
          onClose={() => setShowAddClubModal(false)}
          onSaved={async (msg) => {
            setShowAddClubModal(false);
            setActionFeedback({ type: 'success', text: msg });
            await onRefresh();
          }}
          onError={(msg) => setActionFeedback({ type: 'error', text: msg })}
        />
      )}

      {showAddBlockModal && (
        <AddBlockModal
          onClose={() => setShowAddBlockModal(false)}
          onSaved={async (msg) => {
            setShowAddBlockModal(false);
            setActionFeedback({ type: 'success', text: msg });
            await onRefresh();
          }}
          onError={(msg) => setActionFeedback({ type: 'error', text: msg })}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// CLUB PROFILE DETAILS SUB-VIEW
// ---------------------------------------------------------------------------
interface ClubProfileDetailsProps {
  club: CgcClub;
  allClubs: CgcClub[];
  data: CgcDirectoryData;
  structureMode: StructureViewMode;
  onStructureModeChange: (mode: StructureViewMode) => void;
  isAdmin: boolean;
  onBack: () => void;
  onSelectClub: (id: number | null) => void;
  onOpenStructure: () => void;
  onEditClub: () => void;
  onRefresh: () => Promise<void>;
  actionFeedback: { type: 'success' | 'error'; text: string } | null;
  setActionFeedback: (v: { type: 'success' | 'error'; text: string } | null) => void;
  editingClub: CgcClub | null;
  setEditingClub: (c: CgcClub | null) => void;
}

const ClubProfileDetails: React.FC<ClubProfileDetailsProps> = ({
  club,
  allClubs,
  data,
  structureMode,
  onStructureModeChange,
  isAdmin,
  onBack,
  onSelectClub,
  onOpenStructure,
  onEditClub,
  onRefresh,
  actionFeedback,
  setActionFeedback,
  editingClub,
  setEditingClub,
}) => {
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityCat, setNewActivityCat] = useState('Operational');
  const [newActivityDesc, setNewActivityDesc] = useState('');
  const [addingActivity, setAddingActivity] = useState(false);

  const effectiveBlock =
    club.verifiedBlock ?? (structureMode === 'demo' ? club.demoBlock : null);
  const isDemoBlock = !club.verifiedBlock && structureMode === 'demo' && Boolean(club.demoBlock);

  const effectiveLeader =
    club.confirmedLeadership ??
    (structureMode === 'demo' ? club.demoLeadership : null);
  const isDemoLeader =
    !club.confirmedLeadership && structureMode === 'demo' && Boolean(club.demoLeadership);

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName.trim()) return;
    setAddingActivity(true);
    setActionFeedback(null);
    try {
      await apiFetch(`/api/cgc/clubs/${club.id}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          activityName: newActivityName.trim(),
          activityCategory: newActivityCat,
          description: newActivityDesc.trim(),
          verificationStatus: 'CONFIRMED',
        }),
      });
      setNewActivityName('');
      setNewActivityDesc('');
      setActionFeedback({ type: 'success', text: 'Club activity recorded in PostgreSQL.' });
      await onRefresh();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to add activity.' });
    } finally {
      setAddingActivity(false);
    }
  };

  const handleDeleteActivity = async (activityId: number) => {
    try {
      await apiFetch(`/api/cgc/activities/${activityId}`, { method: 'DELETE' });
      setActionFeedback({ type: 'success', text: 'Activity removed.' });
      await onRefresh();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to remove activity.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-3 text-xs font-semibold text-[#101B3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to CGC Club Directory
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <StructureModeSwitcher
            mode={structureMode}
            onChange={onStructureModeChange}
          />
          <button
            type="button"
            onClick={onOpenStructure}
            className="h-10 px-3.5 text-xs font-semibold text-[#101B3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5"
          >
            <Network className="w-3.5 h-3.5 text-[#315EF8]" />
            View in Org Map
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={onEditClub}
              className="h-10 px-3.5 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] rounded-lg inline-flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Club &amp; Leadership
            </button>
          )}
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`rounded-xl px-4 py-3 border text-sm flex items-center justify-between gap-4 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{actionFeedback.text}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Profile Summary */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
        {club.institutionalDistinction && (
          <div className="px-6 py-2.5 bg-[#101B3A] text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
              <Award className="w-4 h-4 text-[#18B6A0]" />
              <span>{club.institutionalDistinction}</span>
            </div>
            <span className="text-[11px] text-slate-300">
              Supplied institutional distinction (independent of calculated membership counts)
            </span>
          </div>
        )}

        {(club.code === 'DCC' || club.code === 'DRR' || club.code === 'NGO') && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-semibold">
            {club.code === 'NGO'
              ? 'PROVISIONAL ILLUSTRATIVE PROFILE — Community/social-service profile included as a demonstration assumption; official CGC University details require confirmation.'
              : 'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION. No official acronym expansion has been assumed.'}
          </div>
        )}

        <div className="p-6 flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <CgcClubEmblem code={club.code} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-bold text-[#101B3A] tracking-tight">
                  {club.name}
                </h2>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {club.code}
                </span>
                <VerificationTag status={club.verificationStatus} />
              </div>

              {club.fullName && club.fullName !== club.name && (
                <div className="text-sm font-medium text-slate-700 mt-1">
                  {club.fullName}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>
                  Category: <strong className="text-[#101B3A]">{club.category}</strong>
                </span>
                {club.operationalIdentity && (
                  <span>
                    Identity: <strong className="text-[#315EF8]">{club.operationalIdentity}</strong>
                  </span>
                )}
                <span>
                  Status: <strong className="text-[#101B3A]">{club.operationalStatus}</strong>
                </span>
              </div>

              {club.description && (
                <p className="text-sm text-slate-600 mt-3 max-w-3xl leading-relaxed">
                  {club.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: Hierarchy & Governance + Live PostgreSQL Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Institutional Governance, Block, Leadership, Parent/Child */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#101B3A]">
                  Organisational Hierarchy &amp; Supervision
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Block placement, supervising authority, and appointed faculty coordinator
                </p>
              </div>
              <VerificationTag status={club.fieldVerification.leadership} compact />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Block */}
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200/80">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    University Block / School
                  </span>
                  <VerificationTag
                    status={club.verifiedBlock ? 'CONFIRMED' : isDemoBlock ? 'DEMO' : 'PENDING_VERIFICATION'}
                    compact
                  />
                </div>
                {effectiveBlock ? (
                  <div>
                    <div className={`text-sm font-bold ${isDemoBlock ? 'text-amber-900' : 'text-[#101B3A]'}`}>
                      {effectiveBlock.blockName}
                    </div>
                    {effectiveBlock.schoolName && (
                      <div className="text-xs text-slate-600 mt-0.5">
                        {effectiveBlock.schoolName}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">{AWAITING_TEXT}</div>
                )}
              </div>

              {/* Organisational Relationship */}
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200/80">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Organisational Relationship
                </div>
                {club.parentClub ? (
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-[#315EF8] font-semibold">
                      {club.parentClub.code} └── {club.code}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectClub(club.parentClub!.id)}
                      className="text-xs font-semibold text-[#101B3A] hover:text-[#315EF8] underline"
                    >
                      Derived from {club.parentClub.name}
                    </button>
                  </div>
                ) : club.childClubs.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-600">Parent organisation of:</div>
                    <div className="flex flex-wrap gap-2">
                      {club.childClubs.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => onSelectClub(child.id)}
                          className="text-xs font-semibold text-[#315EF8] bg-white border border-slate-200 px-2.5 py-1 rounded-md hover:border-[#315EF8]"
                        >
                          {club.code} └── {child.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600">
                    Independent CGC University student club
                  </div>
                )}
              </div>

              {/* Supervising Authority */}
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200/80">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Supervising Authority
                </div>
                {effectiveLeader?.supervisingAuthority ? (
                  <div>
                    <div className={`text-sm font-bold ${isDemoLeader ? 'text-amber-900' : 'text-[#101B3A]'}`}>
                      {effectiveLeader.supervisingAuthority}
                    </div>
                    {effectiveLeader.authorityDesignation ? (
                      <div className="text-xs text-slate-600 mt-0.5">
                        {effectiveLeader.authorityDesignation}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic mt-0.5">
                        Official designation pending institutional verification
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">{AWAITING_TEXT}</div>
                )}
              </div>

              {/* Club Coordinator / Manager */}
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200/80">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Club Coordinator / Manager
                </div>
                {effectiveLeader?.coordinatorName ? (
                  <div>
                    <div className={`text-sm font-bold ${isDemoLeader ? 'text-amber-900' : 'text-[#101B3A]'}`}>
                      {effectiveLeader.coordinatorName}
                    </div>
                    {effectiveLeader.coordinatorDesignation && (
                      <div className="text-xs text-slate-600 mt-0.5">
                        {effectiveLeader.coordinatorDesignation}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">{AWAITING_TEXT}</div>
                )}
              </div>
            </div>

            {/* Operational Scope */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-bold text-[#101B3A]">Operational Responsibilities</span>
                <VerificationTag status={club.fieldVerification.operationalScope} compact />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {club.operationalScope || AWAITING_TEXT}
              </p>
            </div>
          </div>

          {/* Club Activities */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#101B3A]">
                  Club Activities &amp; Programmes
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operational initiatives tagged individually by institutional verification status
                </p>
              </div>
              <VerificationTag status={club.fieldVerification.activities} compact />
            </div>

            {club.activities.length === 0 ? (
              <p className="text-xs text-slate-500 italic">{AWAITING_TEXT}</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden">
                {club.activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3.5 bg-white flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#101B3A]">
                          {act.activityName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {act.activityCategory}
                        </span>
                        <VerificationTag status={act.verificationStatus} compact />
                      </div>
                      {act.description && (
                        <p className="text-xs text-slate-600 mt-1">{act.description}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteActivity(act.id)}
                        aria-label={`Remove ${act.activityName}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isAdmin && (
              <form
                onSubmit={handleAddActivity}
                className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-2.5"
              >
                <input
                  type="text"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  placeholder="Add verified club activity..."
                  className="sm:col-span-5 h-9 px-3 text-xs bg-[#F4F6FC] border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={newActivityCat}
                  onChange={(e) => setNewActivityCat(e.target.value)}
                  placeholder="Category"
                  className="sm:col-span-3 h-9 px-3 text-xs bg-[#F4F6FC] border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={newActivityDesc}
                  onChange={(e) => setNewActivityDesc(e.target.value)}
                  placeholder="Short description"
                  className="sm:col-span-4 h-9 px-3 text-xs bg-[#F4F6FC] border border-slate-200 rounded-lg"
                />
                <div className="sm:col-span-12 flex justify-end">
                  <button
                    type="submit"
                    disabled={addingActivity || !newActivityName.trim()}
                    className="h-8 px-3.5 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-50 rounded-lg"
                  >
                    {addingActivity ? 'Saving...' : 'Add Activity'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Calculated PostgreSQL Analytics + Field-Level Audit */}
        <div className="lg:col-span-5 space-y-6">
          {/* Calculated Analytics Panel */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#101B3A]">
                  PostgreSQL Participation Metrics
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculated directly from recorded memberships, events, and attendance
                </p>
              </div>
              {club.isSyntheticData && (
                <span className="px-2 py-0.5 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-bold whitespace-nowrap shrink-0">
                  DEMO DATA
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200/80">
                <div className="text-[11px] text-slate-500">Recorded Members</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#315EF8] mt-1">
                  {club.analytics.memberCount}
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200/80">
                <div className="text-[11px] text-slate-500">Events Logged</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#7657E8] mt-1">
                  {club.analytics.eventCount}
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200/80">
                <div className="text-[11px] text-slate-500">Event Check-Ins</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#101B3A] mt-1">
                  {club.analytics.totalCheckIns}
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200/80">
                <div className="text-[11px] text-slate-500">Attendance Rate</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#18B6A0] mt-1">
                  {club.analytics.attendanceRate}%
                </div>
              </div>
            </div>

            {club.analytics.participationTrends.length > 0 ? (
              <div className="pt-2">
                <div className="text-xs font-semibold text-slate-600 mb-2">
                  Monthly Check-In Trend
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={club.analytics.participationTrends}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#101B3A',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="checkIns" name="Check-Ins" fill="#315EF8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
                <CalendarDays className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  No membership or event records have been imported yet for {club.name}. Use
                  Data Management or Event Analytics to import verified attendance rosters.
                </span>
              </div>
            )}

            {club.analytics.recentEvents.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Recent Logged Events</div>
                {club.analytics.recentEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-slate-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#101B3A] truncate">{ev.title}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{ev.eventDate}</div>
                    </div>
                    <span className="font-mono text-[#18B6A0] font-semibold shrink-0">
                      {ev.presentCount} present
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Field-Level Data Verification Audit */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-[#101B3A]">
              Field-Level Verification Status
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {(
                [
                  ['Official Club Name', club.fieldVerification.name],
                  ['Operational Scope', club.fieldVerification.operationalScope],
                  ['University Block Assignment', club.fieldVerification.block],
                  ['Supervising Authority & Coordinator', club.fieldVerification.leadership],
                  ['Club Activities', club.fieldVerification.activities],
                ] as const
              ).map(([label, status]) => (
                <div key={label} className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-600 font-medium">{label}</span>
                  <VerificationTag status={status} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Club Modal */}
      {editingClub && (
        <EditClubModal
          club={editingClub}
          blocks={data.verifiedBlocks}
          allClubs={allClubs}
          onClose={() => setEditingClub(null)}
          onSaved={async (msg) => {
            setEditingClub(null);
            setActionFeedback({ type: 'success', text: msg });
            await onRefresh();
          }}
          onError={(msg) => setActionFeedback({ type: 'error', text: msg })}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ADMIN MODAL: EDIT CLUB & LEADERSHIP
// ---------------------------------------------------------------------------
const EditClubModal: React.FC<{
  club: CgcClub;
  blocks: CgcDirectoryData['verifiedBlocks'];
  allClubs: CgcClub[];
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}> = ({ club, blocks, allClubs, onClose, onSaved, onError }) => {
  const [name, setName] = useState(club.name);
  const [fullName, setFullName] = useState(club.fullName);
  const [category, setCategory] = useState(club.category);
  const [operationalIdentity, setOperationalIdentity] = useState(club.operationalIdentity ?? '');
  const [operationalScope, setOperationalScope] = useState(club.operationalScope ?? '');
  const [institutionalDistinction, setInstitutionalDistinction] = useState(
    club.institutionalDistinction ?? ''
  );
  const [blockId, setBlockId] = useState<string>(club.blockId ? String(club.blockId) : '');
  const [parentClubId, setParentClubId] = useState<string>(
    club.parentClub ? String(club.parentClub.id) : ''
  );
  const [verificationStatus, setVerificationStatus] = useState<string>(club.verificationStatus);
  const [supervisingAuthority, setSupervisingAuthority] = useState(
    club.confirmedLeadership?.supervisingAuthority ?? ''
  );
  const [authorityDesignation, setAuthorityDesignation] = useState(
    club.confirmedLeadership?.authorityDesignation ?? ''
  );
  const [coordinatorName, setCoordinatorName] = useState(
    club.confirmedLeadership?.coordinatorName ?? ''
  );
  const [coordinatorDesignation, setCoordinatorDesignation] = useState(
    club.confirmedLeadership?.coordinatorDesignation ?? ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/cgc/clubs/${club.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          fullName,
          category,
          operationalIdentity,
          operationalScope,
          institutionalDistinction,
          blockId: blockId ? Number(blockId) : null,
          parentClubId: parentClubId ? Number(parentClubId) : null,
          verificationStatus,
          supervisingAuthority,
          authorityDesignation,
          coordinatorName,
          coordinatorDesignation,
          fieldVerification: {
            ...club.fieldVerification,
            block: blockId ? 'CONFIRMED' : 'PENDING_VERIFICATION',
            leadership:
              supervisingAuthority.trim() || coordinatorName.trim()
                ? 'CONFIRMED'
                : 'PENDING_VERIFICATION',
            operationalScope: operationalScope.trim() ? verificationStatus : 'PENDING_VERIFICATION',
          },
        }),
      });
      await onSaved(`Updated institutional record for ${name}.`);
    } catch (err: any) {
      onError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101B3A]/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#101B3A]">
              Edit Institutional Record — {club.name}
            </h3>
            <p className="text-xs text-slate-500">
              Changes persist directly to Cloud SQL PostgreSQL. Leave unverified fields blank.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Display Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Full Official Name</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Category</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Verification Status</span>
              <select
                value={verificationStatus}
                onChange={(e) => setVerificationStatus(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              >
                <option value="CONFIRMED">Verified (Confirmed)</option>
                <option value="PENDING_VERIFICATION">Pending Verification</option>
                <option value="DEMO">Demo / Illustrative</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Verified University Block</span>
              <select
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              >
                <option value="">Unassigned / Pending Verification</option>
                {blocks.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.blockName} {b.schoolName ? `— ${b.schoolName}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Parent Club (if derived)</span>
              <select
                value={parentClubId}
                onChange={(e) => setParentClubId(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              >
                <option value="">None (Independent)</option>
                {allClubs
                  .filter((c) => c.id !== club.id)
                  .map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name} ({c.code})
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Supervising Authority (Confirmed)</span>
              <input
                type="text"
                value={supervisingAuthority}
                onChange={(e) => setSupervisingAuthority(e.target.value)}
                placeholder="Leave blank if pending verification"
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Official Designation (Confirmed)</span>
              <input
                type="text"
                value={authorityDesignation}
                onChange={(e) => setAuthorityDesignation(e.target.value)}
                placeholder="Leave blank if unverified"
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Club Coordinator / Manager</span>
              <input
                type="text"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                placeholder="Leave blank if pending verification"
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Coordinator Role</span>
              <input
                type="text"
                value={coordinatorDesignation}
                onChange={(e) => setCoordinatorDesignation(e.target.value)}
                placeholder="e.g. Club Coordinator & Manager"
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Operational Identity</span>
              <input
                type="text"
                value={operationalIdentity}
                onChange={(e) => setOperationalIdentity(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Institutional Distinction</span>
              <input
                type="text"
                value={institutionalDistinction}
                onChange={(e) => setInstitutionalDistinction(e.target.value)}
                placeholder="Optional verified distinction"
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Operational Scope</span>
            <textarea
              rows={3}
              value={operationalScope}
              onChange={(e) => setOperationalScope(e.target.value)}
              className="w-full p-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
            />
          </label>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-50 rounded-lg"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ADMIN MODAL: ADD NEW CONFIRMED CLUB
// ---------------------------------------------------------------------------
const AddClubModal: React.FC<{
  blocks: CgcDirectoryData['verifiedBlocks'];
  clubs: CgcClub[];
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}> = ({ blocks, clubs, onClose, onSaved, onError }) => {
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('All-Rounder');
  const [operationalIdentity, setOperationalIdentity] = useState('');
  const [operationalScope, setOperationalScope] = useState('');
  const [blockId, setBlockId] = useState('');
  const [parentClubId, setParentClubId] = useState('');
  const [supervisingAuthority, setSupervisingAuthority] = useState('');
  const [authorityDesignation, setAuthorityDesignation] = useState('');
  const [coordinatorName, setCoordinatorName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/cgc/clubs', {
        method: 'POST',
        body: JSON.stringify({
          name,
          fullName: fullName || name,
          code,
          category,
          operationalIdentity,
          operationalScope,
          blockId: blockId ? Number(blockId) : null,
          parentClubId: parentClubId ? Number(parentClubId) : null,
          supervisingAuthority,
          authorityDesignation,
          coordinatorName,
          verificationStatus: 'CONFIRMED',
        }),
      });
      await onSaved(`Added "${name}" to the CGC University Club Directory.`);
    } catch (err: any) {
      onError(err.message || 'Failed to add club.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101B3A]/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#101B3A]">Add Confirmed CGC University Club</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Club Name *</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Short Code</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="font-semibold text-slate-700">Full Official Name</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Category</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Operational Identity</span>
              <input
                type="text"
                value={operationalIdentity}
                onChange={(e) => setOperationalIdentity(e.target.value)}
                placeholder="e.g. Technology Club"
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Verified Block</span>
              <select
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              >
                <option value="">Pending Verification</option>
                {blocks.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.blockName}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Parent Club</span>
              <select
                value={parentClubId}
                onChange={(e) => setParentClubId(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              >
                <option value="">None</option>
                {clubs.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Supervising Authority</span>
              <input
                type="text"
                value={supervisingAuthority}
                onChange={(e) => setSupervisingAuthority(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700">Authority Designation</span>
              <input
                type="text"
                value={authorityDesignation}
                onChange={(e) => setAuthorityDesignation(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="font-semibold text-slate-700">Club Coordinator</span>
              <input
                type="text"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Operational Scope</span>
            <textarea
              rows={2}
              value={operationalScope}
              onChange={(e) => setOperationalScope(e.target.value)}
              className="w-full p-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
            />
          </label>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-50 rounded-lg"
            >
              {saving ? 'Adding...' : 'Add Club'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ADMIN MODAL: ADD NEW VERIFIED BLOCK
// ---------------------------------------------------------------------------
const AddBlockModal: React.FC<{
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}> = ({ onClose, onSaved, onError }) => {
  const [blockName, setBlockName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [blockHeadName, setBlockHeadName] = useState('');
  const [blockHeadDesignation, setBlockHeadDesignation] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockName.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/cgc/blocks', {
        method: 'POST',
        body: JSON.stringify({
          blockName,
          schoolName,
          blockHeadName,
          blockHeadDesignation,
          verificationStatus: 'CONFIRMED',
        }),
      });
      await onSaved(`Added verified university block "${blockName}".`);
    } catch (err: any) {
      onError(err.message || 'Failed to add university block.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101B3A]/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#101B3A]">Add Verified University Block</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Block Name *</span>
            <input
              type="text"
              required
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              placeholder="e.g. Block 4"
              className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">School / Institutional Division</span>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Optional official school name"
              className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Supervising Authority / Head</span>
            <input
              type="text"
              value={blockHeadName}
              onChange={(e) => setBlockHeadName(e.target.value)}
              placeholder="Leave blank if pending"
              className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Official Designation</span>
            <input
              type="text"
              value={blockHeadDesignation}
              onChange={(e) => setBlockHeadDesignation(e.target.value)}
              placeholder="Leave blank if unverified"
              className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg"
            />
          </label>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-50 rounded-lg"
            >
              {saving ? 'Adding...' : 'Save Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
