import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderPlus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  DashboardAnalytics,
  StoredFileRecord,
  UserProfile,
  ValidationResult,
} from '../types';
import { apiFetch, parseCsvText, toCsvString } from '../lib/api';
import { getCachedWorkspaceToken, getGrantedScopeGroups, type WorkspaceScopeGroup } from '../lib/firebase';
import { GoogleServiceIcon } from './GoogleIcons';
import { trackAppUsage } from '../lib/analytics';

interface DataManagementViewProps {
  analytics: DashboardAnalytics;
  user: UserProfile | null;
  onRefreshAnalytics: () => Promise<void>;
  onConnectWorkspace: (groups: WorkspaceScopeGroup[]) => Promise<boolean>;
}

type DataTab = 'sheets' | 'drive' | 'forms' | 'archive' | 'history';
type TargetEntity = 'students' | 'clubs' | 'memberships' | 'events';

const ENTITY_FIELDS: Record<TargetEntity, Array<{ key: string; label: string; required?: boolean }>> = {
  students: [
    { key: 'fullName', label: 'Full Name', required: true },
    { key: 'email', label: 'Student Email', required: true },
    { key: 'department', label: 'Department' },
    { key: 'studentCode', label: 'Student ID / Code' },
    { key: 'academicYear', label: 'Academic Year (1-4)' },
    { key: 'clubName', label: 'Preferred Club (Optional)' },
  ],
  clubs: [
    { key: 'name', label: 'Club Name', required: true },
    { key: 'code', label: 'Club Code' },
    { key: 'category', label: 'Category' },
    { key: 'department', label: 'Department' },
    { key: 'facultyAdvisor', label: 'Faculty Advisor' },
    { key: 'description', label: 'Description' },
  ],
  memberships: [
    { key: 'email', label: 'Student Email', required: true },
    { key: 'clubName', label: 'Club Name or Code', required: true },
    { key: 'fullName', label: 'Student Full Name' },
    { key: 'department', label: 'Department' },
    { key: 'role', label: 'Member Role' },
    { key: 'joinedAt', label: 'Joined Date (YYYY-MM-DD)' },
  ],
  events: [
    { key: 'title', label: 'Event Title', required: true },
    { key: 'eventDate', label: 'Event Date (YYYY-MM-DD)', required: true },
    { key: 'clubName', label: 'Host Club Name or Code' },
    { key: 'startTime', label: 'Start Time (HH:MM)' },
    { key: 'endTime', label: 'End Time (HH:MM)' },
    { key: 'location', label: 'Location' },
    { key: 'capacity', label: 'Capacity' },
  ],
};

function autoMapHeaders(entity: TargetEntity, headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = headers.map((h) => ({ raw: h, norm: h.toLowerCase().replace(/[^a-z0-9]/g, '') }));

  const synonyms: Record<string, string[]> = {
    fullName: ['fullname', 'name', 'studentname', 'respondentname'],
    email: ['email', 'studentemail', 'respondentemail', 'emailaddress'],
    department: ['department', 'dept', 'major', 'branch', 'faculty'],
    studentCode: ['studentcode', 'studentid', 'rollno', 'id', 'rollnumber'],
    academicYear: ['academicyear', 'year', 'semester', 'grade'],
    clubName: ['clubname', 'club', 'preferredclub', 'organization', 'clubcode'],
    name: ['clubname', 'name', 'organization'],
    code: ['code', 'clubcode', 'shortcode'],
    category: ['category', 'type', 'domain'],
    facultyAdvisor: ['advisor', 'facultyadvisor', 'mentor'],
    description: ['description', 'summary', 'about'],
    role: ['role', 'position', 'membershiprole'],
    joinedAt: ['joinedat', 'joindate', 'date', 'timestamp'],
    title: ['title', 'eventtitle', 'eventname', 'name'],
    eventDate: ['eventdate', 'date', 'scheduleddate'],
    startTime: ['starttime', 'start'],
    endTime: ['endtime', 'end'],
    location: ['location', 'venue', 'room'],
    capacity: ['capacity', 'seats', 'maxattendees'],
  };

  for (const field of ENTITY_FIELDS[entity]) {
    const candidates = synonyms[field.key] ?? [field.key.toLowerCase()];
    const matched = lowerHeaders.find((h) =>
      candidates.some((c) => h.norm === c || h.norm.includes(c))
    );
    if (matched) {
      mapping[field.key] = matched.raw;
    }
  }
  return mapping;
}

export const DataManagementView: React.FC<DataManagementViewProps> = ({
  analytics,
  user,
  onRefreshAnalytics,
  onConnectWorkspace,
}) => {
  const [activeTab, setActiveTab] = useState<DataTab>('sheets');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string; url?: string } | null>(null);

  // Shared Import Pipeline State (used by Sheets, Drive CSV, Forms, and Local CSV)
  const [importSource, setImportSource] = useState<string>('Google Sheets');
  const [importSourceName, setImportSourceName] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [targetEntity, setTargetEntity] = useState<TargetEntity>('students');
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [confirmCommitOpen, setConfirmCommitOpen] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Google Sheets state
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [worksheets, setWorksheets] = useState<Array<{ sheetId: number; title: string }>>([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState<string>('');
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [exportReportType, setExportReportType] = useState<'clubs' | 'departments' | 'events' | 'trends'>('clubs');
  const [exportingSheet, setExportingSheet] = useState(false);

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveReports, setDriveReports] = useState<any[]>([]);
  const [driveFolderReady, setDriveFolderReady] = useState(false);
  const [driveSubfolder, setDriveSubfolder] = useState('Monthly Reports');
  const [loadingDrive, setLoadingDrive] = useState(false);

  // Google Forms state
  const [formsList, setFormsList] = useState<any[]>([]);
  const [manualFormId, setManualFormId] = useState('');
  const [loadedFormMeta, setLoadedFormMeta] = useState<{
    title: string;
    linkedSheetId: string | null;
    responsesError: string | null;
  } | null>(null);
  const [loadingForms, setLoadingForms] = useState(false);

  // Secure File Archive state
  const [storedFiles, setStoredFiles] = useState<StoredFileRecord[]>([]);
  const [gcsConfigured, setGcsConfigured] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('Dataset');
  const [uploadingArchive, setUploadingArchive] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const loadStoredFiles = async () => {
    if (!user) return;
    try {
      const data = await apiFetch<{
        files: StoredFileRecord[];
        gcsBucketConfigured: boolean;
      }>('/api/storage/files');
      setStoredFiles(data.files ?? []);
      setGcsConfigured(Boolean(data.gcsBucketConfigured));
    } catch {
      // Ignore if unauthenticated
    }
  };

  useEffect(() => {
    if (activeTab === 'archive' && user) {
      loadStoredFiles();
    }
  }, [activeTab, user]);

  const stageDatasetForImport = (
    source: string,
    sourceName: string,
    headers: string[],
    rows: Record<string, string>[]
  ) => {
    setImportSource(source);
    setImportSourceName(sourceName);
    setRawHeaders(headers);
    setRawRows(rows);
    setColumnMap(autoMapHeaders(targetEntity, headers));
    setValidation(null);
  };

  const handleEntityChange = (nextEntity: TargetEntity) => {
    setTargetEntity(nextEntity);
    setColumnMap(autoMapHeaders(nextEntity, rawHeaders));
    setValidation(null);
  };

  const buildMappedRows = () =>
    rawRows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const [fieldKey, sourceCol] of Object.entries(columnMap)) {
        if (sourceCol) {
          mapped[fieldKey] = row[sourceCol] ?? '';
        }
      }
      return mapped;
    });

  const handleValidateDataset = async () => {
    setFeedback(null);
    if (!isAdmin) {
      setFeedback({ type: 'error', text: 'Sign in as an Administrator to validate and import records.' });
      return;
    }
    setValidating(true);
    try {
      const mappedRows = buildMappedRows();
      const result = await apiFetch<ValidationResult>('/api/import/validate', {
        method: 'POST',
        body: JSON.stringify({ targetEntity, rows: mappedRows }),
      });
      setValidation(result);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Validation failed.' });
    } finally {
      setValidating(false);
    }
  };

  const handleCommitImport = async () => {
    setFeedback(null);
    setCommitting(true);
    try {
      const mappedRows = buildMappedRows();
      const res = await apiFetch<{
        importedCount: number;
        skippedCount: number;
        failedCount: number;
      }>('/api/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          targetEntity,
          rows: mappedRows,
          source: importSource,
          sourceName: importSourceName,
          confirmed: true,
        }),
      });
      setConfirmCommitOpen(false);
      setRawHeaders([]);
      setRawRows([]);
      setValidation(null);
      setFeedback({
        type: 'success',
        text: `Imported ${res.importedCount} record(s) into PostgreSQL (${res.skippedCount} duplicates skipped, ${res.failedCount} invalid).`,
      });
      trackAppUsage('data_import', { source: importSource, entity: targetEntity });
      await onRefreshAnalytics();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Import commit failed.' });
    } finally {
      setCommitting(false);
    }
  };

  // --- GOOGLE SHEETS HANDLERS ---
  const ensureWorkspaceReady = async (group: WorkspaceScopeGroup) => {
    if (!user) {
      setFeedback({ type: 'error', text: 'Sign in with Google first to connect Google Workspace.' });
      return false;
    }
    const granted = getGrantedScopeGroups();
    if (!getCachedWorkspaceToken() || !granted.includes(group)) {
      return onConnectWorkspace([group]);
    }
    return true;
  };

  const handleLoadSpreadsheets = async () => {
    setFeedback(null);
    setLoadingSheets(true);
    try {
      const ok = await ensureWorkspaceReady('sheets');
      if (!ok) return;
      const data = await apiFetch<{ spreadsheets: any[] }>('/api/google/sheets/list', {
        includeGoogleToken: true,
      });
      setSpreadsheets(data.spreadsheets ?? []);
      setFeedback({
        type: 'success',
        text: `Found ${(data.spreadsheets ?? []).length} accessible Google Spreadsheet(s).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to load Google Spreadsheets.' });
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleSelectSpreadsheet = async (spreadsheetId: string) => {
    setSelectedSheetId(spreadsheetId);
    setWorksheets([]);
    setSelectedWorksheet('');
    if (!spreadsheetId) return;
    setLoadingSheets(true);
    try {
      const meta = await apiFetch<{ title: string; sheets: Array<{ sheetId: number; title: string }> }>(
        `/api/google/sheets/${encodeURIComponent(spreadsheetId)}/meta`,
        { includeGoogleToken: true }
      );
      setWorksheets(meta.sheets ?? []);
      if (meta.sheets?.length > 0) {
        await handlePreviewWorksheet(spreadsheetId, meta.sheets[0].title, meta.title);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to load worksheets.' });
    } finally {
      setLoadingSheets(false);
    }
  };

  const handlePreviewWorksheet = async (
    spreadsheetId: string,
    sheetTitle: string,
    spreadsheetTitle?: string
  ) => {
    setSelectedWorksheet(sheetTitle);
    setLoadingSheets(true);
    try {
      const preview = await apiFetch<{ headers: string[]; rows: Record<string, string>[] }>(
        `/api/google/sheets/${encodeURIComponent(spreadsheetId)}/preview?sheet=${encodeURIComponent(
          sheetTitle
        )}`,
        { includeGoogleToken: true }
      );
      const sheetObj = spreadsheets.find((s) => s.id === spreadsheetId);
      const label = `${spreadsheetTitle || sheetObj?.name || spreadsheetId} (${sheetTitle})`;
      stageDatasetForImport('Google Sheets', label, preview.headers ?? [], preview.rows ?? []);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Unable to preview worksheet.' });
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleExportToGoogleSheets = async () => {
    setFeedback(null);
    if (!isAdmin) {
      setFeedback({ type: 'error', text: 'Administrator privileges are required to export reports.' });
      return;
    }
    setExportingSheet(true);
    try {
      const ok = await ensureWorkspaceReady('sheets');
      if (!ok) return;
      const res = await apiFetch('/api/google/sheets/export', {
        method: 'POST',
        includeGoogleToken: true,
        body: JSON.stringify({ reportType: exportReportType }),
      });
      setFeedback({
        type: 'success',
        text: `Created Google Sheet "${res.title}" with ${res.rowCount} verified records.`,
        url: res.spreadsheetUrl,
      });
      trackAppUsage('report_download', { format: 'google_sheets', report: exportReportType });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Google Sheets export failed.' });
    } finally {
      setExportingSheet(false);
    }
  };

  // --- GOOGLE DRIVE HANDLERS ---
  const handleLoadDriveWorkspace = async () => {
    setFeedback(null);
    setLoadingDrive(true);
    try {
      const ok = await ensureWorkspaceReady('drive');
      if (!ok) return;
      const [filesRes, reportsRes] = await Promise.all([
        apiFetch<{ files: any[] }>('/api/google/drive/files', { includeGoogleToken: true }),
        apiFetch<{ folderInitialized: boolean; reports: any[] }>(
          '/api/google/drive/clubpulse-reports',
          { includeGoogleToken: true }
        ),
      ]);
      setDriveFiles(filesRes.files ?? []);
      setDriveFolderReady(Boolean(reportsRes.folderInitialized));
      setDriveReports(reportsRes.reports ?? []);
      setFeedback({
        type: 'success',
        text: `Loaded ${(filesRes.files ?? []).length} Drive dataset(s) and ${(reportsRes.reports ?? []).length} archived report(s).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to browse Google Drive.' });
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleEnsureClubPulseFolders = async () => {
    setFeedback(null);
    if (!isAdmin) {
      setFeedback({ type: 'error', text: 'Administrator privileges required.' });
      return;
    }
    setLoadingDrive(true);
    try {
      const ok = await ensureWorkspaceReady('drive');
      if (!ok) return;
      await apiFetch('/api/google/drive/ensure-folders', {
        method: 'POST',
        includeGoogleToken: true,
      });
      setDriveFolderReady(true);
      setFeedback({
        type: 'success',
        text: 'Verified CampusLytix Drive folder hierarchy in Google Drive (Datasets, Monthly Reports, Club Analytics, Department Reports, Event Analytics).',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to organize Drive folders.' });
    } finally {
      setLoadingDrive(false);
    }
  };

  const handlePreviewDriveFile = async (file: any) => {
    setFeedback(null);
    setLoadingDrive(true);
    try {
      const data = await apiFetch<{ content: string }>(
        `/api/google/drive/files/${encodeURIComponent(file.id)}/content?mimeType=${encodeURIComponent(
          file.mimeType
        )}`,
        { includeGoogleToken: true }
      );
      const parsed = parseCsvText(data.content);
      stageDatasetForImport('Google Drive', file.name, parsed.headers, parsed.rows);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Unable to preview Drive file.' });
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleArchiveReportToDrive = async (format: 'csv' | 'pdf_html') => {
    setFeedback(null);
    if (!isAdmin) {
      setFeedback({ type: 'error', text: 'Administrator privileges required to archive reports.' });
      return;
    }
    setLoadingDrive(true);
    try {
      const ok = await ensureWorkspaceReady('drive');
      if (!ok) return;
      const dateStamp = new Date().toISOString().slice(0, 10);
      let fileName = `CampusLytix_${driveSubfolder.replace(/\s+/g, '_')}_${dateStamp}.csv`;
      let mimeType = 'text/csv';
      let content = toCsvString(
        ['Club', 'Category', 'Department', 'Members', 'Events', 'Check-Ins', 'Attendance Rate (%)'],
        analytics.clubRankings.map((c) => [
          c.name,
          c.category,
          c.department,
          c.memberCount,
          c.eventCount,
          c.totalCheckIns,
          c.attendanceRate,
        ])
      );

      if (format === 'pdf_html') {
        fileName = `CampusLytix_Executive_Summary_${dateStamp}.html`;
        mimeType = 'text/html';
        content = `<!doctype html><html><head><meta charset="utf-8"><title>CampusLytix Report ${dateStamp}</title><style>body{font-family:sans-serif;padding:32px;color:#101B3A}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}</style></head><body><h1>CampusLytix Institutional Engagement Report (${dateStamp})</h1><p>Engagement Rate: <strong>${analytics.kpis.engagementRate}%</strong> (${analytics.kpis.engagedStudents}/${analytics.kpis.totalStudents} students) | Active Memberships: <strong>${analytics.kpis.totalMemberships}</strong> | Avg Attendance Rate: <strong>${analytics.kpis.avgAttendanceRate}%</strong></p><table><thead><tr><th>Club</th><th>Department</th><th>Members</th><th>Check-Ins</th><th>Attendance %</th></tr></thead><tbody>${analytics.clubRankings
          .map(
            (c) =>
              `<tr><td>${c.name}</td><td>${c.department}</td><td>${c.memberCount}</td><td>${c.totalCheckIns}</td><td>${c.attendanceRate}%</td></tr>`
          )
          .join('')}</tbody></table></body></html>`;
      }

      const res = await apiFetch('/api/google/drive/upload-report', {
        method: 'POST',
        includeGoogleToken: true,
        body: JSON.stringify({
          fileName,
          mimeType,
          content,
          subfolder: driveSubfolder,
        }),
      });
      setFeedback({
        type: 'success',
        text: `Saved "${fileName}" to ${res.folder} in Google Drive.`,
        url: res.file?.webViewLink,
      });
      await handleLoadDriveWorkspace();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Drive upload failed.' });
    } finally {
      setLoadingDrive(false);
    }
  };

  // --- GOOGLE FORMS HANDLERS ---
  const handleLoadFormsList = async () => {
    setFeedback(null);
    setLoadingForms(true);
    try {
      const ok = await ensureWorkspaceReady('forms');
      if (!ok) return;
      const data = await apiFetch<{ forms: any[] }>('/api/google/forms/list', {
        includeGoogleToken: true,
      });
      setFormsList(data.forms ?? []);
      setFeedback({
        type: 'success',
        text: `Loaded ${(data.forms ?? []).length} Google Form(s).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to list Google Forms.' });
    } finally {
      setLoadingForms(false);
    }
  };

  const handleLoadFormResponses = async (formIdOrUrl: string) => {
    setFeedback(null);
    let cleanId = formIdOrUrl.trim();
    const match = cleanId.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
    if (match) cleanId = match[1];
    if (!cleanId) return;

    setLoadingForms(true);
    try {
      const ok = await ensureWorkspaceReady('forms');
      if (!ok) return;
      const data = await apiFetch<{
        title: string;
        linkedSheetId: string | null;
        headers: string[];
        rows: Record<string, string>[];
        responsesError: string | null;
      }>(`/api/google/forms/${encodeURIComponent(cleanId)}`, {
        includeGoogleToken: true,
      });

      setLoadedFormMeta({
        title: data.title,
        linkedSheetId: data.linkedSheetId,
        responsesError: data.responsesError,
      });

      if (data.rows.length > 0) {
        stageDatasetForImport('Google Forms', data.title, data.headers, data.rows);
        setFeedback({
          type: 'success',
          text: `Loaded ${data.rows.length} response(s) from "${data.title}". Map columns and validate before importing.`,
        });
      } else {
        setFeedback({
          type: 'error',
          text:
            data.responsesError ||
            'No direct responses returned. Use the linked Google Sheet fallback below if configured.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Unable to load Google Form.' });
    } finally {
      setLoadingForms(false);
    }
  };

  // --- LOCAL CSV & PRIVATE ARCHIVE HANDLERS ---
  const handleLocalCsvFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsvText(text);
    if (parsed.headers.length === 0) {
      setFeedback({ type: 'error', text: 'CSV file appears empty or unreadable.' });
      return;
    }
    stageDatasetForImport('CSV', file.name, parsed.headers, parsed.rows);
    setFeedback({
      type: 'success',
      text: `Staged ${parsed.rows.length} row(s) from "${file.name}". Map columns and validate below.`,
    });
  };

  const handleUploadToPrivateArchive = async (file: File) => {
    setFeedback(null);
    if (!isAdmin) {
      setFeedback({ type: 'error', text: 'Administrator privileges are required to upload archive files.' });
      return;
    }
    setUploadingArchive(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadCategory);
      await apiFetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });
      setFeedback({ type: 'success', text: `Stored "${file.name}" securely in authenticated archive.` });
      await loadStoredFiles();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Archive upload failed.' });
    } finally {
      setUploadingArchive(false);
    }
  };

  const handleDownloadArchivedFile = async (file: StoredFileRecord) => {
    if (file.storageBackend === 'google_drive' && file.storagePath.startsWith('http')) {
      window.open(file.storagePath, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      const token = await (await import('../lib/firebase')).getFreshIdToken();
      const res = await fetch(`/api/storage/files/${file.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Unable to download file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Download failed.' });
    }
  };

  const handleDeleteArchivedFile = async (id: number) => {
    try {
      await apiFetch(`/api/storage/files/${id}`, { method: 'DELETE' });
      await loadStoredFiles();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Delete failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-2 flex flex-wrap items-center gap-1">
        {([
          ['sheets', 'Import from Google Sheets'],
          ['drive', 'Google Drive & Reports'],
          ['forms', 'Google Forms Collection'],
          ['archive', 'CSV & Private Storage'],
          ['history', 'Import History'],
        ] as Array<[DataTab, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === key
                ? 'bg-[#101B3A] text-white'
                : 'text-slate-600 hover:bg-[#F4F6FC] hover:text-[#101B3A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
              className="text-xs font-semibold text-[#315EF8] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              Open File <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* TAB 1: GOOGLE SHEETS IMPORT & EXPORT */}
      {activeTab === 'sheets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <GoogleServiceIcon service="google_sheets" className="w-8 h-8" />
                <div>
                  <h2 className="text-base font-bold text-[#101B3A]">Import from Google Sheets</h2>
                  <p className="text-xs text-slate-500">
                    Select a spreadsheet, choose a worksheet tab, map columns, validate duplicates, and commit to PostgreSQL
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={loadingSheets}
                onClick={handleLoadSpreadsheets}
                className="h-9 px-4 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-60 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSheets ? 'animate-spin' : ''}`} />
                {spreadsheets.length > 0 ? 'Refresh Spreadsheets' : 'Browse Google Sheets'}
              </button>
            </div>

            {spreadsheets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    1. Select Spreadsheet
                  </label>
                  <select
                    value={selectedSheetId}
                    onChange={(e) => handleSelectSpreadsheet(e.target.value)}
                    className="w-full h-10 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-sm text-[#101B3A]"
                  >
                    <option value="">Choose a spreadsheet...</option>
                    {spreadsheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    2. Select Worksheet Tab
                  </label>
                  <select
                    disabled={worksheets.length === 0}
                    value={selectedWorksheet}
                    onChange={(e) => handlePreviewWorksheet(selectedSheetId, e.target.value)}
                    className="w-full h-10 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-sm text-[#101B3A] disabled:opacity-50"
                  >
                    <option value="">Choose a tab...</option>
                    {worksheets.map((w) => (
                      <option key={w.sheetId} value={w.title}>
                        {w.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-[#F4F6FC] rounded-lg text-xs text-slate-600 leading-relaxed">
                Connect your Google account and click <strong>Browse Google Sheets</strong> to list authorized spreadsheets. Google Sheets acts strictly as an import/export channel—PostgreSQL remains CampusLytix&apos;s single source of truth.
              </div>
            )}
          </div>

          {/* Export Filtered Analytics to Google Sheets */}
          <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#101B3A]">Export Analytics to Google Sheets</h3>
            <p className="text-xs text-slate-500">
              Generate a formatted spreadsheet directly in your Google Drive from live PostgreSQL metrics.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Report Dataset</label>
              <select
                value={exportReportType}
                onChange={(e) => setExportReportType(e.target.value as any)}
                className="w-full h-10 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-sm"
              >
                <option value="clubs">Club Popularity Rankings</option>
                <option value="departments">Department Analytics</option>
                <option value="events">Event Attendance Records</option>
                <option value="trends">Monthly Participation Trends</option>
              </select>
            </div>
            <button
              type="button"
              disabled={exportingSheet || !isAdmin}
              onClick={handleExportToGoogleSheets}
              className="w-full h-10 px-4 text-xs font-semibold text-white bg-[#18B6A0] hover:bg-[#139986] disabled:opacity-50 rounded-lg transition-colors"
            >
              {exportingSheet ? 'Creating Spreadsheet...' : 'Create Google Sheet Report'}
            </button>
            {!isAdmin && (
              <p className="text-[11px] text-slate-500">
                Sign in with an Administrator account to export reports.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GOOGLE DRIVE DATASETS & ARCHIVED REPORTS */}
      {activeTab === 'drive' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <GoogleServiceIcon service="google_drive" className="w-7 h-7" />
                <div>
                  <h2 className="text-base font-bold text-[#101B3A]">Google Drive Dataset Picker</h2>
                  <p className="text-xs text-slate-500">
                    Select CSV or Google Sheets files from Drive to preview and validate before import
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={loadingDrive}
                onClick={handleLoadDriveWorkspace}
                className="h-9 px-3.5 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-60 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin' : ''}`} />
                Browse Drive
              </button>
            </div>

            {driveFiles.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
                {driveFiles.map((f) => (
                  <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#F8FAFF]">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#101B3A] truncate">{f.name}</div>
                      <div className="text-slate-500">
                        {f.mimeType.includes('spreadsheet') ? 'Google Sheet' : f.mimeType.includes('csv') ? 'CSV Dataset' : f.mimeType.includes('pdf') ? 'PDF Report' : 'Spreadsheet'} · Updated {String(f.modifiedTime || '').slice(0, 10)}
                      </div>
                    </div>
                    {(f.mimeType.includes('csv') || f.mimeType.includes('spreadsheet')) && (
                      <button
                        type="button"
                        onClick={() => handlePreviewDriveFile(f)}
                        className="px-3 py-1.5 font-semibold text-[#315EF8] bg-[#EEF3FF] hover:bg-[#315EF8] hover:text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        Preview &amp; Map
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 bg-[#F4F6FC] rounded-lg text-xs text-slate-600">
                Click <strong>Browse Drive</strong> to inspect eligible CSV, Excel, and Google Sheets files in your Google Drive.
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#101B3A]">CampusLytix/ Drive Folder Archive</h3>
              <button
                type="button"
                disabled={loadingDrive || !isAdmin}
                onClick={handleEnsureClubPulseFolders}
                className="h-8 px-3 text-xs font-semibold text-[#101B3A] bg-[#F4F6FC] hover:bg-slate-200/70 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[#7657E8]" />
                {driveFolderReady ? 'Folders Ready' : 'Initialize Folders'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Organizes exported reports under <span className="font-mono text-[#101B3A]">CampusLytix/{driveSubfolder}</span> using app-scoped Drive permissions.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Target Subfolder</label>
              <select
                value={driveSubfolder}
                onChange={(e) => setDriveSubfolder(e.target.value)}
                className="w-full h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-xs"
              >
                <option value="Monthly Reports">CampusLytix / Monthly Reports</option>
                <option value="Club Analytics">CampusLytix / Club Analytics</option>
                <option value="Department Reports">CampusLytix / Department Reports</option>
                <option value="Event Analytics">CampusLytix / Event Analytics</option>
                <option value="Datasets">CampusLytix / Datasets</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={loadingDrive || !isAdmin}
                onClick={() => handleArchiveReportToDrive('csv')}
                className="h-9 px-3 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-50 rounded-lg"
              >
                Archive CSV Report
              </button>
              <button
                type="button"
                disabled={loadingDrive || !isAdmin}
                onClick={() => handleArchiveReportToDrive('pdf_html')}
                className="h-9 px-3 text-xs font-semibold text-white bg-[#7657E8] hover:bg-[#6243D6] disabled:opacity-50 rounded-lg"
              >
                Archive Summary Doc
              </button>
            </div>

            {driveReports.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2 max-h-44 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-500">Previously Exported in Drive</div>
                {driveReports.map((r) => (
                  <a
                    key={r.id}
                    href={r.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-md hover:bg-[#F4F6FC]"
                  >
                    <span className="truncate font-medium text-[#101B3A]">{r.name}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{r.folderLabel}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GOOGLE FORMS STUDENT DATA COLLECTION */}
      {activeTab === 'forms' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <GoogleServiceIcon service="google_forms" className="w-8 h-8" />
              <div>
                <h2 className="text-base font-bold text-[#101B3A]">Google Forms Data Collection</h2>
                <p className="text-xs text-slate-500">
                  Import student club registrations, event sign-ups, and preference surveys with duplicate validation
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={loadingForms}
              onClick={handleLoadFormsList}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#7657E8] hover:bg-[#6344D6] disabled:opacity-60 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingForms ? 'animate-spin' : ''}`} />
              Browse Google Forms
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Pick from Accessible Forms
              </label>
              <select
                disabled={formsList.length === 0}
                onChange={(e) => handleLoadFormResponses(e.target.value)}
                defaultValue=""
                className="w-full h-10 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-sm disabled:opacity-50"
              >
                <option value="">
                  {formsList.length > 0 ? 'Select a Google Form...' : 'Click Browse Google Forms first'}
                </option>
                {formsList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Or Enter Google Form ID / URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualFormId}
                  onChange={(e) => setManualFormId(e.target.value)}
                  placeholder="Paste Form ID or https://docs.google.com/forms/d/..."
                  className="flex-1 h-10 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-xs"
                />
                <button
                  type="button"
                  disabled={loadingForms || !manualFormId.trim()}
                  onClick={() => handleLoadFormResponses(manualFormId)}
                  className="h-10 px-4 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0"
                >
                  Load Form
                </button>
              </div>
            </div>
          </div>

          {loadedFormMeta?.linkedSheetId && (
            <div className="p-4 bg-[#F4F6FC] border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-semibold text-[#101B3A]">
                  Linked Google Sheets Response Destination Detected
                </div>
                <div className="text-slate-600 mt-0.5">
                  Form &ldquo;{loadedFormMeta.title}&rdquo; writes responses to Sheet ID{' '}
                  <span className="font-mono">{loadedFormMeta.linkedSheetId}</span>.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('sheets');
                  handleSelectSpreadsheet(loadedFormMeta.linkedSheetId!);
                }}
                className="h-8 px-3 font-semibold text-white bg-[#18B6A0] hover:bg-[#139986] rounded-lg whitespace-nowrap shrink-0"
              >
                Import via Linked Sheet
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LOCAL CSV & PRIVATE FILE ARCHIVE */}
      {activeTab === 'archive' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#101B3A]">Local CSV Import</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Load a local CSV file into the column-mapping &amp; duplicate-validation pipeline
              </p>
              <label className="mt-3 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-[#315EF8] rounded-xl p-5 cursor-pointer bg-[#F4F6FC] transition-colors">
                <Upload className="w-5 h-5 text-[#315EF8] mb-1.5" />
                <span className="text-xs font-semibold text-[#101B3A]">Choose CSV Dataset</span>
                <span className="text-[11px] text-slate-500 mt-0.5">Preview &amp; validate before database commit</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLocalCsvFile(f);
                  }}
                />
              </label>
            </div>

            <div className="pt-5 border-t border-slate-100">
              <div className="flex items-center gap-2.5">
                <GoogleServiceIcon service="cloud_storage" className="w-6 h-6" />
                <div>
                  <h3 className="text-sm font-bold text-[#101B3A]">Authenticated Private Archive</h3>
                  <p className="text-xs text-slate-500">
                    {gcsConfigured
                      ? 'Private Cloud Storage bucket configured'
                      : 'Private server-side authenticated archive (max 10 MB · CSV/XLSX/PDF/JSON)'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="h-9 px-2.5 bg-[#F4F6FC] border border-slate-200 rounded-lg text-xs flex-1"
                >
                  <option value="Dataset">Dataset</option>
                  <option value="Monthly Report">Monthly Report</option>
                  <option value="Club Analytics">Club Analytics</option>
                  <option value="Department Report">Department Report</option>
                  <option value="Event Analytics">Event Analytics</option>
                </select>
                <label className="h-9 px-3.5 text-xs font-semibold text-white bg-[#101B3A] hover:bg-[#192852] rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingArchive ? 'Uploading...' : 'Archive File'}
                  <input
                    type="file"
                    disabled={uploadingArchive || !isAdmin}
                    accept=".csv,.xlsx,.xls,.pdf,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadToPrivateArchive(f);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#101B3A]">Archived Datasets &amp; Reports</h3>
                <p className="text-xs text-slate-500">
                  Private authenticated files tracked in PostgreSQL—never publicly exposed
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">{storedFiles.length} Files</span>
            </div>

            {!user ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Sign in with Google to access private archived datasets and reports.
              </div>
            ) : storedFiles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No archived files yet. Upload a dataset or archive a report from Google Drive to begin.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {storedFiles.map((f) => (
                  <div key={f.id} className="px-6 py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#101B3A] truncate">{f.originalName}</div>
                      <div className="text-slate-500 mt-0.5 font-mono tabular-nums">
                        {f.category} · {(f.sizeBytes / 1024).toFixed(1)} KB · {f.storageBackend} · {String(f.createdAt).slice(0, 10)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadArchivedFile(f)}
                        className="h-8 px-2.5 text-[#315EF8] bg-[#EEF3FF] hover:bg-[#315EF8] hover:text-white rounded-md inline-flex items-center gap-1 font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteArchivedFile(f.id)}
                          className="h-8 px-2 text-slate-400 hover:text-red-600 rounded-md"
                          aria-label="Delete archived file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: IMPORT HISTORY AUDIT LOG */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-[#101B3A]">PostgreSQL Import History</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable audit record of every dataset imported via CSV, Google Sheets, Drive, Calendar, or Forms
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-6">Source &amp; File</th>
                  <th className="py-3 px-4">Target Table</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Imported</th>
                  <th className="py-3 px-4 text-right">Skipped</th>
                  <th className="py-3 px-4 text-right">Failed</th>
                  <th className="py-3 px-6">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.recentImports.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8FAFF]">
                    <td className="py-3 px-6">
                      <div className="font-semibold text-[#101B3A]">{log.sourceName}</div>
                      <div className="text-slate-500">
                        {log.source} · {String(log.createdAt).slice(0, 16).replace('T', ' ')}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{log.targetEntity}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{log.recordsTotal}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#18B6A0]">
                      {log.recordsImported}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-600">
                      {log.recordsSkipped}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-red-600">
                      {log.recordsFailed}
                    </td>
                    <td className="py-3 px-6 text-slate-600">{log.performedByEmail || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SHARED PREVIEW, COLUMN MAPPING & VALIDATION WORKBENCH */}
      {rawHeaders.length > 0 && rawRows.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-[#101B3A]">
                Column Mapping &amp; Pre-Import Validation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Source: {importSource} · {importSourceName} · {rawRows.length} rows staged
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={targetEntity}
                onChange={(e) => handleEntityChange(e.target.value as TargetEntity)}
                className="h-9 px-3 bg-[#F4F6FC] border border-slate-200 rounded-lg text-xs font-semibold text-[#101B3A]"
              >
                <option value="students">Target: Students Table</option>
                <option value="clubs">Target: Clubs Table</option>
                <option value="memberships">Target: Memberships Table</option>
                <option value="events">Target: Events Table</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setRawHeaders([]);
                  setRawRows([]);
                  setValidation(null);
                }}
                className="h-9 px-3 text-xs text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Column Mapping Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {ENTITY_FIELDS[targetEntity].map((field) => (
              <div key={field.key} className="bg-[#F4F6FC] rounded-lg p-3">
                <label className="block text-xs font-semibold text-[#101B3A] mb-1.5">
                  {field.label} {field.required && <span className="text-red-600">*</span>}
                </label>
                <select
                  value={columnMap[field.key] ?? ''}
                  onChange={(e) => {
                    setColumnMap({ ...columnMap, [field.key]: e.target.value });
                    setValidation(null);
                  }}
                  className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs"
                >
                  <option value="">— Unmapped —</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Sample Data Preview */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2">
              Data Preview (first {Math.min(5, rawRows.length)} rows)
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500">
                    {rawHeaders.map((h) => (
                      <th key={h} className="py-2 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rawRows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {rawHeaders.map((h) => (
                        <td key={h} className="py-2 px-3 text-slate-700 whitespace-nowrap">
                          {r[h] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation Action & Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <button
              type="button"
              disabled={validating || !isAdmin}
              onClick={handleValidateDataset}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-50 rounded-lg"
            >
              {validating ? 'Validating against PostgreSQL...' : 'Validate & Check Duplicates'}
            </button>

            {validation && (
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                <span className="text-slate-600">Total: {validation.summary.total}</span>
                <span className="text-[#18B6A0] font-semibold">Valid: {validation.summary.valid}</span>
                <span className="text-amber-600 font-semibold">
                  Duplicates: {validation.summary.duplicates}
                </span>
                <span className="text-red-600 font-semibold">Invalid: {validation.summary.invalid}</span>
                <button
                  type="button"
                  disabled={validation.summary.valid === 0}
                  onClick={() => setConfirmCommitOpen(true)}
                  className="h-9 px-4 font-sans text-xs font-semibold text-white bg-[#18B6A0] hover:bg-[#139986] disabled:opacity-50 rounded-lg"
                >
                  Confirm &amp; Import {validation.summary.valid} Record(s)
                </button>
              </div>
            )}
          </div>

          {validation && (validation.duplicates.length > 0 || validation.errors.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {validation.duplicates.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <div className="font-semibold text-amber-900 mb-1.5">
                    Detected Duplicates ({validation.duplicates.length}) — Will Be Skipped
                  </div>
                  <ul className="space-y-1 text-amber-800 max-h-32 overflow-y-auto">
                    {validation.duplicates.slice(0, 8).map((d, i) => (
                      <li key={i}>Row {d.rowIndex}: {d.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validation.errors.length > 0 && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs">
                  <div className="font-semibold text-red-900 mb-1.5">
                    Validation Errors ({validation.errors.length}) — Excluded
                  </div>
                  <ul className="space-y-1 text-red-800 max-h-32 overflow-y-auto">
                    {validation.errors.slice(0, 8).map((e, i) => (
                      <li key={i}>Row {e.rowIndex}: {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Administrator Confirmation Modal for PostgreSQL Write */}
      {confirmCommitOpen && validation && (
        <div className="fixed inset-0 z-50 bg-[#101B3A]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#101B3A]">
                Confirm PostgreSQL Database Import
              </h3>
              <button
                type="button"
                onClick={() => setConfirmCommitOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              You are about to insert <strong className="text-[#101B3A]">{validation.summary.valid}</strong> validated record(s) into the <strong className="font-mono">{targetEntity}</strong> PostgreSQL table from <strong>{importSourceName}</strong>.
            </p>
            <div className="mt-3 p-3 bg-[#F4F6FC] rounded-lg text-xs text-slate-600 space-y-1 font-mono tabular-nums">
              <div>Valid rows to insert: {validation.summary.valid}</div>
              <div>Duplicate rows skipped: {validation.summary.duplicates}</div>
              <div>Invalid rows excluded: {validation.summary.invalid}</div>
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmCommitOpen(false)}
                className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={committing}
                onClick={handleCommitImport}
                className="h-9 px-4 text-xs font-semibold text-white bg-[#18B6A0] hover:bg-[#139986] disabled:opacity-60 rounded-lg"
              >
                {committing ? 'Importing...' : 'Commit to PostgreSQL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
