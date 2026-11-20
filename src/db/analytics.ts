import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  attendance,
  blocks,
  clubs,
  events,
  importHistory,
  integrationLogs,
  memberships,
  students,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import { ensureCgcStructureSeeded } from './cgc-seed.ts';

export interface AnalyticsFilters {
  department?: string;
  category?: string;
  month?: string;
}

export async function getDashboardAnalytics(filters: AnalyticsFilters = {}) {
  try {
    await ensureSeeded();
    await ensureCgcStructureSeeded();

    const [
      allClubs,
      allBlocks,
      allStudents,
      allMemberships,
      allEvents,
      allAttendance,
      recentImports,
    ] = await Promise.all([
      db.select().from(clubs),
      db.select().from(blocks),
      db.select().from(students),
      db.select().from(memberships),
      db.select().from(events).orderBy(desc(events.eventDate)),
      db.select().from(attendance),
      db.select().from(importHistory).orderBy(desc(importHistory.createdAt)).limit(25),
    ]);

    const blockById = new Map(allBlocks.map((b) => [b.id, b]));

    const deptFilter =
      filters.department && filters.department !== 'All' ? filters.department : null;
    const catFilter =
      filters.category && filters.category !== 'All' ? filters.category : null;
    const monthFilter =
      filters.month && filters.month !== 'All' ? filters.month : null;

    const filteredStudents = deptFilter
      ? allStudents.filter((s) => s.department === deptFilter)
      : allStudents;
    const filteredStudentIds = new Set(filteredStudents.map((s) => s.id));

    const filteredClubs = catFilter
      ? allClubs.filter((c) => c.category === catFilter)
      : allClubs;
    const filteredClubIds = new Set(filteredClubs.map((c) => c.id));

    const filteredMemberships = allMemberships.filter(
      (m) =>
        filteredStudentIds.has(m.studentId) &&
        filteredClubIds.has(m.clubId) &&
        (!monthFilter || m.joinedAt.startsWith(monthFilter))
    );

    const filteredEvents = allEvents.filter(
      (e) =>
        filteredClubIds.has(e.clubId) &&
        (!monthFilter || e.eventDate.startsWith(monthFilter))
    );
    const filteredEventIds = new Set(filteredEvents.map((e) => e.id));

    const filteredAttendance = allAttendance.filter(
      (a) =>
        filteredEventIds.has(a.eventId) && filteredStudentIds.has(a.studentId)
    );

    const presentRecords = filteredAttendance.filter((a) => a.status === 'Present');
    const resolvedAttendanceRecords = filteredAttendance.filter(
      (a) => a.status === 'Present' || a.status === 'Absent'
    );

    const engagedStudentIds = new Set<number>();
    filteredMemberships.forEach((m) => engagedStudentIds.add(m.studentId));
    presentRecords.forEach((a) => engagedStudentIds.add(a.studentId));

    const totalStudents = filteredStudents.length;
    const engagedStudents = engagedStudentIds.size;
    const engagementRate =
      totalStudents > 0
        ? Number(((engagedStudents / totalStudents) * 100).toFixed(1))
        : 0;

    const avgAttendanceRate =
      resolvedAttendanceRecords.length > 0
        ? Number(
            ((presentRecords.length / resolvedAttendanceRecords.length) * 100).toFixed(1)
          )
        : 0;

    const clubById = new Map(allClubs.map((c) => [c.id, c]));

    // Club Popularity & Attendance vs Membership
    const clubRankings = filteredClubs
      .map((club) => {
        const clubMembers = filteredMemberships.filter((m) => m.clubId === club.id);
        const clubEvents = filteredEvents.filter((e) => e.clubId === club.id);
        const clubEventIds = new Set(clubEvents.map((e) => e.id));
        const clubAtt = filteredAttendance.filter((a) => clubEventIds.has(a.eventId));
        const clubPresent = clubAtt.filter((a) => a.status === 'Present');
        const clubResolved = clubAtt.filter(
          (a) => a.status === 'Present' || a.status === 'Absent'
        );
        const uniqueAttendees = new Set(clubPresent.map((a) => a.studentId)).size;
        const avgEventTurnout =
          clubEvents.length > 0
            ? Number((clubPresent.length / clubEvents.length).toFixed(1))
            : 0;
        const attendanceRate =
          clubResolved.length > 0
            ? Number(((clubPresent.length / clubResolved.length) * 100).toFixed(1))
            : 0;

        const verifiedBlock = club.blockId ? blockById.get(club.blockId) : null;

        return {
          id: club.id,
          code: club.code,
          name: club.name,
          fullName: club.fullName || club.name,
          category: club.category,
          department: club.department,
          facultyAdvisor: club.facultyAdvisor,
          institutionalDistinction: club.institutionalDistinction,
          operationalIdentity: club.operationalIdentity,
          verificationStatus: club.verificationStatus,
          isCgcDirectory: club.isCgcDirectory,
          isSyntheticData: club.isSyntheticData,
          verifiedBlockName:
            verifiedBlock && !verifiedBlock.isDemoPlaceholder ? verifiedBlock.blockName : null,
          memberCount: clubMembers.length,
          eventCount: clubEvents.length,
          totalCheckIns: clubPresent.length,
          uniqueAttendees,
          avgEventTurnout,
          attendanceRate,
          participationRatio:
            clubMembers.length > 0
              ? Number(((uniqueAttendees / clubMembers.length) * 100).toFixed(1))
              : 0,
        };
      })
      .sort((a, b) => b.memberCount - a.memberCount);

    // Department Engagement Breakdown
    const departments = Array.from(new Set(allStudents.map((s) => s.department))).sort();
    const departmentAnalytics = departments
      .map((dept) => {
        const deptStudents = allStudents.filter((s) => s.department === dept);
        const deptStudentIds = new Set(deptStudents.map((s) => s.id));
        const deptMemberships = allMemberships.filter(
          (m) => deptStudentIds.has(m.studentId) && filteredClubIds.has(m.clubId)
        );
        const deptPresent = allAttendance.filter(
          (a) =>
            deptStudentIds.has(a.studentId) &&
            filteredEventIds.has(a.eventId) &&
            a.status === 'Present'
        );
        const deptEngaged = new Set([
          ...deptMemberships.map((m) => m.studentId),
          ...deptPresent.map((a) => a.studentId),
        ]);

        // Top club in department
        const clubCounts = new Map<number, number>();
        deptMemberships.forEach((m) =>
          clubCounts.set(m.clubId, (clubCounts.get(m.clubId) ?? 0) + 1)
        );
        let topClubName = 'None';
        let maxCount = 0;
        clubCounts.forEach((cnt, cid) => {
          if (cnt > maxCount) {
            maxCount = cnt;
            topClubName = clubById.get(cid)?.name ?? 'Unknown';
          }
        });

        return {
          department: dept,
          totalStudents: deptStudents.length,
          engagedStudents: deptEngaged.size,
          engagementRate:
            deptStudents.length > 0
              ? Number(((deptEngaged.size / deptStudents.length) * 100).toFixed(1))
              : 0,
          totalMemberships: deptMemberships.length,
          totalAttendances: deptPresent.length,
          topClub: topClubName,
        };
      })
      .sort((a, b) => b.engagementRate - a.engagementRate);

    // Monthly Participation Trends
    const monthSet = new Set<string>();
    allEvents.forEach((e) => monthSet.add(e.eventDate.slice(0, 7)));
    allMemberships.forEach((m) => monthSet.add(m.joinedAt.slice(0, 7)));
    const sortedMonths = Array.from(monthSet).sort();

    const monthlyTrends = sortedMonths.map((ym) => {
      const monthEvents = filteredEvents.filter((e) => e.eventDate.startsWith(ym));
      const monthEventIds = new Set(monthEvents.map((e) => e.id));
      const monthPresent = filteredAttendance.filter(
        (a) => monthEventIds.has(a.eventId) && a.status === 'Present'
      );
      const monthRegistered = filteredAttendance.filter(
        (a) => monthEventIds.has(a.eventId) && a.status === 'Registered'
      );
      const newMemberships = filteredMemberships.filter((m) =>
        m.joinedAt.startsWith(ym)
      ).length;
      const uniqueParticipants = new Set(monthPresent.map((a) => a.studentId)).size;

      const [year, m] = ym.split('-');
      const label = new Date(Number(year), Number(m) - 1, 1).toLocaleDateString(
        'en-US',
        { month: 'short', year: '2-digit' }
      );

      return {
        month: ym,
        label,
        eventsHeld: monthEvents.length,
        checkIns: monthPresent.length,
        registrations: monthRegistered.length,
        uniqueParticipants,
        newMemberships,
      };
    });

    // Event Analytics List
    const eventsList = filteredEvents.map((ev) => {
      const club = clubById.get(ev.clubId);
      const evAtt = filteredAttendance.filter((a) => a.eventId === ev.id);
      const present = evAtt.filter((a) => a.status === 'Present').length;
      const registered = evAtt.filter((a) => a.status === 'Registered').length;
      const absent = evAtt.filter((a) => a.status === 'Absent').length;
      const resolved = present + absent;
      return {
        id: ev.id,
        clubId: ev.clubId,
        clubName: club?.name ?? 'Unknown Club',
        clubCode: club?.code ?? 'CLB',
        title: ev.title,
        description: ev.description,
        eventDate: ev.eventDate,
        startTime: ev.startTime,
        endTime: ev.endTime,
        location: ev.location,
        capacity: ev.capacity,
        presentCount: present,
        registeredCount: registered,
        attendanceRate:
          resolved > 0 ? Number(((present / resolved) * 100).toFixed(1)) : null,
        googleCalendarEventId: ev.googleCalendarEventId,
        source: ev.source,
      };
    });

    const categories = Array.from(new Set(allClubs.map((c) => c.category))).sort();

    return {
      kpis: {
        totalStudents,
        activeClubs: filteredClubs.length,
        cgcDirectoryClubCount: allClubs.filter((c) => c.isCgcDirectory).length,
        totalMemberships: filteredMemberships.length,
        engagedStudents,
        engagementRate,
        totalEvents: filteredEvents.length,
        totalCheckIns: presentRecords.length,
        avgAttendanceRate,
        hasSyntheticData: allClubs.some((c) => c.isSyntheticData),
      },
      clubRankings,
      departmentAnalytics,
      monthlyTrends,
      eventsList,
      recentImports,
      filterOptions: {
        departments,
        categories,
        months: sortedMonths,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Analytics query failed:', error);
    throw new Error('Failed to load ClubPulse analytics data.', { cause: error });
  }
}

export interface ValidationResult {
  validRows: Record<string, string>[];
  duplicates: Array<{ rowIndex: number; reason: string; row: Record<string, string> }>;
  errors: Array<{ rowIndex: number; reason: string; row: Record<string, string> }>;
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    invalid: number;
  };
}

export async function validateImportRows(
  targetEntity: string,
  rows: Record<string, string>[]
): Promise<ValidationResult> {
  try {
    await ensureSeeded();

    const validRows: Record<string, string>[] = [];
    const duplicates: ValidationResult['duplicates'] = [];
    const errors: ValidationResult['errors'] = [];

    if (targetEntity === 'students') {
      const existing = await db.select().from(students);
      const existingEmails = new Set(existing.map((s) => s.email.toLowerCase()));
      const existingCodes = new Set(existing.map((s) => s.studentCode.toLowerCase()));
      const seenEmails = new Set<string>();

      rows.forEach((row, idx) => {
        const fullName = (row.fullName ?? '').trim();
        const email = (row.email ?? '').trim().toLowerCase();
        const department = (row.department ?? '').trim() || 'Computer Science';
        const studentCode =
          (row.studentCode ?? '').trim() || `STU-${Date.now().toString().slice(-4)}${idx}`;

        if (!fullName || !email || !email.includes('@')) {
          errors.push({
            rowIndex: idx + 1,
            reason: !fullName
              ? 'Missing required student full name'
              : 'Missing or invalid student email address',
            row,
          });
          return;
        }
        if (
          existingEmails.has(email) ||
          existingCodes.has(studentCode.toLowerCase()) ||
          seenEmails.has(email)
        ) {
          duplicates.push({
            rowIndex: idx + 1,
            reason: `Duplicate student email or code (${email})`,
            row,
          });
          return;
        }
        seenEmails.add(email);
        validRows.push({
          studentCode,
          fullName,
          email,
          department,
          academicYear: String(Math.min(4, Math.max(1, Number(row.academicYear) || 2))),
          clubName: (row.clubName ?? '').trim(),
        });
      });
    } else if (targetEntity === 'clubs') {
      const existing = await db.select().from(clubs);
      const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
      const existingCodes = new Set(existing.map((c) => c.code.toLowerCase()));
      const seenNames = new Set<string>();

      rows.forEach((row, idx) => {
        const name = (row.name ?? '').trim();
        const code =
          (row.code ?? '').trim().toUpperCase() ||
          name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() + idx;
        const category = (row.category ?? '').trim() || 'Technical';
        const department = (row.department ?? '').trim() || 'Computer Science';

        if (!name) {
          errors.push({ rowIndex: idx + 1, reason: 'Missing club name', row });
          return;
        }
        if (
          existingNames.has(name.toLowerCase()) ||
          existingCodes.has(code.toLowerCase()) ||
          seenNames.has(name.toLowerCase())
        ) {
          duplicates.push({
            rowIndex: idx + 1,
            reason: `Club already exists (${name})`,
            row,
          });
          return;
        }
        seenNames.add(name.toLowerCase());
        validRows.push({
          code,
          name,
          category,
          department,
          facultyAdvisor: (row.facultyAdvisor ?? '').trim(),
          description: (row.description ?? '').trim(),
        });
      });
    } else if (targetEntity === 'events') {
      const existingClubs = await db.select().from(clubs);
      const clubByName = new Map(existingClubs.map((c) => [c.name.toLowerCase(), c]));
      const clubByCode = new Map(existingClubs.map((c) => [c.code.toLowerCase(), c]));
      const existingEvents = await db.select().from(events);
      const existingKeys = new Set(
        existingEvents.map((e) => `${e.title.toLowerCase()}|${e.eventDate}`)
      );

      rows.forEach((row, idx) => {
        const title = (row.title ?? '').trim();
        const eventDate = (row.eventDate ?? '').trim();
        const clubRef = (row.clubName ?? row.clubCode ?? '').trim().toLowerCase();
        const matchedClub =
          clubByName.get(clubRef) || clubByCode.get(clubRef) || existingClubs[0];

        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
          errors.push({
            rowIndex: idx + 1,
            reason: !title
              ? 'Missing event title'
              : 'Event date must be YYYY-MM-DD',
            row,
          });
          return;
        }
        const key = `${title.toLowerCase()}|${eventDate}`;
        if (existingKeys.has(key)) {
          duplicates.push({
            rowIndex: idx + 1,
            reason: `Duplicate event on ${eventDate}`,
            row,
          });
          return;
        }
        existingKeys.add(key);
        validRows.push({
          clubId: String(matchedClub.id),
          clubName: matchedClub.name,
          title,
          eventDate,
          startTime: (row.startTime ?? '14:00').trim(),
          endTime: (row.endTime ?? '16:00').trim(),
          location: (row.location ?? 'Campus Auditorium').trim(),
          capacity: String(Number(row.capacity) || 60),
          description: (row.description ?? '').trim(),
        });
      });
    } else if (targetEntity === 'memberships') {
      const [allStudents, allClubs, existingMemberships] = await Promise.all([
        db.select().from(students),
        db.select().from(clubs),
        db.select().from(memberships),
      ]);
      const studentByEmail = new Map(allStudents.map((s) => [s.email.toLowerCase(), s]));
      const clubByName = new Map(allClubs.map((c) => [c.name.toLowerCase(), c]));
      const clubByCode = new Map(allClubs.map((c) => [c.code.toLowerCase(), c]));
      const existingPairs = new Set(
        existingMemberships.map((m) => `${m.studentId}|${m.clubId}`)
      );

      rows.forEach((row, idx) => {
        const email = (row.email ?? '').trim().toLowerCase();
        const clubRef = (row.clubName ?? row.clubCode ?? '').trim().toLowerCase();
        const student = studentByEmail.get(email);
        const club = clubByName.get(clubRef) || clubByCode.get(clubRef);

        if (!email || !email.includes('@')) {
          errors.push({ rowIndex: idx + 1, reason: 'Invalid student email', row });
          return;
        }
        if (!club) {
          errors.push({
            rowIndex: idx + 1,
            reason: `Unrecognized club "${row.clubName || row.clubCode || ''}"`,
            row,
          });
          return;
        }
        if (student && existingPairs.has(`${student.id}|${club.id}`)) {
          duplicates.push({
            rowIndex: idx + 1,
            reason: `${email} is already a member of ${club.name}`,
            row,
          });
          return;
        }
        validRows.push({
          email,
          fullName: (row.fullName ?? email.split('@')[0]).trim(),
          department: (row.department ?? 'Computer Science').trim(),
          clubId: String(club.id),
          clubName: club.name,
          role: (row.role ?? 'Member').trim() || 'Member',
          joinedAt: (row.joinedAt ?? new Date().toISOString().slice(0, 10)).trim(),
        });
      });
    }

    return {
      validRows,
      duplicates,
      errors,
      summary: {
        total: rows.length,
        valid: validRows.length,
        duplicates: duplicates.length,
        invalid: errors.length,
      },
    };
  } catch (error) {
    console.error('Validation failed:', error);
    throw new Error('Failed to validate import dataset.', { cause: error });
  }
}

export async function commitImportRows(params: {
  targetEntity: string;
  rows: Record<string, string>[];
  source: string;
  sourceName: string;
  performedByUid?: string;
  performedByEmail?: string;
}) {
  const validation = await validateImportRows(params.targetEntity, params.rows);
  let importedCount = 0;

  try {
    if (params.targetEntity === 'students') {
      const allClubs = await db.select().from(clubs);
      const clubByName = new Map(allClubs.map((c) => [c.name.toLowerCase(), c]));

      for (const row of validation.validRows) {
        const inserted = await db
          .insert(students)
          .values({
            studentCode: row.studentCode,
            fullName: row.fullName,
            email: row.email,
            department: row.department,
            academicYear: Number(row.academicYear) || 2,
          })
          .onConflictDoNothing()
          .returning();

        if (inserted.length > 0) {
          importedCount++;
          if (row.clubName) {
            const matchedClub = clubByName.get(row.clubName.toLowerCase());
            if (matchedClub) {
              await db
                .insert(memberships)
                .values({
                  studentId: inserted[0].id,
                  clubId: matchedClub.id,
                  role: 'Member',
                  joinedAt: new Date().toISOString().slice(0, 10),
                  status: 'Active',
                })
                .onConflictDoNothing();
            }
          }
        }
      }
    } else if (params.targetEntity === 'clubs') {
      for (const row of validation.validRows) {
        const inserted = await db
          .insert(clubs)
          .values({
            code: row.code,
            name: row.name,
            category: row.category,
            department: row.department,
            facultyAdvisor: row.facultyAdvisor || 'TBD',
            description: row.description || `${row.name} student organization.`,
          })
          .onConflictDoNothing()
          .returning();
        if (inserted.length > 0) importedCount++;
      }
    } else if (params.targetEntity === 'events') {
      for (const row of validation.validRows) {
        const inserted = await db
          .insert(events)
          .values({
            clubId: Number(row.clubId),
            title: row.title,
            description: row.description || null,
            eventDate: row.eventDate,
            startTime: row.startTime,
            endTime: row.endTime,
            location: row.location,
            capacity: Number(row.capacity) || 60,
            source: params.source,
          })
          .returning();
        if (inserted.length > 0) importedCount++;
      }
    } else if (params.targetEntity === 'memberships') {
      for (const row of validation.validRows) {
        let studentRows = await db
          .select()
          .from(students)
          .where(eq(students.email, row.email))
          .limit(1);

        let studentId = studentRows[0]?.id;
        if (!studentId) {
          const created = await db
            .insert(students)
            .values({
              studentCode: `STU-${Date.now().toString().slice(-5)}${importedCount}`,
              fullName: row.fullName,
              email: row.email,
              department: row.department,
              academicYear: 2,
            })
            .onConflictDoNothing()
            .returning();
          studentId = created[0]?.id;
        }
        if (studentId) {
          const inserted = await db
            .insert(memberships)
            .values({
              studentId,
              clubId: Number(row.clubId),
              role: row.role,
              joinedAt: row.joinedAt,
              status: 'Active',
            })
            .onConflictDoNothing()
            .returning();
          if (inserted.length > 0) importedCount++;
        }
      }
    }

    const [historyRecord] = await db
      .insert(importHistory)
      .values({
        source: params.source,
        sourceName: params.sourceName,
        targetEntity: params.targetEntity,
        recordsTotal: params.rows.length,
        recordsImported: importedCount,
        recordsSkipped: validation.duplicates.length,
        recordsFailed: validation.errors.length,
        status: importedCount > 0 ? 'Completed' : 'No New Records',
        performedByUid: params.performedByUid ?? null,
        performedByEmail: params.performedByEmail ?? null,
      })
      .returning();

    return {
      importedCount,
      skippedCount: validation.duplicates.length,
      failedCount: validation.errors.length,
      historyRecord,
    };
  } catch (error) {
    console.error('Import commit failed:', error);
    throw new Error('Failed to import validated records into PostgreSQL.', {
      cause: error,
    });
  }
}

export async function logIntegrationEvent(params: {
  serviceKey: string;
  action: string;
  status: 'success' | 'error';
  message: string;
  accountEmail?: string | null;
}) {
  try {
    await db.insert(integrationLogs).values({
      serviceKey: params.serviceKey,
      action: params.action,
      status: params.status,
      message: params.message,
      accountEmail: params.accountEmail ?? null,
    });
  } catch (error) {
    console.error('Failed to record integration log:', error);
  }
}
