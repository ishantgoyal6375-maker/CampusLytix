import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  attendance,
  blocks,
  clubActivities,
  clubLeadership,
  clubs,
  events,
  memberships,
  universities,
} from '../db/schema.ts';
import { ensureSeeded } from '../db/seed.ts';
import { ensureCgcStructureSeeded } from '../db/cgc-seed.ts';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  type AuthRequest,
} from '../middleware/auth.ts';

const router = Router();

function safeParseFieldVerification(raw: string | null) {
  const defaults = {
    name: 'CONFIRMED',
    operationalScope: 'PENDING_VERIFICATION',
    block: 'PENDING_VERIFICATION',
    leadership: 'PENDING_VERIFICATION',
    activities: 'DEMO',
  };
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

router.get('/directory', optionalAuth, async (_req, res) => {
  try {
    await ensureSeeded();
    await ensureCgcStructureSeeded();

    const [
      allUnis,
      allBlocks,
      cgcClubs,
      allLeadership,
      allActivities,
      allMemberships,
      allEvents,
      allAttendance,
    ] = await Promise.all([
      db.select().from(universities),
      db.select().from(blocks),
      db.select().from(clubs).where(eq(clubs.isCgcDirectory, true)),
      db.select().from(clubLeadership),
      db.select().from(clubActivities),
      db.select().from(memberships),
      db.select().from(events).orderBy(desc(events.eventDate)),
      db.select().from(attendance),
    ]);

    const blockById = new Map(allBlocks.map((b) => [b.id, b]));
    const clubById = new Map(cgcClubs.map((c) => [c.id, c]));

    // Maintain consistent institutional ordering (01 DSA -> 11 ICTSE, then any admin-added clubs)
    const preferredOrder = [
      'DSA', 'SAC', 'CSM', 'VNEST', 'DCC', 'DRR', 'NCC', 'NGO', 'ICA', 'D4C', 'ICTSE',
    ];
    const sortedClubs = [...cgcClubs].sort((a, b) => {
      const ia = preferredOrder.indexOf(a.code);
      const ib = preferredOrder.indexOf(b.code);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    const enrichedClubs = sortedClubs.map((club) => {
      const clubLeaders = allLeadership.filter((l) => l.clubId === club.id);
      const confirmedLeader =
        clubLeaders.find((l) => !l.isDemoPlaceholder && l.verificationStatus === 'CONFIRMED') ??
        clubLeaders.find((l) => !l.isDemoPlaceholder) ??
        null;
      const demoLeader = clubLeaders.find((l) => l.isDemoPlaceholder) ?? null;

      const verifiedBlock = club.blockId ? blockById.get(club.blockId) ?? null : null;
      const demoBlock = club.demoBlockId ? blockById.get(club.demoBlockId) ?? null : null;
      const parentClub = club.parentClubId ? clubById.get(club.parentClubId) ?? null : null;
      const childClubs = sortedClubs
        .filter((c) => c.parentClubId === club.id)
        .map((c) => ({ id: c.id, code: c.code, name: c.name, fullName: c.fullName }));

      const activities = allActivities.filter((a) => a.clubId === club.id);

      // Actual calculated PostgreSQL analytics metrics (separate from institutional distinction!)
      const clubMembers = allMemberships.filter((m) => m.clubId === club.id);
      const clubEvents = allEvents.filter((e) => e.clubId === club.id);
      const clubEventIds = new Set(clubEvents.map((e) => e.id));
      const clubAtt = allAttendance.filter((a) => clubEventIds.has(a.eventId));
      const present = clubAtt.filter((a) => a.status === 'Present').length;
      const resolved = clubAtt.filter(
        (a) => a.status === 'Present' || a.status === 'Absent'
      ).length;
      const attendanceRate =
        resolved > 0 ? Number(((present / resolved) * 100).toFixed(1)) : 0;

      // Monthly participation trend for this club
      const monthMap = new Map<string, { month: string; checkIns: number; events: number }>();
      clubEvents.forEach((ev) => {
        const ym = ev.eventDate.slice(0, 7);
        const cur = monthMap.get(ym) ?? { month: ym, checkIns: 0, events: 0 };
        cur.events += 1;
        cur.checkIns += allAttendance.filter(
          (a) => a.eventId === ev.id && a.status === 'Present'
        ).length;
        monthMap.set(ym, cur);
      });
      const participationTrends = Array.from(monthMap.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => {
          const [y, mo] = m.month.split('-');
          return {
            ...m,
            label: new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-US', {
              month: 'short',
              year: '2-digit',
            }),
          };
        });

      return {
        id: club.id,
        code: club.code,
        name: club.name,
        fullName: club.fullName || club.name,
        category: club.category,
        department: club.department,
        description: club.description,
        operationalIdentity: club.operationalIdentity,
        operationalScope: club.operationalScope,
        institutionalDistinction: club.institutionalDistinction,
        operationalStatus: club.operationalStatus,
        verificationStatus: club.verificationStatus,
        fieldVerification: safeParseFieldVerification(club.fieldVerification),
        isSyntheticData: club.isSyntheticData,
        blockId: club.blockId,
        demoBlockId: club.demoBlockId,
        verifiedBlock: verifiedBlock
          ? {
              id: verifiedBlock.id,
              code: verifiedBlock.code,
              blockName: verifiedBlock.blockName,
              schoolName: verifiedBlock.schoolName,
              blockHeadName: verifiedBlock.blockHeadName,
              blockHeadDesignation: verifiedBlock.blockHeadDesignation,
              verificationStatus: verifiedBlock.verificationStatus,
              isDemoPlaceholder: verifiedBlock.isDemoPlaceholder,
            }
          : null,
        demoBlock: demoBlock
          ? {
              id: demoBlock.id,
              code: demoBlock.code,
              blockName: demoBlock.blockName,
              schoolName: demoBlock.schoolName,
              blockHeadName: demoBlock.blockHeadName,
              blockHeadDesignation: demoBlock.blockHeadDesignation,
              verificationStatus: demoBlock.verificationStatus,
              isDemoPlaceholder: demoBlock.isDemoPlaceholder,
            }
          : null,
        parentClub: parentClub
          ? {
              id: parentClub.id,
              code: parentClub.code,
              name: parentClub.name,
              fullName: parentClub.fullName,
            }
          : null,
        childClubs,
        confirmedLeadership: confirmedLeader
          ? {
              id: confirmedLeader.id,
              supervisingAuthority: confirmedLeader.supervisingAuthority,
              authorityDesignation: confirmedLeader.authorityDesignation,
              coordinatorName: confirmedLeader.coordinatorName,
              coordinatorDesignation: confirmedLeader.coordinatorDesignation,
              effectiveFrom: confirmedLeader.effectiveFrom,
              effectiveTo: confirmedLeader.effectiveTo,
              verificationStatus: confirmedLeader.verificationStatus,
            }
          : null,
        demoLeadership: demoLeader
          ? {
              id: demoLeader.id,
              supervisingAuthority: demoLeader.supervisingAuthority,
              authorityDesignation: demoLeader.authorityDesignation,
              coordinatorName: demoLeader.coordinatorName,
              coordinatorDesignation: demoLeader.coordinatorDesignation,
              verificationStatus: demoLeader.verificationStatus,
            }
          : null,
        leadershipHistory: clubLeaders,
        activities,
        analytics: {
          memberCount: clubMembers.length,
          eventCount: clubEvents.length,
          totalCheckIns: present,
          attendanceRate,
          participationTrends,
          recentEvents: clubEvents.slice(0, 5).map((e) => ({
            id: e.id,
            title: e.title,
            eventDate: e.eventDate,
            location: e.location,
            presentCount: allAttendance.filter(
              (a) => a.eventId === e.id && a.status === 'Present'
            ).length,
          })),
        },
      };
    });

    // Block-wise verification summary (never assigning unknown blocks as confirmed numeric data)
    const verifiedBlocks = allBlocks.filter((b) => !b.isDemoPlaceholder);
    const demoBlocks = allBlocks.filter((b) => b.isDemoPlaceholder);

    const blockSummary = [
      ...verifiedBlocks.map((b) => ({
        blockId: b.id,
        code: b.code,
        blockName: b.blockName,
        schoolName: b.schoolName,
        blockHeadName: b.blockHeadName,
        blockHeadDesignation: b.blockHeadDesignation,
        verificationStatus: b.verificationStatus,
        isDemoPlaceholder: false,
        clubCount: enrichedClubs.filter((c) => c.blockId === b.id).length,
        clubs: enrichedClubs
          .filter((c) => c.blockId === b.id)
          .map((c) => ({ id: c.id, code: c.code, name: c.name, category: c.category })),
      })),
      {
        blockId: null,
        code: 'UNASSIGNED',
        blockName: 'Unassigned / Block Pending Verification',
        schoolName: 'Official block assignment not yet supplied',
        blockHeadName: null,
        blockHeadDesignation: null,
        verificationStatus: 'PENDING_VERIFICATION',
        isDemoPlaceholder: false,
        clubCount: enrichedClubs.filter((c) => !c.blockId).length,
        clubs: enrichedClubs
          .filter((c) => !c.blockId)
          .map((c) => ({ id: c.id, code: c.code, name: c.name, category: c.category })),
      },
    ];

    // Operational category distribution across the 11 clubs
    const catCountMap = new Map<string, number>();
    enrichedClubs.forEach((c) => {
      catCountMap.set(c.category, (catCountMap.get(c.category) ?? 0) + 1);
    });
    const categoryDistribution = Array.from(catCountMap.entries()).map(
      ([category, count]) => ({ category, count })
    );

    const verificationCounts = {
      confirmedClubs: enrichedClubs.filter((c) => c.verificationStatus === 'CONFIRMED').length,
      demoClubs: enrichedClubs.filter((c) => c.verificationStatus === 'DEMO').length,
      pendingClubs: enrichedClubs.filter((c) => c.verificationStatus === 'PENDING_VERIFICATION').length,
      confirmedBlocks: verifiedBlocks.length,
      confirmedHierarchies: enrichedClubs.filter(
        (c) => Boolean(c.blockId) && Boolean(c.confirmedLeadership)
      ).length,
      unverifiedHierarchies: enrichedClubs.filter(
        (c) => !c.blockId || !c.confirmedLeadership
      ).length,
    };

    res.json({
      university: allUnis[0] ?? { id: 1, code: 'CGC', universityName: 'CGC University' },
      blocks: allBlocks,
      verifiedBlocks,
      demoBlocks,
      clubs: enrichedClubs,
      blockSummary,
      categoryDistribution,
      verificationCounts,
    });
  } catch (error) {
    console.error('Failed to load CGC University directory:', error);
    res.status(500).json({ error: 'Unable to load CGC University club structure.' });
  }
});

// Admin: Create a new verified university block
router.post('/blocks', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { blockName, schoolName, blockHeadName, blockHeadDesignation, verificationStatus } =
    req.body ?? {};
  if (!blockName || !String(blockName).trim()) {
    return res.status(400).json({ error: 'Block name is required.' });
  }
  try {
    await ensureCgcStructureSeeded();
    const [uni] = await db
      .select()
      .from(universities)
      .where(eq(universities.code, 'CGC'))
      .limit(1);

    const code =
      'BLK-' +
      String(blockName)
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 6)
        .toUpperCase() +
      '-' +
      String(Date.now()).slice(-3);

    const [created] = await db
      .insert(blocks)
      .values({
        universityId: uni?.id ?? null,
        code,
        blockName: String(blockName).trim(),
        schoolName: schoolName ? String(schoolName).trim() : null,
        blockHeadName: blockHeadName ? String(blockHeadName).trim() : null,
        blockHeadDesignation: blockHeadDesignation
          ? String(blockHeadDesignation).trim()
          : null,
        isDemoPlaceholder: verificationStatus === 'DEMO',
        verificationStatus:
          verificationStatus === 'CONFIRMED' ||
          verificationStatus === 'DEMO' ||
          verificationStatus === 'PENDING_VERIFICATION'
            ? verificationStatus
            : 'CONFIRMED',
      })
      .returning();

    res.status(201).json({ block: created });
  } catch (error) {
    console.error('Failed to create block:', error);
    res.status(500).json({ error: 'Failed to create university block.' });
  }
});

// Admin: Add a newly confirmed club to CGC University directory
router.post('/clubs', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const {
    code,
    name,
    fullName,
    category,
    operationalIdentity,
    operationalScope,
    institutionalDistinction,
    description,
    blockId,
    parentClubId,
    verificationStatus,
    supervisingAuthority,
    authorityDesignation,
    coordinatorName,
    coordinatorDesignation,
  } = req.body ?? {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Club name is required.' });
  }

  try {
    await ensureCgcStructureSeeded();
    const [uni] = await db
      .select()
      .from(universities)
      .where(eq(universities.code, 'CGC'))
      .limit(1);

    const safeCode =
      (code && String(code).trim().toUpperCase()) ||
      String(name)
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 5)
        .toUpperCase() +
        String(Date.now()).slice(-2);

    const status =
      verificationStatus === 'CONFIRMED' ||
      verificationStatus === 'DEMO' ||
      verificationStatus === 'PENDING_VERIFICATION'
        ? verificationStatus
        : 'CONFIRMED';

    const fieldVerification = {
      name: 'CONFIRMED',
      operationalScope: operationalScope ? status : 'PENDING_VERIFICATION',
      block: blockId ? status : 'PENDING_VERIFICATION',
      leadership: supervisingAuthority || coordinatorName ? status : 'PENDING_VERIFICATION',
      activities: 'PENDING_VERIFICATION',
    };

    const [created] = await db
      .insert(clubs)
      .values({
        code: safeCode,
        name: String(name).trim(),
        fullName: fullName ? String(fullName).trim() : String(name).trim(),
        category: String(category || 'All-Rounder').trim(),
        department: 'CGC University',
        facultyAdvisor: coordinatorName ? String(coordinatorName).trim() : null,
        description: description ? String(description).trim() : null,
        operationalIdentity: operationalIdentity ? String(operationalIdentity).trim() : null,
        operationalScope: operationalScope ? String(operationalScope).trim() : null,
        institutionalDistinction: institutionalDistinction
          ? String(institutionalDistinction).trim()
          : null,
        universityId: uni?.id ?? null,
        blockId: blockId ? Number(blockId) : null,
        parentClubId: parentClubId ? Number(parentClubId) : null,
        operationalStatus: 'Active',
        verificationStatus: status,
        fieldVerification: JSON.stringify(fieldVerification),
        isCgcDirectory: true,
        isSyntheticData: false,
      })
      .returning();

    if (supervisingAuthority || coordinatorName) {
      await db.insert(clubLeadership).values({
        clubId: created.id,
        supervisingAuthority: supervisingAuthority
          ? String(supervisingAuthority).trim()
          : null,
        authorityDesignation: authorityDesignation
          ? String(authorityDesignation).trim()
          : null,
        coordinatorName: coordinatorName ? String(coordinatorName).trim() : null,
        coordinatorDesignation: coordinatorDesignation
          ? String(coordinatorDesignation).trim()
          : null,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        isDemoPlaceholder: status === 'DEMO',
        verificationStatus: status,
      });
    }

    res.status(201).json({ club: created });
  } catch (error: any) {
    console.error('Failed to add club:', error);
    res.status(500).json({ error: error?.message || 'Failed to add club.' });
  }
});

// Admin: Edit club block assignment, leadership, operational scope, parent relationship, and verification status
router.patch('/clubs/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const clubId = Number(req.params.id);
  const {
    name,
    fullName,
    category,
    operationalIdentity,
    operationalScope,
    institutionalDistinction,
    description,
    blockId,
    parentClubId,
    verificationStatus,
    fieldVerification,
    supervisingAuthority,
    authorityDesignation,
    coordinatorName,
    coordinatorDesignation,
    leadershipVerificationStatus,
  } = req.body ?? {};

  try {
    const [existing] = await db
      .select()
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Club not found.' });
    }

    const currentFv = safeParseFieldVerification(existing.fieldVerification);
    const nextFv = {
      ...currentFv,
      ...(fieldVerification && typeof fieldVerification === 'object'
        ? fieldVerification
        : {}),
    };

    const parsedBlockId =
      blockId === '' || blockId === null || blockId === undefined
        ? null
        : Number(blockId);
    const parsedParentId =
      parentClubId === '' || parentClubId === null || parentClubId === undefined
        ? null
        : Number(parentClubId);

    if (parsedParentId === clubId) {
      return res.status(400).json({ error: 'A club cannot be its own parent.' });
    }

    const [updated] = await db
      .update(clubs)
      .set({
        name: name !== undefined ? String(name).trim() : existing.name,
        fullName: fullName !== undefined ? String(fullName).trim() : existing.fullName,
        category: category !== undefined ? String(category).trim() : existing.category,
        operationalIdentity:
          operationalIdentity !== undefined
            ? String(operationalIdentity).trim()
            : existing.operationalIdentity,
        operationalScope:
          operationalScope !== undefined
            ? String(operationalScope).trim()
            : existing.operationalScope,
        institutionalDistinction:
          institutionalDistinction !== undefined
            ? String(institutionalDistinction).trim() || null
            : existing.institutionalDistinction,
        description:
          description !== undefined
            ? String(description).trim() || null
            : existing.description,
        blockId: blockId !== undefined ? parsedBlockId : existing.blockId,
        parentClubId: parentClubId !== undefined ? parsedParentId : existing.parentClubId,
        facultyAdvisor:
          coordinatorName !== undefined
            ? String(coordinatorName).trim() || null
            : existing.facultyAdvisor,
        verificationStatus:
          verificationStatus === 'CONFIRMED' ||
          verificationStatus === 'DEMO' ||
          verificationStatus === 'PENDING_VERIFICATION'
            ? verificationStatus
            : existing.verificationStatus,
        fieldVerification: JSON.stringify(nextFv),
      })
      .where(eq(clubs.id, clubId))
      .returning();

    // Update or create real (non-demo) leadership entry when leadership fields are provided
    if (
      supervisingAuthority !== undefined ||
      authorityDesignation !== undefined ||
      coordinatorName !== undefined ||
      coordinatorDesignation !== undefined
    ) {
      const hasAnyValue = Boolean(
        (supervisingAuthority && String(supervisingAuthority).trim()) ||
          (coordinatorName && String(coordinatorName).trim())
      );

      const existingReal = await db
        .select()
        .from(clubLeadership)
        .where(eq(clubLeadership.clubId, clubId));

      const nonDemo = existingReal.find((l) => !l.isDemoPlaceholder);
      const leaderStatus =
        leadershipVerificationStatus === 'CONFIRMED' ||
        leadershipVerificationStatus === 'DEMO' ||
        leadershipVerificationStatus === 'PENDING_VERIFICATION'
          ? leadershipVerificationStatus
          : hasAnyValue
          ? 'CONFIRMED'
          : 'PENDING_VERIFICATION';

      if (nonDemo) {
        await db
          .update(clubLeadership)
          .set({
            supervisingAuthority: supervisingAuthority
              ? String(supervisingAuthority).trim()
              : null,
            authorityDesignation: authorityDesignation
              ? String(authorityDesignation).trim()
              : null,
            coordinatorName: coordinatorName ? String(coordinatorName).trim() : null,
            coordinatorDesignation: coordinatorDesignation
              ? String(coordinatorDesignation).trim()
              : null,
            verificationStatus: leaderStatus,
          })
          .where(eq(clubLeadership.id, nonDemo.id));
      } else if (hasAnyValue) {
        await db.insert(clubLeadership).values({
          clubId,
          supervisingAuthority: supervisingAuthority
            ? String(supervisingAuthority).trim()
            : null,
          authorityDesignation: authorityDesignation
            ? String(authorityDesignation).trim()
            : null,
          coordinatorName: coordinatorName ? String(coordinatorName).trim() : null,
          coordinatorDesignation: coordinatorDesignation
            ? String(coordinatorDesignation).trim()
            : null,
          effectiveFrom: new Date().toISOString().slice(0, 10),
          isDemoPlaceholder: false,
          verificationStatus: leaderStatus,
        });
      }
    }

    res.json({ club: updated });
  } catch (error) {
    console.error('Failed to update club structure:', error);
    res.status(500).json({ error: 'Failed to save club updates.' });
  }
});

// Admin: Add operational activity to a club
router.post(
  '/clubs/:id/activities',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const clubId = Number(req.params.id);
    const { activityName, activityCategory, description, verificationStatus } =
      req.body ?? {};

    if (!activityName || !String(activityName).trim()) {
      return res.status(400).json({ error: 'Activity name is required.' });
    }
    try {
      const [created] = await db
        .insert(clubActivities)
        .values({
          clubId,
          activityName: String(activityName).trim(),
          activityCategory: String(activityCategory || 'General').trim(),
          description: description ? String(description).trim() : null,
          verificationStatus:
            verificationStatus === 'CONFIRMED' ||
            verificationStatus === 'DEMO' ||
            verificationStatus === 'PENDING_VERIFICATION'
              ? verificationStatus
              : 'CONFIRMED',
        })
        .returning();
      res.status(201).json({ activity: created });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add club activity.' });
    }
  }
);

router.delete(
  '/activities/:activityId',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      await db
        .delete(clubActivities)
        .where(eq(clubActivities.id, Number(req.params.activityId)));
      res.json({ deleted: true });
    } catch {
      res.status(500).json({ error: 'Failed to remove activity.' });
    }
  }
);

export default router;
