import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Info,
  Network,
  Share2,
  UserCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CgcClub,
  CgcDirectoryData,
  StructureViewMode,
} from '../types';
import {
  CgcClubEmblem,
  StructureModeSwitcher,
  VerificationTag,
} from './CgcVisuals';

interface UniversityStructureViewProps {
  data: CgcDirectoryData | null;
  loading: boolean;
  error: string | null;
  structureMode: StructureViewMode;
  onStructureModeChange: (mode: StructureViewMode) => void;
  highlightedClubId: number | null;
  onHighlightClub: (clubId: number | null) => void;
  onOpenClubProfile: (clubId: number) => void;
  onRefresh: () => Promise<void>;
}

type StructureTab = 'org-map' | 'block-analysis' | 'relationships';

const AWAITING_TEXT = 'Information awaiting institutional verification.';
const CHART_COLORS = ['#315EF8', '#18B6A0', '#7657E8', '#4F77FF', '#0F766E', '#64748B', '#D97706'];

export const UniversityStructureView: React.FC<UniversityStructureViewProps> = ({
  data,
  loading,
  error,
  structureMode,
  onStructureModeChange,
  highlightedClubId,
  onHighlightClub,
  onOpenClubProfile,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<StructureTab>('org-map');
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});
  const [compareLeft, setCompareLeft] = useState<string>('BLK-6');
  const [compareRight, setCompareRight] = useState<string>('BLK-R3');

  const clubs = data?.clubs ?? [];
  const selectedClub = useMemo(
    () =>
      (highlightedClubId !== null
        ? clubs.find((c) => c.id === highlightedClubId)
        : clubs.find((c) => c.code === 'ICA')) ?? clubs[0] ?? null,
    [clubs, highlightedClubId]
  );

  // Build grouped organisational blocks based on active view mode (Verified vs Demo)
  const orgGroups = useMemo(() => {
    if (!data) return [];

    if (structureMode === 'verified') {
      const confirmedGroups = data.verifiedBlocks.map((block) => ({
        key: block.code,
        title: block.blockName,
        subtitle: block.schoolName || 'Verified University Block',
        headName: block.blockHeadName,
        headDesignation: block.blockHeadDesignation,
        status: block.verificationStatus,
        isDemo: false,
        clubs: clubs.filter((c) => c.blockId === block.id),
      }));

      const unassignedClubs = clubs.filter((c) => !c.blockId);
      return [
        ...confirmedGroups,
        {
          key: 'UNASSIGNED',
          title: 'Other University Clubs (Block Pending Verification)',
          subtitle: 'Operating independently — official block and faculty hierarchy awaiting verification',
          headName: null,
          headDesignation: null,
          status: 'PENDING_VERIFICATION',
          isDemo: false,
          clubs: unassignedClubs,
        },
      ];
    }

    // University Demo Structure: Confirmed blocks first, then clearly labeled Demo Placeholder blocks
    const confirmedGroups = data.verifiedBlocks.map((block) => ({
      key: block.code,
      title: block.blockName,
      subtitle: block.schoolName || 'Verified University Block',
      headName: block.blockHeadName,
      headDesignation: block.blockHeadDesignation,
      status: block.verificationStatus,
      isDemo: false,
      clubs: clubs.filter((c) => c.blockId === block.id),
    }));

    const demoGroups = data.demoBlocks.map((block) => ({
      key: block.code,
      title: block.blockName,
      subtitle: block.schoolName || 'Illustrative Demonstration Group Only',
      headName: block.blockHeadName,
      headDesignation: block.blockHeadDesignation,
      status: 'DEMO',
      isDemo: true,
      clubs: clubs.filter((c) => !c.blockId && c.demoBlockId === block.id),
    }));

    const remaining = clubs.filter((c) => !c.blockId && !c.demoBlockId);
    if (remaining.length > 0) {
      demoGroups.push({
        key: 'UNASSIGNED',
        title: 'Unassigned Clubs',
        subtitle: 'No block assigned yet',
        headName: null,
        headDesignation: null,
        status: 'PENDING_VERIFICATION',
        isDemo: false,
        clubs: remaining,
      });
    }

    return [...confirmedGroups, ...demoGroups];
  }, [data, clubs, structureMode]);

  const toggleBlock = (key: string) => {
    setCollapsedBlocks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllCollapsed = (collapsed: boolean) => {
    const next: Record<string, boolean> = {};
    orgGroups.forEach((g) => {
      next[g.key] = collapsed;
    });
    setCollapsedBlocks(next);
  };

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-xl p-8 h-72 animate-pulse" />
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-5 flex items-center justify-between gap-4">
        <span className="text-sm">{error}</span>
        <button
          type="button"
          onClick={onRefresh}
          className="h-9 px-3.5 text-xs font-semibold bg-white border border-red-200 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const blockLeft =
    data.blockSummary.find((b) => b.code === compareLeft) ?? data.blockSummary[0];
  const blockRight =
    data.blockSummary.find((b) => b.code === compareRight) ?? data.blockSummary[1] ?? data.blockSummary[0];

  return (
    <div className="space-y-6">
      {/* Header + Sub-Navigation Tabs + Verified/Demo Switcher */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#315EF8]">
              {data.university.universityName} · Institutional Architecture
            </div>
            <h2 className="text-xl font-bold text-[#101B3A] mt-0.5">
              University Organisational Structure &amp; Club Network
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Clubs at CGC University operate under distinct blocks, schools, and supervising
              authorities rather than a single common coordinator.
            </p>
          </div>

          <StructureModeSwitcher
            mode={structureMode}
            onChange={onStructureModeChange}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['org-map', 'University Organisational Map', Network],
                ['block-analysis', 'Block-Wise Club Analysis', BarChart3],
                ['relationships', 'Club Relationship Analysis', Share2],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === id
                    ? 'bg-[#315EF8] text-white'
                    : 'bg-[#F4F6FC] text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'org-map' && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setAllCollapsed(false)}
                className="text-slate-600 hover:text-[#101B3A] font-medium px-2 py-1"
              >
                Expand All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setAllCollapsed(true)}
                className="text-slate-600 hover:text-[#101B3A] font-medium px-2 py-1"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: UNIVERSITY ORGANISATIONAL MAP                                  */}
      {/* ===================================================================== */}
      {activeTab === 'org-map' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Interactive Connected Tree (8 cols) */}
          <div className="xl:col-span-8 space-y-4">
            {/* Root Institutional Node */}
            <div className="bg-[#101B3A] text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#315EF8] flex items-center justify-center font-bold text-sm">
                  CGC
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">
                    Root Institution
                  </div>
                  <div className="text-lg font-bold">{data.university.universityName}</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {data.verificationCounts.confirmedBlocks} Confirmed Blocks · {clubs.length} Student Clubs · Independent Multi-Authority Governance
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 font-semibold">
                  Green: Verified
                </span>
                <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-200 font-semibold">
                  Amber: Demo
                </span>
                <span className="px-2 py-1 rounded bg-white/10 text-slate-200 font-semibold">
                  Grey: Pending
                </span>
              </div>
            </div>

            {/* Branch Lines into Blocks */}
            <div className="pl-4 sm:pl-7 border-l-2 border-slate-200 space-y-4">
              {orgGroups.map((group) => {
                const isCollapsed = Boolean(collapsedBlocks[group.key]);
                // Filter out child clubs so SAC nests neatly under DSA!
                const topLevelClubs = group.clubs.filter(
                  (c) => !c.parentClub || !group.clubs.some((p) => p.id === c.parentClub?.id)
                );

                return (
                  <div
                    key={group.key}
                    className={`bg-white border rounded-xl overflow-hidden ${
                      group.isDemo
                        ? 'border-amber-200'
                        : group.status === 'CONFIRMED'
                        ? 'border-emerald-200/90'
                        : 'border-slate-200/90'
                    }`}
                  >
                    {/* Block Header */}
                    <button
                      type="button"
                      onClick={() => toggleBlock(group.key)}
                      className="w-full px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-[#F8FAFC] transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 text-slate-400">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Building2
                              className={`w-4 h-4 shrink-0 ${
                                group.isDemo
                                  ? 'text-amber-600'
                                  : group.status === 'CONFIRMED'
                                  ? 'text-emerald-600'
                                  : 'text-slate-500'
                              }`}
                            />
                            <span className="text-sm font-bold text-[#101B3A]">
                              {group.title}
                            </span>
                            <VerificationTag status={group.status} compact />
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{group.subtitle}</div>
                        </div>
                      </div>

                      <span className="text-xs font-mono tabular-nums font-semibold text-slate-600 bg-[#F4F6FC] px-2.5 py-1 rounded-md shrink-0">
                        {group.clubs.length} {group.clubs.length === 1 ? 'Club' : 'Clubs'}
                      </span>
                    </button>

                    {/* Expanded Block Hierarchy */}
                    {!isCollapsed && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-3">
                        {/* Block-level Supervising Authority Banner (if confirmed or demo block head) */}
                        {group.headName && (
                          <div
                            className={`px-3.5 py-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                              group.isDemo
                                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                                : 'bg-emerald-50/60 border-emerald-200 text-[#101B3A]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 shrink-0 text-[#315EF8]" />
                              <span>
                                <span className="text-slate-500">Supervising Authority: </span>
                                <strong>{group.headName}</strong>
                                {group.headDesignation ? ` — ${group.headDesignation}` : ''}
                              </span>
                            </div>
                            {!group.headDesignation && !group.isDemo && (
                              <span className="text-[11px] text-slate-500 italic">
                                Designation pending verification
                              </span>
                            )}
                          </div>
                        )}

                        {/* Club Nodes under this Block */}
                        <div className="pl-3 sm:pl-5 border-l-2 border-slate-200/90 space-y-3">
                          {topLevelClubs.map((club) => {
                            const effectiveLeader =
                              club.confirmedLeadership ??
                              (structureMode === 'demo' ? club.demoLeadership : null);
                            const isDemoLeader =
                              !club.confirmedLeadership &&
                              structureMode === 'demo' &&
                              Boolean(club.demoLeadership);
                            const isSelected = selectedClub?.id === club.id;
                            const nestedChildren = group.clubs.filter(
                              (child) => child.parentClub?.id === club.id
                            );

                            return (
                              <div key={club.id} className="space-y-2.5">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => onHighlightClub(club.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      onHighlightClub(club.id);
                                    }
                                  }}
                                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#F4F6FC] border-[#315EF8]'
                                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <CgcClubEmblem code={club.code} size="sm" />
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-bold text-[#101B3A]">
                                            {club.name}
                                          </span>
                                          <span className="text-[11px] font-mono text-slate-400">
                                            {club.code}
                                          </span>
                                          {club.institutionalDistinction && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#101B3A] px-2 py-0.5 rounded">
                                              {club.institutionalDistinction}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-600 mt-0.5">
                                          {club.category}
                                          {club.operationalIdentity
                                            ? ` · ${club.operationalIdentity}`
                                            : ''}
                                        </div>
                                      </div>
                                    </div>
                                    <VerificationTag status={club.verificationStatus} compact />
                                  </div>

                                  {/* Reporting Chain Summary Row */}
                                  <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-slate-500">Authority: </span>
                                      {effectiveLeader?.supervisingAuthority ? (
                                        <span
                                          className={
                                            isDemoLeader
                                              ? 'text-amber-800 font-medium'
                                              : 'text-[#101B3A] font-semibold'
                                          }
                                        >
                                          {effectiveLeader.supervisingAuthority}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic">
                                          Pending verification
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Coordinator: </span>
                                      {effectiveLeader?.coordinatorName ? (
                                        <span
                                          className={
                                            isDemoLeader
                                              ? 'text-amber-800 font-medium'
                                              : 'text-[#101B3A] font-semibold'
                                          }
                                        >
                                          {effectiveLeader.coordinatorName}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic">
                                          Pending verification
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Nested Derived Child Clubs (e.g., DSA └── SAC) */}
                                {nestedChildren.length > 0 && (
                                  <div className="pl-6 border-l-2 border-[#315EF8]/40 space-y-2">
                                    {nestedChildren.map((child) => {
                                      const childSelected = selectedClub?.id === child.id;
                                      return (
                                        <div
                                          key={child.id}
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => onHighlightClub(child.id)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              onHighlightClub(child.id);
                                            }
                                          }}
                                          className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                                            childSelected
                                              ? 'bg-[#F4F6FC] border-[#315EF8]'
                                              : 'bg-slate-50/70 border-slate-200/90 hover:border-slate-300'
                                          }`}
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                              <GitBranch className="w-4 h-4 text-[#315EF8] shrink-0" />
                                              <CgcClubEmblem code={child.code} size="sm" />
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-bold text-[#101B3A]">
                                                    {child.name}
                                                  </span>
                                                  <span className="text-[11px] font-mono text-[#315EF8]">
                                                    {club.code} └── {child.code}
                                                  </span>
                                                </div>
                                                <div className="text-xs text-slate-600">
                                                  {child.fullName} · {child.operationalIdentity}
                                                </div>
                                              </div>
                                            </div>
                                            <VerificationTag status={child.verificationStatus} compact />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Sticky Hierarchy Inspector (4 cols) */}
          <div className="xl:col-span-4 xl:sticky xl:top-20">
            {selectedClub && (
              <ClubInspectorCard
                club={selectedClub}
                structureMode={structureMode}
                onOpenProfile={() => onOpenClubProfile(selectedClub.id)}
              />
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: BLOCK-WISE CLUB ANALYSIS                                       */}
      {/* ===================================================================== */}
      {activeTab === 'block-analysis' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Confirmed University Blocks</div>
              <div className="text-3xl font-bold font-mono tabular-nums text-emerald-700 mt-2">
                {data.verificationCounts.confirmedBlocks}
              </div>
              <div className="text-xs text-slate-500 mt-1.5">
                Block 6 (TechX SOE) &amp; Ramanujan Block – 3
              </div>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Confirmed Full Hierarchies</div>
              <div className="text-3xl font-bold font-mono tabular-nums text-[#315EF8] mt-2">
                {data.verificationCounts.confirmedHierarchies}
              </div>
              <div className="text-xs text-slate-500 mt-1.5">
                ICA Club &amp; VentureNest (E-Cell)
              </div>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Clubs Pending Block Assignment</div>
              <div className="text-3xl font-bold font-mono tabular-nums text-slate-700 mt-2">
                {data.verificationCounts.unverifiedHierarchies}
              </div>
              <div className="text-xs text-slate-500 mt-1.5">
                Never assigned fabricated counts
              </div>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Illustrative / Demo Profiles</div>
              <div className="text-3xl font-bold font-mono tabular-nums text-amber-700 mt-2">
                {data.verificationCounts.demoClubs}
              </div>
              <div className="text-xs text-slate-500 mt-1.5">
                DCC, DRR &amp; NGO awaiting confirmation
              </div>
            </div>
          </div>

          {/* Charts Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Confirmed Block Distribution Chart */}
            <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-xl p-6">
              <div className="mb-4">
                <h3 className="text-base font-bold text-[#101B3A]">
                  Verified Block-Wise Club Allocation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Counts only confirmed block assignments; unverified clubs remain transparently grouped as Pending Verification
                </p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.blockSummary}
                    margin={{ top: 8, right: 16, left: -16, bottom: 12 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="code"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101B3A',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, _name: any, props: any) => [
                        `${val} club(s)`,
                        props.payload.blockName,
                      ]}
                    />
                    <Bar dataKey="clubCount" name="Assigned Clubs" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {data.blockSummary.map((entry) => (
                        <Cell
                          key={entry.code}
                          fill={
                            entry.verificationStatus === 'CONFIRMED' ? '#18B6A0' : '#94A3B8'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Distribution Chart */}
            <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-xl p-6">
              <div className="mb-4">
                <h3 className="text-base font-bold text-[#101B3A]">
                  Operational Category Distribution (11 CGC Clubs)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Breakdown across all-rounder, technology, governance, social media, military, and provisional clubs
                </p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.categoryDistribution}
                    layout="vertical"
                    margin={{ top: 4, right: 18, left: 10, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={136}
                      tick={{ fontSize: 11, fill: '#334155' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101B3A',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" name="Clubs" radius={[0, 5, 5, 0]} barSize={20}>
                      {data.categoryDistribution.map((entry, i) => (
                        <Cell key={entry.category} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Interactive Block Comparison */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#101B3A]">
                  Interactive Block Comparison
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compare verified blocks side-by-side by supervising authority, assigned clubs, and verification completeness
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  aria-label="Select first block to compare"
                  value={compareLeft}
                  onChange={(e) => setCompareLeft(e.target.value)}
                  className="h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg font-medium text-[#101B3A]"
                >
                  {data.blockSummary.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.blockName}
                    </option>
                  ))}
                </select>
                <span className="text-slate-400 font-semibold">vs.</span>
                <select
                  aria-label="Select second block to compare"
                  value={compareRight}
                  onChange={(e) => setCompareRight(e.target.value)}
                  className="h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg font-medium text-[#101B3A]"
                >
                  {data.blockSummary.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.blockName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[blockLeft, blockRight].map((blk, idx) => (
                <div
                  key={`${blk.code}-${idx}`}
                  className="p-5 rounded-xl bg-[#F8FAFC] border border-slate-200/90 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-bold text-[#101B3A]">{blk.blockName}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{blk.schoolName || '—'}</div>
                    </div>
                    <VerificationTag status={blk.verificationStatus} compact />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200/70">
                    <div>
                      <div className="text-slate-500">Supervising Authority</div>
                      <div className="font-semibold text-[#101B3A] mt-0.5">
                        {blk.blockHeadName || 'Pending verification'}
                      </div>
                      {blk.blockHeadDesignation && (
                        <div className="text-[11px] text-slate-500">{blk.blockHeadDesignation}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-slate-500">Assigned Clubs</div>
                      <div className="text-xl font-bold font-mono tabular-nums text-[#315EF8] mt-0.5">
                        {blk.clubCount}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Clubs in Division
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {blk.clubs.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onOpenClubProfile(c.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:border-[#315EF8] text-[#101B3A] rounded-md transition-colors"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CLUB RELATIONSHIP ANALYSIS (INTERACTIVE SVG GRAPH)             */}
      {/* ===================================================================== */}
      {activeTab === 'relationships' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#101B3A]">
                  CGC University Club Relationship Network
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Interactive graph showing confirmed block anchors, the DSA → SAC parent-child derivation, and independent student organisations. Click any club node to inspect.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#315EF8] inline-block" /> Parent → Child (DSA → SAC)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#18B6A0] inline-block" /> Verified Block Anchor
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-slate-400 inline-block" /> Independent / Pending Block
                </span>
              </div>
            </div>

            <ClubRelationshipSvg
              clubs={clubs}
              selectedClubId={selectedClub?.id ?? null}
              onSelectClub={onHighlightClub}
            />
          </div>

          <div className="xl:col-span-4 xl:sticky xl:top-20">
            {selectedClub && (
              <ClubInspectorCard
                club={selectedClub}
                structureMode={structureMode}
                onOpenProfile={() => onOpenClubProfile(selectedClub.id)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// RIGHT-HAND INSPECTOR CARD (USED IN ORG MAP & RELATIONSHIP NETWORK)
// ---------------------------------------------------------------------------
const ClubInspectorCard: React.FC<{
  club: CgcClub;
  structureMode: StructureViewMode;
  onOpenProfile: () => void;
}> = ({ club, structureMode, onOpenProfile }) => {
  const effectiveBlock =
    club.verifiedBlock ?? (structureMode === 'demo' ? club.demoBlock : null);
  const isDemoBlock = !club.verifiedBlock && structureMode === 'demo' && Boolean(club.demoBlock);

  const effectiveLeader =
    club.confirmedLeadership ??
    (structureMode === 'demo' ? club.demoLeadership : null);
  const isDemoLeader =
    !club.confirmedLeadership && structureMode === 'demo' && Boolean(club.demoLeadership);

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-slate-100 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Selected Club Inspector
        </span>
        <VerificationTag status={club.verificationStatus} compact />
      </div>

      {club.institutionalDistinction && (
        <div className="px-5 py-2 bg-[#101B3A] text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-2">
          <Award className="w-3.5 h-3.5 text-[#18B6A0] shrink-0" />
          <span>{club.institutionalDistinction}</span>
        </div>
      )}

      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <CgcClubEmblem code={club.code} />
          <div className="min-w-0">
            <h4 className="text-base font-bold text-[#101B3A]">{club.name}</h4>
            {club.fullName && club.fullName !== club.name && (
              <div className="text-xs text-slate-600 mt-0.5">{club.fullName}</div>
            )}
            <div className="text-xs font-medium text-[#315EF8] mt-1">
              {club.category}
              {club.operationalIdentity ? ` · ${club.operationalIdentity}` : ''}
            </div>
          </div>
        </div>

        {/* Reporting Chain Breakdown */}
        <div className="space-y-2.5 text-xs pt-2 border-t border-slate-100">
          <div>
            <div className="text-[11px] text-slate-500">University Block / School</div>
            {effectiveBlock ? (
              <div className={`font-semibold mt-0.5 ${isDemoBlock ? 'text-amber-800' : 'text-[#101B3A]'}`}>
                {effectiveBlock.blockName}
                {effectiveBlock.schoolName && !isDemoBlock ? ` — ${effectiveBlock.schoolName}` : ''}
              </div>
            ) : (
              <div className="text-slate-500 italic mt-0.5">{AWAITING_TEXT}</div>
            )}
          </div>

          <div>
            <div className="text-[11px] text-slate-500">Supervising Authority</div>
            {effectiveLeader?.supervisingAuthority ? (
              <div className={`font-semibold mt-0.5 ${isDemoLeader ? 'text-amber-800' : 'text-[#101B3A]'}`}>
                {effectiveLeader.supervisingAuthority}
                {effectiveLeader.authorityDesignation ? (
                  <span className="font-normal text-slate-600">
                    {' '}
                    ({effectiveLeader.authorityDesignation})
                  </span>
                ) : (
                  <span className="font-normal text-slate-500 italic">
                    {' '}
                    (Designation pending verification)
                  </span>
                )}
              </div>
            ) : (
              <div className="text-slate-500 italic mt-0.5">{AWAITING_TEXT}</div>
            )}
          </div>

          <div>
            <div className="text-[11px] text-slate-500">Club Coordinator / Manager</div>
            {effectiveLeader?.coordinatorName ? (
              <div className={`font-semibold mt-0.5 ${isDemoLeader ? 'text-amber-800' : 'text-[#101B3A]'}`}>
                {effectiveLeader.coordinatorName}
              </div>
            ) : (
              <div className="text-slate-500 italic mt-0.5">{AWAITING_TEXT}</div>
            )}
          </div>

          {club.parentClub && (
            <div className="p-2.5 rounded-lg bg-[#F4F6FC] border border-slate-200/80 flex items-center gap-2 text-[#101B3A] font-semibold">
              <GitBranch className="w-3.5 h-3.5 text-[#315EF8] shrink-0" />
              <span>
                Derived from {club.parentClub.name} ({club.parentClub.code} └── {club.code})
              </span>
            </div>
          )}

          {club.operationalScope && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] text-slate-500 mb-1">Operational Scope</div>
              <p className="text-slate-600 leading-relaxed">{club.operationalScope}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full h-9 px-4 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          Open Full Club Profile
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// INTERACTIVE CLICKABLE SVG CLUB RELATIONSHIP GRAPH
// ---------------------------------------------------------------------------
const ClubRelationshipSvg: React.FC<{
  clubs: CgcClub[];
  selectedClubId: number | null;
  onSelectClub: (id: number) => void;
}> = ({ clubs, selectedClubId, onSelectClub }) => {
  const byCode = useMemo(() => new Map(clubs.map((c) => [c.code, c])), [clubs]);

  const nodeCoords: Record<string, { x: number; y: number; sub: string }> = {
    DSA: { x: 145, y: 210, sub: 'University Biggest' },
    SAC: { x: 145, y: 345, sub: 'Derived · Discipline' },
    ICA: { x: 350, y: 295, sub: 'Block 6 · TechX SOE' },
    VNEST: { x: 560, y: 295, sub: 'Ramanujan Block – 3' },
    CSM: { x: 755, y: 175, sub: 'Social Media Only' },
    D4C: { x: 755, y: 255, sub: 'Largest/Oldest Tech' },
    ICTSE: { x: 755, y: 335, sub: 'Technology Club' },
    NCC: { x: 330, y: 445, sub: 'Military Training' },
    DCC: { x: 505, y: 445, sub: 'Illustrative Profile' },
    DRR: { x: 645, y: 445, sub: 'Illustrative Profile' },
    NGO: { x: 785, y: 445, sub: 'Provisional Demo' },
  };

  return (
    <div className="w-full overflow-x-auto border border-slate-200/80 rounded-xl bg-[#F8FAFC] p-2">
      <svg
        viewBox="0 0 900 505"
        className="w-full min-w-[680px] h-auto select-none"
        role="img"
        aria-label="CGC University Club Relationship Network Diagram"
      >
        <defs>
          <marker
            id="arrowBlue"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#315EF8" />
          </marker>
        </defs>

        {/* Root Node: CGC University */}
        <g>
          {/* Edges from CGC Root */}
          <line x1="450" y1="74" x2="145" y2="178" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1="450" y1="74" x2="350" y2="152" stroke="#18B6A0" strokeWidth="2.2" />
          <line x1="450" y1="74" x2="560" y2="152" stroke="#18B6A0" strokeWidth="2.2" />
          <line x1="450" y1="74" x2="755" y2="145" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1="450" y1="74" x2="330" y2="413" stroke="#CBD5E1" strokeWidth="1.4" strokeDasharray="4 4" />
          <line x1="450" y1="74" x2="645" y2="413" stroke="#CBD5E1" strokeWidth="1.4" strokeDasharray="4 4" />

          {/* Verified Block Hubs -> Clubs */}
          <line x1="350" y1="204" x2="350" y2="262" stroke="#18B6A0" strokeWidth="2.4" />
          <line x1="560" y1="204" x2="560" y2="262" stroke="#18B6A0" strokeWidth="2.4" />

          {/* Parent -> Child (DSA -> SAC) */}
          <line
            x1="145"
            y1="244"
            x2="145"
            y2="309"
            stroke="#315EF8"
            strokeWidth="2.6"
            markerEnd="url(#arrowBlue)"
          />
          <rect x="76" y="264" width="138" height="22" rx="4" fill="#EEF2FF" stroke="#315EF8" strokeWidth="1" />
          <text x="145" y="279" textAnchor="middle" fill="#1E3A8A" fontSize="10" fontWeight="700">
            Derived: DSA └── SAC
          </text>

          {/* CGC Root Pill Box */}
          <rect x="330" y="20" width="240" height="54" rx="10" fill="#101B3A" />
          <text x="450" y="44" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="700">
            CGC University
          </text>
          <text x="450" y="61" textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="500">
            Multi-Block Independent Club Ecosystem
          </text>

          {/* Confirmed Block Hub: Block 6 */}
          <rect x="260" y="152" width="180" height="52" rx="8" fill="#ECFDF5" stroke="#18B6A0" strokeWidth="1.6" />
          <text x="350" y="173" textAnchor="middle" fill="#065F46" fontSize="11" fontWeight="700">
            Block 6 · TechX SOE
          </text>
          <text x="350" y="191" textAnchor="middle" fill="#047857" fontSize="9.5">
            Dr. Sugandhi Malhotra (Assoc. Dean)
          </text>

          {/* Confirmed Block Hub: Ramanujan Block - 3 */}
          <rect x="470" y="152" width="180" height="52" rx="8" fill="#ECFDF5" stroke="#18B6A0" strokeWidth="1.6" />
          <text x="560" y="173" textAnchor="middle" fill="#065F46" fontSize="11" fontWeight="700">
            Ramanujan Block – 3
          </text>
          <text x="560" y="191" textAnchor="middle" fill="#047857" fontSize="9.5">
            Dr. Ati Priye (Verified Authority)
          </text>
        </g>

        {/* Club Nodes */}
        {Object.entries(nodeCoords).map(([code, pos]) => {
          const club = byCode.get(code);
          if (!club) return null;
          const isSelected = selectedClubId === club.id;
          const isDemo = club.verificationStatus === 'DEMO';
          const isConfirmed = club.verificationStatus === 'CONFIRMED';

          const stroke = isSelected
            ? '#315EF8'
            : isConfirmed
            ? '#18B6A0'
            : isDemo
            ? '#D97706'
            : '#94A3B8';
          const fill = isSelected ? '#EEF2FF' : '#FFFFFF';
          const width = code === 'DCC' || code === 'DRR' || code === 'NGO' ? 122 : 168;

          return (
            <g
              key={club.id}
              onClick={() => onSelectClub(club.id)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={pos.x - width / 2}
                y={pos.y - 30}
                width={width}
                height="60"
                rx="10"
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected ? 2.6 : 1.6}
              />
              <text
                x={pos.x}
                y={pos.y - 5}
                textAnchor="middle"
                fill="#101B3A"
                fontSize="12"
                fontWeight="700"
              >
                {club.name.length > 20 ? `${club.name.slice(0, 18)}…` : club.name}
              </text>
              <text
                x={pos.x}
                y={pos.y + 13}
                textAnchor="middle"
                fill={isDemo ? '#B45309' : '#64748B'}
                fontSize="9.5"
                fontWeight="600"
              >
                {pos.sub}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 text-[#315EF8] shrink-0" />
        <span>
          Only institutionally confirmed block links (Block 6 → ICA Club; Ramanujan Block – 3 →
          VentureNest) and confirmed derivations (DSA → SAC) are drawn as solid structural links.
        </span>
      </div>
    </div>
  );
};
