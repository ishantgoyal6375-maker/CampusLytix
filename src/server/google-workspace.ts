import { Router, type Response } from 'express';
import { eq } from 'drizzle-orm';
import {
  requireAdmin,
  requireAuth,
  type AuthRequest,
} from '../middleware/auth.ts';
import { db } from '../db/index.ts';
import {
  clubs,
  events,
  importHistory,
  storedFiles,
} from '../db/schema.ts';
import { getDashboardAnalytics, logIntegrationEvent } from '../db/analytics.ts';

const router = Router();

function getGoogleToken(req: AuthRequest, res: Response): string | null {
  const token = req.headers['x-google-access-token'];
  if (!token || typeof token !== 'string' || !token.trim()) {
    res.status(401).json({
      error:
        'Google Workspace authorization token missing. Please connect your Google Workspace account first.',
    });
    return null;
  }
  return token.trim();
}

async function googleFetch(url: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { rawText: text };
  }
  if (!response.ok) {
    const apiMessage =
      data?.error?.message ||
      data?.error_description ||
      `Google API error (${response.status})`;
    const err: any = new Error(apiMessage);
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------------------
// GOOGLE SHEETS
// ---------------------------------------------------------------------------

router.get('/sheets/list', requireAuth, async (req: AuthRequest, res) => {
  const token = getGoogleToken(req, res);
  if (!token) return;

  try {
    const q = encodeURIComponent(
      "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
    );
    const fields = encodeURIComponent(
      'files(id,name,modifiedTime,webViewLink,owners(displayName,emailAddress))'
    );
    const data = await googleFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=30`,
      token
    );
    res.json({ spreadsheets: data.files ?? [] });
  } catch (error: any) {
    res.status(error.status || 502).json({
      error: error.message || 'Failed to list Google Spreadsheets.',
    });
  }
});

router.get(
  '/sheets/:spreadsheetId/meta',
  requireAuth,
  async (req: AuthRequest, res) => {
    const token = getGoogleToken(req, res);
    if (!token) return;

    try {
      const safeId = encodeURIComponent(String(req.params.spreadsheetId).trim());
      const data = await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${safeId}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))`,
        token
      );
      res.json({
        spreadsheetId: data.spreadsheetId,
        title: data.properties?.title ?? 'Untitled Spreadsheet',
        url: data.spreadsheetUrl,
        sheets: (data.sheets ?? []).map((s: any) => ({
          sheetId: s.properties?.sheetId,
          title: s.properties?.title,
          rowCount: s.properties?.gridProperties?.rowCount ?? 0,
          columnCount: s.properties?.gridProperties?.columnCount ?? 0,
        })),
      });
    } catch (error: any) {
      res.status(error.status || 502).json({
        error: error.message || 'Failed to load spreadsheet worksheets.',
      });
    }
  }
);

router.get(
  '/sheets/:spreadsheetId/preview',
  requireAuth,
  async (req: AuthRequest, res) => {
    const token = getGoogleToken(req, res);
    if (!token) return;

    const sheetTitle = String(req.query.sheet ?? '').trim();
    if (!sheetTitle) {
      return res.status(400).json({ error: 'Worksheet name is required.' });
    }

    try {
      const safeId = encodeURIComponent(String(req.params.spreadsheetId).trim());
      const escapedSheet = `'${sheetTitle.replace(/'/g, "''")}'!A1:Z200`;
      const safeRange = encodeURIComponent(escapedSheet);
      const data = await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${safeRange}`,
        token
      );
      const values: string[][] = data.values ?? [];
      const headers = values.length > 0 ? values[0].map((h) => String(h ?? '').trim()) : [];
      const rows = values.slice(1).map((r) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = String(r[i] ?? '').trim();
        });
        return obj;
      });
      res.json({ headers, rows, totalRows: rows.length });
    } catch (error: any) {
      res.status(error.status || 502).json({
        error: error.message || 'Failed to preview worksheet rows.',
      });
    }
  }
);

router.post(
  '/sheets/export',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const token = getGoogleToken(req, res);
    if (!token) return;

    const { reportType, filters } = req.body ?? {};
    const analytics = await getDashboardAnalytics(filters ?? {});

    let title = 'ClubPulse Analytics Export';
    let sheetName = 'Report';
    let rows: (string | number)[][] = [];

    if (reportType === 'departments') {
      title = `ClubPulse Department Analytics (${new Date().toISOString().slice(0, 10)})`;
      sheetName = 'Department Analytics';
      rows = [
        ['Department', 'Total Students', 'Engaged Students', 'Engagement Rate (%)', 'Total Memberships', 'Event Attendances', 'Top Club'],
        ...analytics.departmentAnalytics.map((d) => [
          d.department,
          d.totalStudents,
          d.engagedStudents,
          d.engagementRate,
          d.totalMemberships,
          d.totalAttendances,
          d.topClub,
        ]),
      ];
    } else if (reportType === 'events') {
      title = `ClubPulse Event Attendance (${new Date().toISOString().slice(0, 10)})`;
      sheetName = 'Event Attendance';
      rows = [
        ['Event Title', 'Club', 'Date', 'Location', 'Capacity', 'Present', 'Registered', 'Attendance Rate (%)', 'Source'],
        ...analytics.eventsList.map((e) => [
          e.title,
          e.clubName,
          e.eventDate,
          e.location ?? '',
          e.capacity,
          e.presentCount,
          e.registeredCount,
          e.attendanceRate ?? 'Upcoming',
          e.source,
        ]),
      ];
    } else if (reportType === 'trends') {
      title = `ClubPulse Participation Trends (${new Date().toISOString().slice(0, 10)})`;
      sheetName = 'Participation Trends';
      rows = [
        ['Month', 'Events Held', 'Event Check-Ins', 'Unique Participants', 'New Memberships'],
        ...analytics.monthlyTrends.map((m) => [
          m.label,
          m.eventsHeld,
          m.checkIns,
          m.uniqueParticipants,
          m.newMemberships,
        ]),
      ];
    } else {
      title = `ClubPulse Club Rankings (${new Date().toISOString().slice(0, 10)})`;
      sheetName = 'Club Rankings';
      rows = [
        ['Club Code', 'Club Name', 'Category', 'Department', 'Members', 'Events', 'Total Check-Ins', 'Attendance Rate (%)', 'Participation Ratio (%)'],
        ...analytics.clubRankings.map((c) => [
          c.code,
          c.name,
          c.category,
          c.department,
          c.memberCount,
          c.eventCount,
          c.totalCheckIns,
          c.attendanceRate,
          c.participationRatio,
        ]),
      ];
    }

    try {
      const created = await googleFetch(
        'https://sheets.googleapis.com/v4/spreadsheets',
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            properties: { title },
            sheets: [{ properties: { title: sheetName } }],
          }),
        }
      );

      const safeId = encodeURIComponent(created.spreadsheetId);
      const safeRange = encodeURIComponent(`'${sheetName}'!A1`);
      await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${safeRange}?valueInputOption=USER_ENTERED`,
        token,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: rows }),
        }
      );

      await logIntegrationEvent({
        serviceKey: 'google_sheets',
        action: 'export_report',
        status: 'success',
        message: `Exported "${title}" (${rows.length - 1} rows) to Google Sheets.`,
        accountEmail: req.dbUser?.email,
      });

      res.json({
        spreadsheetId: created.spreadsheetId,
        spreadsheetUrl: created.spreadsheetUrl,
        title,
        rowCount: rows.length - 1,
      });
    } catch (error: any) {
      await logIntegrationEvent({
        serviceKey: 'google_sheets',
        action: 'export_report',
        status: 'error',
        message: error.message || 'Sheets export failed',
        accountEmail: req.dbUser?.email,
      });
      res.status(error.status || 502).json({
        error: error.message || 'Failed to export report to Google Sheets.',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GOOGLE DRIVE
// ---------------------------------------------------------------------------

const CLUBPULSE_SUBFOLDERS = [
  'Datasets',
  'Monthly Reports',
  'Club Analytics',
  'Department Reports',
  'Event Analytics',
];

async function findOrCreateFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  let q = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }
  const search = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`,
    token
  );
  if (search.files && search.files.length > 0) {
    return search.files[0].id;
  }

  const created = await googleFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    }
  );
  return created.id;
}

router.get('/drive/files', requireAuth, async (req: AuthRequest, res) => {
  const token = getGoogleToken(req, res);
  if (!token) return;

  try {
    const search = String(req.query.q ?? '').trim().replace(/'/g, "\\'");
    let q =
      "trashed=false and (mimeType='text/csv' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/pdf')";
    if (search) {
      q += ` and name contains '${search}'`;
    }
    const fields = encodeURIComponent(
      'files(id,name,mimeType,size,modifiedTime,webViewLink)'
    );
    const data = await googleFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=modifiedTime desc&pageSize=30`,
      token
    );
    res.json({ files: data.files ?? [] });
  } catch (error: any) {
    res.status(error.status || 502).json({
      error: error.message || 'Failed to browse Google Drive files.',
    });
  }
});

router.get(
  '/drive/files/:fileId/content',
  requireAuth,
  async (req: AuthRequest, res) => {
    const token = getGoogleToken(req, res);
    if (!token) return;

    const safeId = encodeURIComponent(String(req.params.fileId).trim());
    const mimeType = String(req.query.mimeType ?? '');

    try {
      const url =
        mimeType === 'application/vnd.google-apps.spreadsheet'
          ? `https://www.googleapis.com/drive/v3/files/${safeId}/export?mimeType=text/csv`
          : `https://www.googleapis.com/drive/v3/files/${safeId}?alt=media`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errText = await response.text();
        return res
          .status(response.status)
          .json({ error: `Unable to download Drive file (${response.status}): ${errText.slice(0, 160)}` });
      }
      const csvText = await response.text();
      res.json({ content: csvText });
    } catch (error: any) {
      res.status(502).json({
        error: error.message || 'Failed to download Drive file content.',
      });
    }
  }
);

router.post(
  '/drive/ensure-folders',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const token = getGoogleToken(req, res);
    if (!token) return;

    try {
      const rootId = await findOrCreateFolder(token, 'CampusLytix');
      const subfolders: Record<string, string> = {};
      for (const name of CLUBPULSE_SUBFOLDERS) {
        subfolders[name] = await findOrCreateFolder(token, name, rootId);
      }

      await logIntegrationEvent({
        serviceKey: 'google_drive',
        action: 'ensure_folders',
        status: 'success',
        message: 'Verified CampusLytix folder hierarchy in Google Drive.',
        accountEmail: req.dbUser?.email,
      });

      res.json({ rootFolderId: rootId, subfolders });
    } catch (error: any) {
      res.status(error.status || 502).json({
        error: error.message || 'Failed to organize CampusLytix Drive folders.',
      });
    }
  }
);

router.post(
  '/drive/upload-report',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const token = getGoogleToken(req, res);
    if (!token) return;

    const { fileName, mimeType, content, subfolder } = req.body ?? {};
    if (!fileName || !content) {
      return res.status(400).json({ error: 'fileName and content are required.' });
    }

    const folderName = CLUBPULSE_SUBFOLDERS.includes(subfolder)
      ? subfolder
      : 'Monthly Reports';

    try {
      const rootId = await findOrCreateFolder(token, 'CampusLytix');
      const targetFolderId = await findOrCreateFolder(token, folderName, rootId);

      const boundary = 'clubpulse_drive_boundary_' + Date.now();
      const metadata = JSON.stringify({
        name: fileName,
        parents: [targetFolderId],
      });
      const safeMime = mimeType || 'text/csv';
      const multipartBody = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadata,
        `--${boundary}`,
        `Content-Type: ${safeMime}`,
        '',
        content,
        `--${boundary}--`,
      ].join('\r\n');

      const uploaded = await googleFetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType,size,modifiedTime',
        token,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      await db.insert(storedFiles).values({
        fileName: uploaded.name,
        originalName: fileName,
        mimeType: safeMime,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        category: folderName,
        storageBackend: 'google_drive',
        storagePath: uploaded.webViewLink || uploaded.id,
        driveFileId: uploaded.id,
        uploadedByUid: req.dbUser?.uid ?? null,
        uploadedByEmail: req.dbUser?.email ?? null,
      });

      await logIntegrationEvent({
        serviceKey: 'google_drive',
        action: 'upload_report',
        status: 'success',
        message: `Archived "${fileName}" to CampusLytix/${folderName} in Google Drive.`,
        accountEmail: req.dbUser?.email,
      });

      res.json({ file: uploaded, folder: `CampusLytix/${folderName}` });
    } catch (error: any) {
      res.status(error.status || 502).json({
        error: error.message || 'Failed to upload report to Google Drive.',
      });
    }
  }
);

router.get(
  '/drive/clubpulse-reports',
  requireAuth,
  async (req: AuthRequest, res) => {
    const token = getGoogleToken(req, res);
    if (!token) return;

    try {
      const qRoot = encodeURIComponent(
        "mimeType='application/vnd.google-apps.folder' and name='CampusLytix' and trashed=false"
      );
      const rootSearch = await googleFetch(
        `https://www.googleapis.com/drive/v3/files?q=${qRoot}&fields=files(id,name)`,
        token
      );
      if (!rootSearch.files || rootSearch.files.length === 0) {
        return res.json({ folderInitialized: false, reports: [] });
      }
      const rootId = rootSearch.files[0].id;
      const subSearch = await googleFetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        )}&fields=files(id,name)`,
        token
      );
      const folderIds = [rootId, ...(subSearch.files ?? []).map((f: any) => f.id)];
      const folderNameById = new Map<string, string>([
        [rootId, 'CampusLytix'],
        ...(subSearch.files ?? []).map((f: any) => [f.id, `CampusLytix/${f.name}`] as [string, string]),
      ]);

      const parentQuery = folderIds.map((id) => `'${id}' in parents`).join(' or ');
      const fileQuery = `(${parentQuery}) and mimeType!='application/vnd.google-apps.folder' and trashed=false`;
      const reportsData = await googleFetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          fileQuery
        )}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,parents)&orderBy=modifiedTime desc&pageSize=40`,
        token
      );

      const reports = (reportsData.files ?? []).map((f: any) => ({
        ...f,
        folderLabel:
          folderNameById.get(f.parents?.[0]) ?? 'CampusLytix',
      }));

      res.json({ folderInitialized: true, reports });
    } catch (error: any) {
      res.status(error.status || 502).json({
        error: error.message || 'Failed to load archived Drive reports.',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GOOGLE CALENDAR
// ---------------------------------------------------------------------------

router.get('/calendar/events', requireAuth, async (req: AuthRequest, res) => {
  const token = getGoogleToken(req, res);
  if (!token) return;

  try {
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&singleEvents=true&orderBy=startTime&maxResults=30`;

    const data = await googleFetch(url, token);
    const existingEvents = await db.select().from(events);
    const importedIds = new Set(
      existingEvents
        .map((e) => e.googleCalendarEventId)
        .filter((id): id is string => Boolean(id))
    );

    const items = (data.items ?? []).map((ev: any) => {
      const startRaw = ev.start?.dateTime || ev.start?.date || '';
      const endRaw = ev.end?.dateTime || ev.end?.date || '';
      return {
        googleEventId: ev.id,
        title: ev.summary || 'Untitled Event',
        description: ev.description || '',
        location: ev.location || 'Campus',
        eventDate: startRaw.slice(0, 10),
        startTime: startRaw.includes('T') ? startRaw.slice(11, 16) : '09:00',
        endTime: endRaw.includes('T') ? endRaw.slice(11, 16) : '11:00',
        htmlLink: ev.htmlLink || null,
        alreadyImported: importedIds.has(ev.id),
      };
    });

    res.json({ events: items });
  } catch (error: any) {
    res.status(error.status || 502).json({
      error: error.message || 'Failed to load Google Calendar events.',
    });
  }
});

router.post(
  '/calendar/import',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Select at least one calendar event to import.' });
    }

    try {
      let imported = 0;
      let skipped = 0;

      for (const item of items) {
        if (!item.googleEventId || !item.clubId || !item.title || !item.eventDate) {
          skipped++;
          continue;
        }
        const existing = await db
          .select()
          .from(events)
          .where(eq(events.googleCalendarEventId, item.googleEventId))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await db.insert(events).values({
          clubId: Number(item.clubId),
          title: String(item.title),
          description: item.description ? String(item.description) : null,
          eventDate: String(item.eventDate),
          startTime: String(item.startTime || '14:00'),
          endTime: String(item.endTime || '16:00'),
          location: String(item.location || 'Campus'),
          capacity: Number(item.capacity) || 60,
          googleCalendarEventId: String(item.googleEventId),
          source: 'Google Calendar',
        });
        imported++;
      }

      await db.insert(importHistory).values({
        source: 'Google Calendar',
        sourceName: 'Primary Google Calendar Sync',
        targetEntity: 'events',
        recordsTotal: items.length,
        recordsImported: imported,
        recordsSkipped: skipped,
        recordsFailed: 0,
        status: imported > 0 ? 'Completed' : 'No New Records',
        performedByUid: req.dbUser?.uid ?? null,
        performedByEmail: req.dbUser?.email ?? null,
      });

      await logIntegrationEvent({
        serviceKey: 'google_calendar',
        action: 'import_events',
        status: 'success',
        message: `Imported ${imported} calendar event(s) (${skipped} skipped).`,
        accountEmail: req.dbUser?.email,
      });

      res.json({ imported, skipped });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to import Google Calendar events.',
      });
    }
  }
);

router.post(
  '/calendar/export',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const token = getGoogleToken(req, res);
    if (!token) return;

    const { eventId, confirmed } = req.body ?? {};
    if (!confirmed) {
      return res.status(400).json({
        error: 'Explicit administrator confirmation is required before adding an event to Google Calendar.',
      });
    }

    try {
      const [ev] = await db
        .select()
        .from(events)
        .where(eq(events.id, Number(eventId)))
        .limit(1);

      if (!ev) {
        return res.status(404).json({ error: 'CampusLytix event not found.' });
      }
      if (ev.googleCalendarEventId) {
        return res.status(409).json({
          error: 'This event is already synchronized with Google Calendar.',
          googleCalendarEventId: ev.googleCalendarEventId,
        });
      }

      const [club] = await db
        .select()
        .from(clubs)
        .where(eq(clubs.id, ev.clubId))
        .limit(1);

      const startTime = ev.startTime || '14:00';
      const endTime = ev.endTime || '16:00';
      const payload = {
        summary: `${ev.title}${club ? ` — ${club.name}` : ''}`,
        location: ev.location || 'Campus',
        description: `${ev.description || ''}\n\nManaged by CampusLytix Institutional Analytics.`,
        start: {
          dateTime: `${ev.eventDate}T${startTime}:00Z`,
        },
        end: {
          dateTime: `${ev.eventDate}T${endTime}:00Z`,
        },
      };

      const created = await googleFetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      await db
        .update(events)
        .set({ googleCalendarEventId: created.id })
        .where(eq(events.id, ev.id));

      await logIntegrationEvent({
        serviceKey: 'google_calendar',
        action: 'create_event',
        status: 'success',
        message: `Added "${ev.title}" to Google Calendar.`,
        accountEmail: req.dbUser?.email,
      });

      res.json({
        googleCalendarEventId: created.id,
        htmlLink: created.htmlLink,
      });
    } catch (error: any) {
      res.status(error.status || 502).json({
        error:
          error.message ||
          'Failed to create Google Calendar event. Ensure write access is granted.',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GOOGLE FORMS
// ---------------------------------------------------------------------------

router.get('/forms/list', requireAuth, async (req: AuthRequest, res) => {
  const token = getGoogleToken(req, res);
  if (!token) return;

  try {
    const q = encodeURIComponent(
      "mimeType='application/vnd.google-apps.form' and trashed=false"
    );
    const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
    const data = await googleFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=25`,
      token
    );
    res.json({ forms: data.files ?? [] });
  } catch (error: any) {
    res.status(error.status || 502).json({
      error: error.message || 'Failed to list Google Forms.',
    });
  }
});

router.get('/forms/:formId', requireAuth, async (req: AuthRequest, res) => {
  const token = getGoogleToken(req, res);
  if (!token) return;

  const rawId = String(req.params.formId).trim();
  const safeFormId = encodeURIComponent(rawId);

  try {
    const formMeta = await googleFetch(
      `https://forms.googleapis.com/v1/forms/${safeFormId}`,
      token
    );

    const questionMap = new Map<string, string>();
    const headers: string[] = [];
    for (const item of formMeta.items ?? []) {
      const qId = item.questionItem?.question?.questionId;
      if (qId) {
        const title = item.title || `Question ${qId}`;
        questionMap.set(qId, title);
        headers.push(title);
      }
    }

    let rows: Record<string, string>[] = [];
    let responsesError: string | null = null;
    try {
      const respData = await googleFetch(
        `https://forms.googleapis.com/v1/forms/${safeFormId}/responses`,
        token
      );
      rows = (respData.responses ?? []).map((resp: any) => {
        const rowObj: Record<string, string> = {};
        if (resp.respondentEmail) {
          rowObj['Respondent Email'] = resp.respondentEmail;
        }
        for (const [qId, qTitle] of questionMap.entries()) {
          const ans = resp.answers?.[qId]?.textAnswers?.answers;
          rowObj[qTitle] = Array.isArray(ans)
            ? ans.map((a: any) => a.value).join(', ')
            : '';
        }
        return rowObj;
      });
      if (rows.some((r) => r['Respondent Email']) && !headers.includes('Respondent Email')) {
        headers.unshift('Respondent Email');
      }
    } catch (err: any) {
      responsesError =
        err.message ||
        'Direct Forms responses could not be read; use the linked Google Sheet destination if available.';
    }

    res.json({
      formId: formMeta.formId,
      title: formMeta.info?.title || 'Untitled Form',
      description: formMeta.info?.description || '',
      linkedSheetId: formMeta.linkedSheetId || null,
      headers,
      rows,
      responsesError,
    });
  } catch (error: any) {
    res.status(error.status || 502).json({
      error: error.message || 'Failed to fetch Google Form structure and responses.',
    });
  }
});

// ---------------------------------------------------------------------------
// LIVE CONNECTIVITY TESTS FOR WORKSPACE SERVICES
// ---------------------------------------------------------------------------

router.post('/test/:service', requireAuth, async (req: AuthRequest, res) => {
  const token = getGoogleToken(req, res);
  if (!token) return;

  const service = String(req.params.service);
  try {
    let message = '';
    if (service === 'google_sheets') {
      const data = await googleFetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
        )}&pageSize=1&fields=files(id,name)`,
        token
      );
      message = `Verified Sheets & Drive read access (${(data.files ?? []).length} sample spreadsheet checked).`;
    } else if (service === 'google_drive') {
      const data = await googleFetch(
        'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',
        token
      );
      message = `Verified Google Drive connectivity for ${data.user?.emailAddress || req.dbUser?.email}.`;
    } else if (service === 'google_calendar') {
      const data = await googleFetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1',
        token
      );
      message = `Verified Google Calendar access (${data.summary || 'primary calendar'}).`;
    } else if (service === 'google_forms') {
      const data = await googleFetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          "mimeType='application/vnd.google-apps.form' and trashed=false"
        )}&pageSize=1&fields=files(id,name)`,
        token
      );
      message = `Verified Google Forms discovery (${(data.files ?? []).length} form sample checked).`;
    } else {
      return res.status(400).json({ error: `Unknown Workspace service: ${service}` });
    }

    await logIntegrationEvent({
      serviceKey: service,
      action: 'test_connection',
      status: 'success',
      message,
      accountEmail: req.dbUser?.email,
    });

    res.json({ connected: true, service, message, testedAt: new Date().toISOString() });
  } catch (error: any) {
    const errMsg = error.message || `Live connectivity test failed for ${service}.`;
    await logIntegrationEvent({
      serviceKey: service,
      action: 'test_connection',
      status: 'error',
      message: errMsg,
      accountEmail: req.dbUser?.email,
    });
    res.status(error.status || 502).json({
      connected: false,
      service,
      error: errMsg,
    });
  }
});

export default router;
