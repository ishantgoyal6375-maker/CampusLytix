import React, { useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  ExternalLink,
  X,
} from 'lucide-react';
import type { ClubEvent, DashboardAnalytics, UserProfile } from '../types';
import { apiFetch } from '../lib/api';
import { getCachedWorkspaceToken, getGrantedScopeGroups } from '../lib/firebase';
import { GoogleServiceIcon } from './GoogleIcons';

interface EventAnalyticsViewProps {
  analytics: DashboardAnalytics;
  user: UserProfile | null;
  onRefreshAnalytics: () => Promise<void>;
  onConnectCalendar: (mode: 'calendarRead' | 'calendarWrite') => Promise<boolean>;
}

interface GoogleCalendarCandidate {
  googleEventId: string;
  title: string;
  description: string;
  location: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  htmlLink: string | null;
  alreadyImported: boolean;
}

export const EventAnalyticsView: React.FC<EventAnalyticsViewProps> = ({
  analytics,
  user,
  onRefreshAnalytics,
  onConnectCalendar,
}) => {
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [clubAssignments, setClubAssignments] = useState<Record<string, number>>({});
  const [loadingCal, setLoadingCal] = useState(false);
  const [importingCal, setImportingCal] = useState(false);
  const [confirmPushEvent, setConfirmPushEvent] = useState<ClubEvent | null>(null);
  const [pushingEvent, setPushingEvent] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    clubId: String(analytics.clubRankings[0]?.id ?? ''),
    title: '',
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: '14:00',
    endTime: '16:00',
    location: 'Main Auditorium',
    capacity: '80',
    description: '',
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const handleLoadGoogleCalendar = async () => {
    setFeedback(null);
    if (!user) {
      setFeedback({ type: 'error', text: 'Sign in with Google first to connect Google Calendar.' });
      return;
    }
    setLoadingCal(true);
    try {
      const hasToken = Boolean(getCachedWorkspaceToken());
      const groups = getGrantedScopeGroups();
      if (!hasToken || (!groups.includes('calendarRead') && !groups.includes('calendarWrite'))) {
        const ok = await onConnectCalendar('calendarRead');
        if (!ok) return;
      }
      const data = await apiFetch<{ events: GoogleCalendarCandidate[] }>(
        '/api/google/calendar/events',
        { includeGoogleToken: true }
      );
      setCalendarEvents(data.events ?? []);
      const defaultClubId = analytics.clubRankings[0]?.id ?? 1;
      const defaults: Record<string, number> = {};
      (data.events ?? []).forEach((ev) => {
        defaults[ev.googleEventId] = defaultClubId;
      });
      setClubAssignments(defaults);
      setSelectedIds({});
      setFeedback({
        type: 'success',
        text: `Loaded ${(data.events ?? []).length} event(s) from Google Calendar (read-only mode).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Unable to load Google Calendar events.' });
    } finally {
      setLoadingCal(false);
    }
  };

  const handleImportSelectedCalendar = async () => {
    setFeedback(null);
    if (!isAdmin) {
      setFeedback({ type: 'error', text: 'Administrator privileges are required to import events.' });
      return;
    }
    const chosen = calendarEvents.filter(
      (ev) => selectedIds[ev.googleEventId] && !ev.alreadyImported
    );
    if (chosen.length === 0) {
      setFeedback({ type: 'error', text: 'Select at least one non-imported calendar event.' });
      return;
    }

    setImportingCal(true);
    try {
      const res = await apiFetch<{ imported: number; skipped: number }>(
        '/api/google/calendar/import',
        {
          method: 'POST',
          body: JSON.stringify({
            items: chosen.map((ev) => ({
              ...ev,
              clubId: clubAssignments[ev.googleEventId] || analytics.clubRankings[0]?.id,
            })),
          }),
        }
      );
      setFeedback({
        type: 'success',
        text: `Imported ${res.imported} calendar event(s) into CampusLytix (${res.skipped} duplicate/skipped).`,
      });
      await onRefreshAnalytics();
      // Refresh calendar list flags
      await handleLoadGoogleCalendar();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Calendar import failed.' });
    } finally {
      setImportingCal(false);
    }
  };

  const handleConfirmAddToGoogleCalendar = async () => {
    if (!confirmPushEvent) return;
    setFeedback(null);
    setPushingEvent(true);
    try {
      const groups = getGrantedScopeGroups();
      if (!getCachedWorkspaceToken() || !groups.includes('calendarWrite')) {
        const ok = await onConnectCalendar('calendarWrite');
        if (!ok) return;
      }

      await apiFetch('/api/google/calendar/export', {
        method: 'POST',
        includeGoogleToken: true,
        body: JSON.stringify({
          eventId: confirmPushEvent.id,
          confirmed: true,
        }),
      });
      setFeedback({
        type: 'success',
        text: `Added "${confirmPushEvent.title}" to Google Calendar.`,
      });
      setConfirmPushEvent(null);
      await onRefreshAnalytics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to add event to Google Calendar.' });
    } finally {
      setPushingEvent(false);
    }
  };

  const handleCreateClubEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify(newEvent),
      });
      setShowCreateModal(false);
      setNewEvent({
        ...newEvent,
        title: '',
        description: '',
      });
      setFeedback({ type: 'success', text: 'Created new club event in PostgreSQL.' });
      await onRefreshAnalytics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create event.' });
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 border text-sm flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Google Calendar Integration Panel */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <GoogleServiceIcon service="google_calendar" className="w-8 h-8 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-[#101B3A]">Google Calendar Synchronization</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Start with read-only access to inspect upcoming events, map them to CampusLytix clubs, and prevent duplicates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={loadingCal}
              onClick={handleLoadGoogleCalendar}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-60 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCal ? 'animate-spin' : ''}`} />
              {loadingCal ? 'Loading Calendar...' : 'Fetch Calendar Events (Read-Only)'}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="h-9 px-3.5 text-xs font-semibold text-[#101B3A] bg-[#F4F6FC] hover:bg-slate-200/70 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                New Club Event
              </button>
            )}
          </div>
        </div>

        {calendarEvents.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="text-xs font-medium text-slate-600">
                Select events to import and link each event to an institutional club
              </div>
              <button
                type="button"
                disabled={importingCal || !isAdmin}
                onClick={handleImportSelectedCalendar}
                className="h-8 px-3.5 text-xs font-semibold text-white bg-[#18B6A0] hover:bg-[#139986] disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0"
              >
                {importingCal ? 'Importing...' : 'Import Selected into CampusLytix'}
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 px-3 w-10">Pick</th>
                    <th className="py-2.5 px-3">Calendar Event</th>
                    <th className="py-2.5 px-3">Date &amp; Time</th>
                    <th className="py-2.5 px-3">Link to Club</th>
                    <th className="py-2.5 px-3 text-right">Sync Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calendarEvents.map((ev) => (
                    <tr key={ev.googleEventId} className="hover:bg-[#F8FAFF]">
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          disabled={ev.alreadyImported}
                          checked={Boolean(selectedIds[ev.googleEventId])}
                          onChange={(e) =>
                            setSelectedIds({
                              ...selectedIds,
                              [ev.googleEventId]: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#101B3A]">{ev.title}</div>
                        <div className="text-slate-500">{ev.location}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                        {ev.eventDate} · {ev.startTime}–{ev.endTime}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          disabled={ev.alreadyImported}
                          value={clubAssignments[ev.googleEventId] ?? ''}
                          onChange={(e) =>
                            setClubAssignments({
                              ...clubAssignments,
                              [ev.googleEventId]: Number(e.target.value),
                            })
                          }
                          className="h-8 px-2 bg-[#F4F6FC] border border-slate-200 rounded text-xs text-[#101B3A]"
                        >
                          {analytics.clubRankings.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">
                        {ev.alreadyImported ? (
                          <span className="text-[#18B6A0]">Already Imported</span>
                        ) : (
                          <span className="text-slate-500">Ready to Import</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Institutional Event Schedule & Attendance Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#101B3A]">Club Event Schedule &amp; Attendance</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All verified institutional club events stored in PostgreSQL
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {analytics.eventsList.length} Events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-slate-200/80 text-xs font-semibold text-slate-500">
                <th className="py-3 px-6">Event Title</th>
                <th className="py-3 px-4">Club</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-right">Attendance</th>
                <th className="py-3 px-6 text-right">Google Calendar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.eventsList.map((ev) => (
                <tr key={ev.id} className="hover:bg-[#F8FAFF] transition-colors">
                  <td className="py-3.5 px-6">
                    <div className="font-semibold text-[#101B3A]">{ev.title}</div>
                    <div className="text-xs text-slate-500">Source: {ev.source}</div>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-[#315EF8]">
                    {ev.clubName}
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700">
                    {ev.eventDate} · {ev.startTime || '14:00'}–{ev.endTime || '16:00'}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">{ev.location || 'Campus'}</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                    {ev.attendanceRate !== null ? (
                      <div>
                        <span className="font-semibold text-[#101B3A]">{ev.presentCount}</span>
                        <span className="text-slate-400"> / cap {ev.capacity}</span>
                        <div className="text-[11px] text-[#18B6A0]">{ev.attendanceRate}% present</div>
                      </div>
                    ) : (
                      <span className="text-[#7657E8] font-medium">
                        {ev.registeredCount} registered
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    {ev.googleCalendarEventId ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#18B6A0]">
                        <Calendar className="w-3.5 h-3.5" />
                        Synced
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setConfirmPushEvent(ev)}
                        title={
                          isAdmin
                            ? 'Add this CampusLytix event to Google Calendar'
                            : 'Administrator sign-in required'
                        }
                        className="h-8 px-3 text-xs font-semibold text-[#101B3A] bg-[#F4F6FC] hover:bg-[#315EF8] hover:text-white disabled:opacity-45 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Add to Calendar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explicit Confirmation Modal for Adding Event to Google Calendar */}
      {confirmPushEvent && (
        <div className="fixed inset-0 z-50 bg-[#101B3A]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <GoogleServiceIcon service="google_calendar" className="w-6 h-6" />
                <h3 className="text-base font-bold text-[#101B3A]">
                  Confirm Google Calendar Creation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmPushEvent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              This action will create a new event on your connected Google Calendar. Review the details below before confirming:
            </p>

            <div className="mt-4 p-4 bg-[#F4F6FC] rounded-lg space-y-1.5 text-xs">
              <div className="font-semibold text-[#101B3A] text-sm">{confirmPushEvent.title}</div>
              <div className="text-slate-600">Club: {confirmPushEvent.clubName}</div>
              <div className="font-mono tabular-nums text-slate-600">
                Date: {confirmPushEvent.eventDate} ({confirmPushEvent.startTime || '14:00'}–{confirmPushEvent.endTime || '16:00'} UTC)
              </div>
              <div className="text-slate-600">Location: {confirmPushEvent.location || 'Campus'}</div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmPushEvent(null)}
                className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pushingEvent}
                onClick={handleConfirmAddToGoogleCalendar}
                className="h-9 px-4 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-60 rounded-lg inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {pushingEvent ? 'Adding to Calendar...' : 'Confirm & Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Club Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#101B3A]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#101B3A]">Create Institutional Club Event</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClubEvent} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Host Club</label>
                <select
                  required
                  value={newEvent.clubId}
                  onChange={(e) => setNewEvent({ ...newEvent, clubId: e.target.value })}
                  className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-sm"
                >
                  {analytics.clubRankings.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Event Title</label>
                <input
                  required
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g. Spring Cloud Workshop"
                  className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    required
                    type="date"
                    value={newEvent.eventDate}
                    onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
                    className="w-full h-9 px-2.5 bg-[#F4F6FC] border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start</label>
                  <input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    className="w-full h-9 px-2.5 bg-[#F4F6FC] border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End</label>
                  <input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    className="w-full h-9 px-2.5 bg-[#F4F6FC] border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Capacity</label>
                  <input
                    type="number"
                    min={10}
                    value={newEvent.capacity}
                    onChange={(e) => setNewEvent({ ...newEvent, capacity: e.target.value })}
                    className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] rounded-lg"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
