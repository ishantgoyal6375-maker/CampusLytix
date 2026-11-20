import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Search, FileSpreadsheet, HardDrive, CheckCircle2, AlertCircle, Award, FlaskConical } from 'lucide-react';
import type { DashboardAnalytics, UserProfile } from '../types';
import { apiFetch, downloadTextFile, toCsvString } from '../lib/api';
import { getCachedWorkspaceToken } from '../lib/firebase';
import { trackAppUsage } from '../lib/analytics';

interface ClubAnalyticsViewProps {
  analytics: DashboardAnalytics;
  user: UserProfile | null;
  onRequireWorkspaceConnect: (service: 'sheets' | 'drive') => Promise<boolean>;
  onOpenCgcClub?: (clubId: number) => void;
}

export const ClubAnalyticsView: React.FC<ClubAnalyticsViewProps> = ({
  analytics,
  user,
  onRequireWorkspaceConnect,
  onOpenCgcClub,
}) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'memberCount' | 'attendanceRate' | 'totalCheckIns'>('memberCount');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string; url?: string } | null>(null);

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return analytics.clubRankings
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q)
      )
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [analytics.clubRankings, search, sortBy]);

  const handleExportCsv = () => {
    const csv = toCsvString(
      ['Code', 'Club Name', 'Category', 'Department', 'Advisor', 'Members', 'Unique Attendees', 'Events', 'Check-Ins', 'Attendance Rate (%)'],
      filteredClubs.map((c) => [
        c.code,
        c.name,
        c.category,
        c.department,
        c.facultyAdvisor ?? '',
        c.memberCount,
        c.uniqueAttendees,
        c.eventCount,
        c.totalCheckIns,
        c.attendanceRate,
      ])
    );
    downloadTextFile(`campuslytix_club_analytics_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    trackAppUsage('report_download', { format: 'csv', report: 'club_analytics' });
  };

  const handleExportToSheets = async () => {
    setFeedback(null);
    if (!user || user.role !== 'ADMIN') {
      setFeedback({ type: 'error', text: 'Sign in as an Administrator to export reports to Google Sheets.' });
      return;
    }
    setBusyAction('sheets');
    try {
      if (!getCachedWorkspaceToken()) {
        const ok = await onRequireWorkspaceConnect('sheets');
        if (!ok) return;
      }
      const res = await apiFetch('/api/google/sheets/export', {
        method: 'POST',
        includeGoogleToken: true,
        body: JSON.stringify({ reportType: 'clubs' }),
      });
      setFeedback({
        type: 'success',
        text: `Exported "${res.title}" (${res.rowCount} clubs) to Google Sheets.`,
        url: res.spreadsheetUrl,
      });
      trackAppUsage('report_download', { format: 'google_sheets', report: 'club_analytics' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Google Sheets export failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchiveToDrive = async () => {
    setFeedback(null);
    if (!user || user.role !== 'ADMIN') {
      setFeedback({ type: 'error', text: 'Sign in as an Administrator to archive reports to Google Drive.' });
      return;
    }
    setBusyAction('drive');
    try {
      if (!getCachedWorkspaceToken()) {
        const ok = await onRequireWorkspaceConnect('drive');
        if (!ok) return;
      }
      const csv = toCsvString(
        ['Code', 'Club Name', 'Category', 'Department', 'Members', 'Unique Attendees', 'Attendance Rate (%)'],
        filteredClubs.map((c) => [
          c.code,
          c.name,
          c.category,
          c.department,
          c.memberCount,
          c.uniqueAttendees,
          c.attendanceRate,
        ])
      );
      const fileName = `Club_Analytics_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      const res = await apiFetch('/api/google/drive/upload-report', {
        method: 'POST',
        includeGoogleToken: true,
        body: JSON.stringify({
          fileName,
          mimeType: 'text/csv',
          content: csv,
          subfolder: 'Club Analytics',
        }),
      });
      setFeedback({
        type: 'success',
        text: `Archived "${fileName}" to ${res.folder} in Google Drive.`,
        url: res.file?.webViewLink,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Drive archive upload failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 border text-sm flex items-center justify-between gap-4 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          {feedback.url && (
            <a
              href={feedback.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-[#315EF8] hover:underline whitespace-nowrap shrink-0"
            >
              Open in Google
            </a>
          )}
        </div>
      )}

      {/* Membership vs Actual Attendance Comparison */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#101B3A]">
                Membership vs. Actual Event Attendance
              </h2>
              {analytics.kpis.hasSyntheticData && (
                <span className="px-2 py-0.5 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-bold inline-flex items-center gap-1">
                  <FlaskConical className="w-3 h-3" />
                  DEMO DATA
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Compares recorded PostgreSQL club roster counts against unique students who attended events (kept separate from institutional distinctions)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="h-9 px-3 text-xs font-semibold text-[#101B3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleExportToSheets}
              className="h-9 px-3 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-60 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {busyAction === 'sheets' ? 'Exporting...' : 'Export to Sheets'}
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleArchiveToDrive}
              className="h-9 px-3 text-xs font-semibold text-[#101B3A] bg-[#F4F6FC] hover:bg-slate-200/70 disabled:opacity-60 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <HardDrive className="w-3.5 h-3.5 text-[#7657E8]" />
              {busyAction === 'drive' ? 'Archiving...' : 'Save to Drive'}
            </button>
          </div>
        </div>

        <div className="h-76 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredClubs} margin={{ top: 8, right: 16, left: -12, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="code"
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#101B3A',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Bar dataKey="memberCount" name="Registered Members" fill="#315EF8" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="uniqueAttendees" name="Unique Event Attendees" fill="#18B6A0" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="avgEventTurnout" name="Avg Turnout / Event" fill="#7657E8" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Club Directory & Performance Matrix */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clubs, categories, or departments..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-[#F4F6FC] border border-slate-200 rounded-lg focus:outline-none focus:border-[#315EF8]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F4F6FC] rounded-lg">
            {([
              ['memberCount', 'By Members'],
              ['attendanceRate', 'By Attendance %'],
              ['totalCheckIns', 'By Check-Ins'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  sortBy === key
                    ? 'bg-white text-[#101B3A] shadow-xs'
                    : 'text-slate-600 hover:text-[#101B3A]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-500">
                <th className="py-3 px-6">Club</th>
                <th className="py-3 px-4">Category · Verified Block</th>
                <th className="py-3 px-4">Institutional Distinction</th>
                <th className="py-3 px-4 text-right">Members (DB)</th>
                <th className="py-3 px-4 text-right">Events</th>
                <th className="py-3 px-4 text-right">Check-Ins</th>
                <th className="py-3 px-6 text-right">Attendance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClubs.map((club) => (
                <tr key={club.id} className="hover:bg-[#F8FAFF] transition-colors">
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-2">
                      {club.isCgcDirectory && onOpenCgcClub ? (
                        <button
                          type="button"
                          onClick={() => onOpenCgcClub(club.id)}
                          className="font-semibold text-[#101B3A] hover:text-[#315EF8] text-left"
                        >
                          {club.name}
                        </button>
                      ) : (
                        <span className="font-semibold text-[#101B3A]">{club.name}</span>
                      )}
                      {club.isCgcDirectory && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#315EF8] font-semibold">
                          CGC
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-400">{club.code}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-xs">
                    <div>{club.category}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {club.verifiedBlockName || club.department}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    {club.institutionalDistinction ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#101B3A]">
                        <Award className="w-3.5 h-3.5 text-[#18B6A0] shrink-0" />
                        {club.institutionalDistinction}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#101B3A]">
                    {club.memberCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                    {club.eventCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {club.totalCheckIns}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        club.attendanceRate >= 80
                          ? 'text-[#18B6A0]'
                          : club.attendanceRate >= 65
                          ? 'text-[#315EF8]'
                          : 'text-amber-600'
                      }`}
                    >
                      {club.attendanceRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
