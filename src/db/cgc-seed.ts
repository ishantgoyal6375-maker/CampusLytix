import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  blocks,
  clubActivities,
  clubLeadership,
  clubs,
  universities,
} from './schema.ts';

let cgcSeedPromise: Promise<void> | null = null;

interface FieldVerificationMap {
  name: 'CONFIRMED' | 'DEMO' | 'PENDING_VERIFICATION';
  operationalScope: 'CONFIRMED' | 'DEMO' | 'PENDING_VERIFICATION';
  block: 'CONFIRMED' | 'DEMO' | 'PENDING_VERIFICATION';
  leadership: 'CONFIRMED' | 'DEMO' | 'PENDING_VERIFICATION';
  activities: 'CONFIRMED' | 'DEMO' | 'PENDING_VERIFICATION';
}

interface CgcClubSpec {
  code: string;
  name: string;
  fullName: string;
  category: string;
  department: string;
  operationalIdentity: string;
  operationalScope: string;
  institutionalDistinction: string | null;
  description: string;
  verifiedBlockCode: string | null;
  demoBlockCode: string;
  parentClubCode: string | null;
  verificationStatus: 'CONFIRMED' | 'DEMO' | 'PENDING_VERIFICATION';
  fieldVerification: FieldVerificationMap;
  confirmedLeadership?: {
    supervisingAuthority: string;
    authorityDesignation: string | null;
    coordinatorName: string;
    coordinatorDesignation: string;
  };
  activities: Array<{
    activityName: string;
    activityCategory: string;
    description: string;
    verificationStatus: 'CONFIRMED' | 'DEMO' | 'PENDING_VERIFICATION';
  }>;
}

const CGC_BLOCKS = [
  {
    code: 'BLK-6',
    blockName: 'Block 6 — TechX School of Engineering',
    schoolName: 'TechX School of Engineering (TechX SOE)',
    blockHeadName: 'Dr. Sugandhi Malhotra',
    blockHeadDesignation: 'Associate Dean, TechX School of Engineering',
    isDemoPlaceholder: false,
    verificationStatus: 'CONFIRMED',
  },
  {
    code: 'BLK-R3',
    blockName: 'Ramanujan Block – 3',
    schoolName: null,
    blockHeadName: 'Dr. Ati Priye',
    blockHeadDesignation: null, // Intentionally unverified — designation not supplied
    isDemoPlaceholder: false,
    verificationStatus: 'CONFIRMED',
  },
  {
    code: 'DEMO-BLK-A',
    blockName: 'Sample Block A — DEMO ONLY',
    schoolName: 'Illustrative Student Affairs & Governance Wing (DEMO)',
    blockHeadName: 'Sample Supervising Authority',
    blockHeadDesignation: 'Role-Based Placeholder (Demo Only)',
    isDemoPlaceholder: true,
    verificationStatus: 'DEMO',
  },
  {
    code: 'DEMO-BLK-B',
    blockName: 'Sample Block B — DEMO ONLY',
    schoolName: 'Illustrative Technology & Computing Wing (DEMO)',
    blockHeadName: 'Sample Supervising Authority',
    blockHeadDesignation: 'Role-Based Placeholder (Demo Only)',
    isDemoPlaceholder: true,
    verificationStatus: 'DEMO',
  },
  {
    code: 'DEMO-BLK-C',
    blockName: 'Sample Block C — DEMO ONLY',
    schoolName: 'Illustrative Campus Activities & Outreach Wing (DEMO)',
    blockHeadName: 'Sample Supervising Authority',
    blockHeadDesignation: 'Role-Based Placeholder (Demo Only)',
    isDemoPlaceholder: true,
    verificationStatus: 'DEMO',
  },
];

const CGC_CLUB_SPECS: CgcClubSpec[] = [
  {
    code: 'DSA',
    name: 'DSA',
    fullName: 'Department of Student Affairs (DSA)',
    category: 'All-Rounder',
    department: 'University-Wide',
    operationalIdentity: 'University-Wide All-Rounder Club',
    operationalScope:
      'Broad student activities, university-wide student engagement, multiple extracurricular responsibilities, and general student affairs activities.',
    institutionalDistinction: "UNIVERSITY'S BIGGEST CLUB",
    description:
      'Major university-level all-rounder student organisation overseeing broad extracurricular responsibilities and campus-wide student affairs at CGC University.',
    verifiedBlockCode: null,
    demoBlockCode: 'DEMO-BLK-A',
    parentClubCode: null,
    verificationStatus: 'CONFIRMED',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'CONFIRMED',
      block: 'PENDING_VERIFICATION',
      leadership: 'PENDING_VERIFICATION',
      activities: 'CONFIRMED',
    },
    activities: [
      {
        activityName: 'University-Wide Student Engagement',
        activityCategory: 'Student Affairs',
        description: 'Campus-wide student activities and inter-school engagement coordination.',
        verificationStatus: 'CONFIRMED',
      },
      {
        activityName: 'General Student Affairs & Extracurricular Operations',
        activityCategory: 'All-Rounder',
        description: 'Broad extracurricular portfolio supporting university student life.',
        verificationStatus: 'CONFIRMED',
      },
    ],
  },
  {
    code: 'SAC',
    name: 'SAC',
    fullName: 'Student Advisory Council (SAC)',
    category: 'Discipline & Governance',
    department: 'University-Wide (Derived from DSA)',
    operationalIdentity: 'Specialised Discipline Unit Derived from DSA',
    operationalScope: 'Discipline only.',
    institutionalDistinction: null,
    description:
      'Specialised student governance and discipline unit operating as a child body derived from the Department of Student Affairs (DSA).',
    verifiedBlockCode: null,
    demoBlockCode: 'DEMO-BLK-A',
    parentClubCode: 'DSA',
    verificationStatus: 'CONFIRMED',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'CONFIRMED',
      block: 'PENDING_VERIFICATION',
      leadership: 'PENDING_VERIFICATION',
      activities: 'CONFIRMED',
    },
    activities: [
      {
        activityName: 'Campus Event Discipline Coordination',
        activityCategory: 'Discipline',
        description: 'Dedicated discipline oversight for university gatherings and student conduct.',
        verificationStatus: 'CONFIRMED',
      },
    ],
  },
  {
    code: 'CSM',
    name: 'CSM Alliance',
    fullName: 'CSM Alliance',
    category: 'Social Media & Communication',
    department: 'University-Wide',
    operationalIdentity: 'Specialised Communication & Digital Media Club',
    operationalScope: 'Social media only.',
    institutionalDistinction: null,
    description:
      'Specialised communication and digital media student organisation dedicated exclusively to social media activities.',
    verifiedBlockCode: null,
    demoBlockCode: 'DEMO-BLK-A',
    parentClubCode: null,
    verificationStatus: 'CONFIRMED',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'CONFIRMED',
      block: 'PENDING_VERIFICATION',
      leadership: 'PENDING_VERIFICATION',
      activities: 'DEMO',
    },
    activities: [
      {
        activityName: 'Social Media Campaigns & Digital Coverage',
        activityCategory: 'Social Media',
        description: 'Primary operational scope focused on social media activities.',
        verificationStatus: 'CONFIRMED',
      },
      {
        activityName: 'Event Reel & Content Publishing (Illustrative)',
        activityCategory: 'Digital Media',
        description: 'Illustrative operational example pending official club charter confirmation.',
        verificationStatus: 'DEMO',
      },
    ],
  },
  {
    code: 'VNEST',
    name: 'VentureNest (E-Cell)',
    fullName: 'VentureNest (E-Cell)',
    category: 'Entrepreneurship & Innovation',
    department: 'Ramanujan Block – 3',
    operationalIdentity: 'All-Rounder Entrepreneurship & Innovation Club',
    operationalScope:
      'Entrepreneurship, startup ecosystem, innovation, business development, student entrepreneurial engagement, and startup-related activities.',
    institutionalDistinction: 'ENTREPRENEURSHIP & INNOVATION',
    description:
      'All-rounder entrepreneurship and innovation organisation operating under Ramanujan Block – 3, driving startup incubation, business development, and student venture engagement.',
    verifiedBlockCode: 'BLK-R3',
    demoBlockCode: 'BLK-R3',
    parentClubCode: null,
    verificationStatus: 'CONFIRMED',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'CONFIRMED',
      block: 'CONFIRMED',
      leadership: 'CONFIRMED',
      activities: 'CONFIRMED',
    },
    confirmedLeadership: {
      supervisingAuthority: 'Dr. Ati Priye',
      authorityDesignation: null, // Precise designation not supplied — must remain null
      coordinatorName: 'Ms. Manasvini Sharma',
      coordinatorDesignation: 'Club Coordinator & Manager',
    },
    activities: [
      {
        activityName: 'Startup Ecosystem & Venture Mentoring',
        activityCategory: 'Entrepreneurship',
        description: 'Facilitating founder interactions, business development clinics, and student ventures.',
        verificationStatus: 'CONFIRMED',
      },
      {
        activityName: 'Innovation & Entrepreneurial Engagement',
        activityCategory: 'Innovation',
        description: 'Pitch forums, ideation workshops, and startup-related campus initiatives.',
        verificationStatus: 'CONFIRMED',
      },
    ],
  },
  {
    code: 'DCC',
    name: 'DCC',
    fullName: 'DCC',
    category: 'Provisional Profile',
    department: 'Pending Verification',
    operationalIdentity: 'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION',
    operationalScope:
      'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION. Provisional student-club coordination and campus engagement responsibilities.',
    institutionalDistinction: null,
    description:
      'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION. Official acronym expansion, block assignment, and operational charter have not yet been confirmed.',
    verifiedBlockCode: null,
    demoBlockCode: 'DEMO-BLK-C',
    parentClubCode: null,
    verificationStatus: 'DEMO',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'DEMO',
      block: 'DEMO',
      leadership: 'DEMO',
      activities: 'DEMO',
    },
    activities: [
      {
        activityName: 'Student Coordination & Campus Workshops (Illustrative)',
        activityCategory: 'Illustrative Activity',
        description: 'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION.',
        verificationStatus: 'DEMO',
      },
    ],
  },
  {
    code: 'DRR',
    name: 'DRR',
    fullName: 'DRR',
    category: 'Provisional Profile',
    department: 'Pending Verification',
    operationalIdentity: 'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION',
    operationalScope:
      'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION. Provisional student-development and general campus activity responsibilities.',
    institutionalDistinction: null,
    description:
      'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION. Official acronym expansion and institutional reporting details are awaiting verification.',
    verifiedBlockCode: null,
    demoBlockCode: 'DEMO-BLK-C',
    parentClubCode: null,
    verificationStatus: 'DEMO',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'DEMO',
      block: 'DEMO',
      leadership: 'DEMO',
      activities: 'DEMO',
    },
    activities: [
      {
        activityName: 'Student Development & Campus Drives (Illustrative)',
        activityCategory: 'Illustrative Activity',
        description: 'ILLUSTRATIVE PROFILE — OFFICIAL DETAILS PENDING VERIFICATION.',
        verificationStatus: 'DEMO',
      },
    ],
  },
  {
    code: 'NCC',
    name: 'NCC',
    fullName: 'NCC',
    category: 'Military Training',
    department: 'Pending Verification',
    operationalIdentity: 'Military-Training & Discipline-Oriented Organisation',
    operationalScope: 'Military Training.',
    institutionalDistinction: null,
    description:
      'Specialised military-training and discipline-oriented student organisation. Block assignment, commanding officer, and institutional coordinator remain pending verification.',
    verifiedBlockCode: null,
    demoBlockCode: 'DEMO-BLK-C',
    parentClubCode: null,
    verificationStatus: 'CONFIRMED',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'CONFIRMED',
      block: 'PENDING_VERIFICATION',
      leadership: 'PENDING_VERIFICATION',
      activities: 'CONFIRMED',
    },
    activities: [
      {
        activityName: 'Military Training & Drill Discipline',
        activityCategory: 'Military Training',
        description: 'Confirmed military-training and structured discipline mandate.',
        verificationStatus: 'CONFIRMED',
      },
    ],
  },
  {
    code: 'NGO',
    name: 'NGO',
    fullName: 'NGO',
    category: 'Community & Social',
    department: 'Pending Verification',
    operationalIdentity: 'Provisional Illustrative Community Profile',
    operationalScope:
      'Demonstration assumption requiring confirmation: community engagement, student volunteering, and social welfare initiatives.',
    institutionalDistinction: null,
    description:
      'Provisional illustrative profile suggesting community engagement, volunteering, and social initiatives. Official club expansion and leadership details are pending institutional confirmation.',
    verifiedBlockCode: null,
    demoBlockCode: 'DEMO-BLK-C',
    parentClubCode: null,
    verificationStatus: 'DEMO',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'DEMO',
      block: 'DEMO',
      leadership: 'DEMO',
      activities: 'DEMO',
    },
    activities: [
      {
        activityName: 'Community Engagement & Volunteering (Demonstration Assumption)',
        activityCategory: 'Community Outreach',
        description: 'Demonstration assumption requiring institutional confirmation.',
        verificationStatus: 'DEMO',
      },
    ],
  },
  {
    code: 'ICA',
    name: 'ICA Club',
    fullName: 'ICA Club',
    category: 'All-Rounder',
    department: 'TechX School of Engineering',
    operationalIdentity: 'All-Rounder Club (TechX SOE)',
    operationalScope:
      'Technical activities, student development, events and workshops, innovation and collaboration, extracurricular engagement, and all-rounder student-club responsibilities.',
    institutionalDistinction: null,
    description:
      'Confirmed all-rounder student organisation operating under Block 6 — TechX School of Engineering (TechX SOE), covering technical workshops, innovation, student development, and extracurricular engagement.',
    verifiedBlockCode: 'BLK-6',
    demoBlockCode: 'BLK-6',
    parentClubCode: null,
    verificationStatus: 'CONFIRMED',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'CONFIRMED',
      block: 'CONFIRMED',
      leadership: 'CONFIRMED',
      activities: 'CONFIRMED',
    },
    confirmedLeadership: {
      supervisingAuthority: 'Dr. Sugandhi Malhotra',
      authorityDesignation: 'Associate Dean, TechX School of Engineering',
      coordinatorName: 'Ms. Khushi Chhabra',
      coordinatorDesignation: 'Club Coordinator',
    },
    activities: [
      {
        activityName: 'Technical Workshops & Innovation Labs',
        activityCategory: 'Technical',
        description: 'Hands-on technical sessions, engineering collaboration, and innovation events.',
        verificationStatus: 'CONFIRMED',
      },
      {
        activityName: 'Student Development & Extracurricular Engagement',
        activityCategory: 'All-Rounder',
        description: 'Holistic student development, campus events, and cross-disciplinary collaboration.',
        verificationStatus: 'CONFIRMED',
      },
    ],
  },
  {
    code: 'D4C',
    name: 'D4-Community',
    fullName: 'D4-Community',
    category: 'Technology Club',
    department: 'Pending Verification',
    operationalIdentity: 'Major Technology-Focused Organisation',
    operationalScope:
      'Technology-focused student organisation representing the largest and oldest technology club at CGC University.',
    institutionalDistinction: 'LARGEST & OLDEST TECH CLUB',
    description:
      'Recognised as the biggest and oldest technology club at CGC University according to supplied institutional information. Block assignment and official leadership await verification.',
    verifiedBlockCode: null,
    demoBlockCode: 'DEMO-BLK-B',
    parentClubCode: null,
    verificationStatus: 'CONFIRMED',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'CONFIRMED',
      block: 'PENDING_VERIFICATION',
      leadership: 'PENDING_VERIFICATION',
      activities: 'DEMO',
    },
    activities: [
      {
        activityName: 'Developer Community & Technology Sessions (Illustrative)',
        activityCategory: 'Technology',
        description: 'Illustrative technical programming details pending formal club confirmation.',
        verificationStatus: 'DEMO',
      },
    ],
  },
  {
    code: 'ICTSE',
    name: 'ICTSE',
    fullName: 'ICTSE',
    category: 'Technology Club',
    department: 'Pending Verification',
    operationalIdentity: 'Specialised Technical Organisation',
    operationalScope:
      'Technology club. Additional operational responsibilities, block assignment, and coordinator details remain provisional until verified.',
    institutionalDistinction: null,
    description:
      'Specialised technology-focused student club. Official operational scope beyond technology focus, university block, and coordinator details are pending verification.',
    verifiedBlockCode: null,
    demoBlockCode: 'DEMO-BLK-B',
    parentClubCode: null,
    verificationStatus: 'PENDING_VERIFICATION',
    fieldVerification: {
      name: 'CONFIRMED',
      operationalScope: 'PENDING_VERIFICATION',
      block: 'PENDING_VERIFICATION',
      leadership: 'PENDING_VERIFICATION',
      activities: 'DEMO',
    },
    activities: [
      {
        activityName: 'Specialised Technical Programs (Provisional)',
        activityCategory: 'Technology',
        description: 'Provisional technical activity placeholder pending official verification.',
        verificationStatus: 'DEMO',
      },
    ],
  },
];

export async function ensureCgcStructureSeeded(): Promise<void> {
  if (cgcSeedPromise) {
    return cgcSeedPromise;
  }

  cgcSeedPromise = (async () => {
    try {
      // 1. Ensure CGC University exists
      let [uni] = await db
        .select()
        .from(universities)
        .where(eq(universities.code, 'CGC'))
        .limit(1);

      if (!uni) {
        const inserted = await db
          .insert(universities)
          .values({
            code: 'CGC',
            universityName: 'CGC University',
            verificationStatus: 'CONFIRMED',
          })
          .onConflictDoNothing()
          .returning();
        uni =
          inserted[0] ??
          (
            await db
              .select()
              .from(universities)
              .where(eq(universities.code, 'CGC'))
              .limit(1)
          )[0];
      }

      // 2. Ensure confirmed & demo placeholder blocks exist (non-destructive)
      const blockByCode = new Map<string, number>();
      for (const blk of CGC_BLOCKS) {
        const existing = await db
          .select()
          .from(blocks)
          .where(eq(blocks.code, blk.code))
          .limit(1);

        if (existing.length > 0) {
          blockByCode.set(blk.code, existing[0].id);
        } else {
          const inserted = await db
            .insert(blocks)
            .values({
              universityId: uni.id,
              ...blk,
            })
            .onConflictDoNothing()
            .returning();
          if (inserted[0]) {
            blockByCode.set(blk.code, inserted[0].id);
          }
        }
      }

      // 3. Upsert the 11 supplied CGC clubs non-destructively (never delete existing rows or overwrite admin confirmed edits)
      const clubIdByCode = new Map<string, number>();

      for (const spec of CGC_CLUB_SPECS) {
        const existing = await db
          .select()
          .from(clubs)
          .where(eq(clubs.code, spec.code))
          .limit(1);

        const verifiedBlockId = spec.verifiedBlockCode
          ? blockByCode.get(spec.verifiedBlockCode) ?? null
          : null;
        const demoBlockId = blockByCode.get(spec.demoBlockCode) ?? null;

        if (existing.length > 0) {
          const row = existing[0];
          clubIdByCode.set(spec.code, row.id);
          // Only enrich if this club hasn't been initialized into the CGC directory yet (e.g. existing ICA row)
          if (!row.isCgcDirectory) {
            await db
              .update(clubs)
              .set({
                name: spec.name,
                fullName: spec.fullName,
                category: spec.category,
                department: spec.department,
                facultyAdvisor:
                  spec.confirmedLeadership?.coordinatorName ?? row.facultyAdvisor,
                description: spec.description,
                foundedYear: null, // Do not manufacture founding year for ICA Club
                operationalIdentity: spec.operationalIdentity,
                operationalScope: spec.operationalScope,
                institutionalDistinction: spec.institutionalDistinction,
                universityId: uni.id,
                blockId: verifiedBlockId,
                demoBlockId,
                verificationStatus: spec.verificationStatus,
                fieldVerification: JSON.stringify(spec.fieldVerification),
                isCgcDirectory: true,
                isSyntheticData: true,
              })
              .where(eq(clubs.id, row.id));
          }
        } else {
          const inserted = await db
            .insert(clubs)
            .values({
              code: spec.code,
              name: spec.name,
              fullName: spec.fullName,
              category: spec.category,
              department: spec.department,
              facultyAdvisor: spec.confirmedLeadership?.coordinatorName ?? null,
              description: spec.description,
              foundedYear: null,
              status: 'Active',
              operationalIdentity: spec.operationalIdentity,
              operationalScope: spec.operationalScope,
              institutionalDistinction: spec.institutionalDistinction,
              universityId: uni.id,
              blockId: verifiedBlockId,
              demoBlockId,
              operationalStatus: 'Active',
              verificationStatus: spec.verificationStatus,
              fieldVerification: JSON.stringify(spec.fieldVerification),
              isCgcDirectory: true,
              isSyntheticData: true,
            })
            .onConflictDoNothing()
            .returning();

          if (inserted[0]) {
            clubIdByCode.set(spec.code, inserted[0].id);
          }
        }
      }

      // 4. Link parent-child relationship (DSA -> SAC)
      const dsaId = clubIdByCode.get('DSA');
      const sacId = clubIdByCode.get('SAC');
      if (dsaId && sacId) {
        const [sacRow] = await db
          .select()
          .from(clubs)
          .where(eq(clubs.id, sacId))
          .limit(1);
        if (sacRow && sacRow.parentClubId === null) {
          await db
            .update(clubs)
            .set({ parentClubId: dsaId })
            .where(eq(clubs.id, sacId));
        }
      }

      // 5. Ensure leadership & activity records exist for each of the 11 clubs (without overwriting existing records)
      for (const spec of CGC_CLUB_SPECS) {
        const clubId = clubIdByCode.get(spec.code);
        if (!clubId) continue;

        const existingLeaders = await db
          .select()
          .from(clubLeadership)
          .where(eq(clubLeadership.clubId, clubId));

        if (existingLeaders.length === 0) {
          if (spec.confirmedLeadership) {
            await db.insert(clubLeadership).values({
              clubId,
              supervisingAuthority: spec.confirmedLeadership.supervisingAuthority,
              authorityDesignation: spec.confirmedLeadership.authorityDesignation,
              coordinatorName: spec.confirmedLeadership.coordinatorName,
              coordinatorDesignation: spec.confirmedLeadership.coordinatorDesignation,
              effectiveFrom: '2026-01-01',
              isDemoPlaceholder: false,
              verificationStatus: 'CONFIRMED',
            });
          } else {
            // Role-based placeholder ONLY for Demo Structure view — NEVER fake personal names
            await db.insert(clubLeadership).values({
              clubId,
              supervisingAuthority: 'Sample Supervising Authority',
              authorityDesignation: 'Role-Based Placeholder (Demo Only)',
              coordinatorName: 'Sample Faculty Coordinator',
              coordinatorDesignation: 'Role-Based Placeholder (Demo Only)',
              isDemoPlaceholder: true,
              verificationStatus: 'DEMO',
            });
          }
        }

        const existingActivities = await db
          .select()
          .from(clubActivities)
          .where(eq(clubActivities.clubId, clubId));

        if (existingActivities.length === 0 && spec.activities.length > 0) {
          await db.insert(clubActivities).values(
            spec.activities.map((a) => ({
              clubId,
              activityName: a.activityName,
              activityCategory: a.activityCategory,
              description: a.description,
              verificationStatus: a.verificationStatus,
            }))
          );
        }
      }
    } catch (error) {
      cgcSeedPromise = null;
      console.error('Failed to seed CGC University club structure:', error);
      throw new Error('Failed to initialize CGC University club directory.', {
        cause: error,
      });
    }
  })();

  return cgcSeedPromise;
}
