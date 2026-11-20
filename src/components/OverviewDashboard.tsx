import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Filter, RotateCcw, ArrowRight, Building2, Network, FlaskConical } from 'lucide-react';
import type { DashboardAnalytics, NavSection } from '../types';
import { downloadTextFile, toCsvString } from '../lib/api';
import { trackAppUsage } from '../lib/analytics';

interface OverviewDashboardProps {
  analytics: DashboardAnalytics;
  filters: { department: string; category: string; month: string };
  onFilterChange: (next: { department: string; category: string; month: string }) => void;
  onNavigate: (section: NavSection) => void;
}

const BAR_COLORS = ['#315EF8', '#7657E8', '#18B6A0', '#4F77FF', '#8F72F2', '#2BC7B2', '#5C6E9B', '#7C8DB5'];

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  analytics,
  filters,
  onFilterChange,
  onNavigate,
}) => {
  const { kpis, clubRankings, departmentAnalytics, monthlyTrends, filterOptions } = analytics;
  const hasActiveFilters =
    filters.department !== 'All' || filters.category !== 'All' || filters.month !== 'All';

  const handleExportOverviewCsv = () => {
    const csv = toCsvString(
      ['Club Code', 'Club Name', 'Category', 'Department', 'Members', 'Events', 'Total Check-Ins', 'Attendance Rate (%)'],
      clubRankings.map((c) => [
        c.code,
        c.name,
        c.category,
        c.department,
        c.memberCount,
        c.eventCount,
        c.totalCheckIns,
        c.attendanceRate,
      ])
    );
    downloadTextFile(`campuslytix_overview_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    trackAppUsage('report_download', { format: 'csv', report: 'overview' });
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 pr-1">
            <Filter className="w-3.5 h-3.5 text-[#315EF8]" />
            <span>Slice Analytics</span>
          </div>

          <select
            aria-label="Filter by Department"
            value={filters.department}
            onChange={(e) => onFilterChange({ ...filters, department: e.target.value })}
            className="h-9 px-3 text-sm bg-[#F4F6FC] border border-slate-200 rounded-lg text-[#101B3A] focus:outline-none focus:border-[#315EF8]"
          >
            <option value="All">All Departments</option>
            {filterOptions.departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            aria-label="Filter by Club Category"
            value={filters.category}
            onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
            className="h-9 px-3 text-sm bg-[#F4F6FC] border border-slate-200 rounded-lg text-[#101B3A] focus:outline-none focus:border-[#315EF8]"
          >
            <option value="All">All Categories</option>
            {filterOptions.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            aria-label="Filter by Month"
            value={filters.month}
            onChange={(e) => onFilterChange({ ...filters, month: e.target.value })}
            className="h-9 px-3 text-sm bg-[#F4F6FC] border border-slate-200 rounded-lg text-[#101B3A] focus:outline-none focus:border-[#315EF8]"
          >
            <option value="All">All Months</option>
            {filterOptions.months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => onFilterChange({ department: 'All', category: 'All', month: 'All' })}
              className="h-9 px-3 text-xs font-medium text-slate-600 hover:text-[#101B3A] flex items-center gap-1.5 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportOverviewCsv}
            className="h-9 px-3.5 text-xs font-semibold text-[#101B3A] bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ai')}
            className="h-9 px-3.5 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            Ask CampusLytix AI
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4-Column Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Student Engagement Rate</div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-[#101B3A] font-mono tabular-nums">
              {kpis.engagementRate}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {kpis.engagedStudents} engaged · {kpis.totalStudents} total students
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Active Club Memberships</div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-[#315EF8] font-mono tabular-nums">
              {kpis.totalMemberships}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            Across {kpis.activeClubs} tracked clubs ({kpis.cgcDirectoryClubCount ?? 11} CGC directory)
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Avg Event Attendance Rate</div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-[#18B6A0] font-mono tabular-nums">
              {kpis.avgAttendanceRate}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {kpis.totalCheckIns} verified check-ins
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Institutional Club Events</div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-[#7657E8] font-mono tabular-nums">
              {kpis.totalEvents}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            Tracked in PostgreSQL ledger
          </div>
        </div>
      </div>

      {/* CGC University Structure Quick Access & Synthetic Metrics Notice */}
      <div className="bg-white border border-slate-200/90 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="px-2 py-0.5 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 mt-0.5">
            <FlaskConical className="w-3 h-3" />
            DEMO DATA
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Calculated membership and attendance figures below reflect recorded PostgreSQL sample rosters and are kept strictly separate from CGC University institutional distinctions (such as DSA&apos;s University&apos;s Biggest Club and D4-Community&apos;s Largest &amp; Oldest Tech Club).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('directory')}
            className="h-8 px-3 text-xs font-semibold text-[#101B3A] bg-[#F4F6FC] hover:bg-slate-200/70 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Building2 className="w-3.5 h-3.5 text-[#315EF8]" />
            CGC Directory ({kpis.cgcDirectoryClubCount ?? 11})
          </button>
          <button
            type="button"
            onClick={() => onNavigate('structure')}
            className="h-8 px-3 text-xs font-semibold text-[#101B3A] bg-[#F4F6FC] hover:bg-slate-200/70 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Network className="w-3.5 h-3.5 text-[#7657E8]" />
            Org Map
          </button>
        </div>
      </div>

      {/* Primary Charts Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Participation Trends */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-bold text-[#101B3A]">Monthly Participation Trends</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified event check-ins compared against unique active participants and new sign-ups
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#315EF8]" />
                Check-Ins
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#18B6A0]" />
                Unique Students
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrends} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="checkInsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#315EF8" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#315EF8" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="uniqueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18B6A0" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#18B6A0" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748B' }}
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
                <Area
                  type="monotone"
                  dataKey="checkIns"
                  name="Event Check-Ins"
                  stroke="#315EF8"
                  strokeWidth={2.2}
                  fill="url(#checkInsFill)"
                />
                <Area
                  type="monotone"
                  dataKey="uniqueParticipants"
                  name="Unique Participants"
                  stroke="#18B6A0"
                  strokeWidth={2.2}
                  fill="url(#uniqueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Club Popularity Rankings */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-bold text-[#101B3A]">Club Popularity Rankings</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Active registered members by student organization
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('clubs')}
              className="text-xs font-semibold text-[#315EF8] hover:underline whitespace-nowrap shrink-0"
            >
              Full Breakdown
            </button>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={clubRankings}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={132}
                  tick={{ fontSize: 11, fill: '#334155' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F4F6FC' }}
                  contentStyle={{
                    backgroundColor: '#101B3A',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="memberCount" name="Members" radius={[0, 4, 4, 0]} barSize={18}>
                  {clubRankings.map((entry, idx) => (
                    <Cell key={entry.id} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Department Engagement Breakdown Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#101B3A]">Department Engagement Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Participation rate, active club memberships, and event check-ins by academic department
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {departmentAnalytics.length} Departments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-500">
                <th className="py-3 px-6">Department</th>
                <th className="py-3 px-4 text-right">Students</th>
                <th className="py-3 px-4 text-right">Engaged</th>
                <th className="py-3 px-4 w-52">Engagement Rate</th>
                <th className="py-3 px-4 text-right">Memberships</th>
                <th className="py-3 px-4 text-right">Check-Ins</th>
                <th className="py-3 px-6">Leading Club</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departmentAnalytics.map((dept) => (
                <tr key={dept.department} className="hover:bg-[#F8FAFF] transition-colors">
                  <td className="py-3.5 px-6 font-medium text-[#101B3A]">{dept.department}</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                    {dept.totalStudents}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                    {dept.engagedStudents}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#315EF8]"
                          style={{ width: `${Math.min(100, dept.engagementRate)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums font-semibold text-[#101B3A] w-11 text-right">
                        {dept.engagementRate}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {dept.totalMemberships}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {dept.totalAttendances}
                  </td>
                  <td className="py-3.5 px-6 text-slate-600">{dept.topClub}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
