import { count } from 'drizzle-orm';
import { db } from './index.ts';
import {
  attendance,
  clubs,
  events,
  importHistory,
  memberships,
  students,
} from './schema.ts';

let seedPromise: Promise<void> | null = null;

const SEED_CLUBS = [
  {
    code: 'ICA',
    name: 'ICA Club',
    category: 'Technical',
    department: 'Computer Science',
    facultyAdvisor: 'Dr. Ananya Rao',
    description: 'Intelligent Computing & Automation club focused on applied AI, cloud tooling, and systems engineering.',
    foundedYear: 2019,
  },
  {
    code: 'COD',
    name: 'Coding Club',
    category: 'Technical',
    department: 'Computer Science',
    facultyAdvisor: 'Prof. Vikram Menon',
    description: 'Competitive programming, open-source sprints, and peer software engineering workshops.',
    foundedYear: 2017,
  },
  {
    code: 'ROB',
    name: 'Robotics Society',
    category: 'Technical',
    department: 'Mechanical Engineering',
    facultyAdvisor: 'Dr. Karthik Subramanian',
    description: 'Autonomous rovers, embedded firmware, and mechatronics prototyping lab.',
    foundedYear: 2018,
  },
  {
    code: 'DSG',
    name: 'Data Science Guild',
    category: 'Academic',
    department: 'Information Systems',
    facultyAdvisor: 'Dr. Meera Kulkarni',
    description: 'Statistical modeling, analytics case competitions, and campus data storytelling.',
    foundedYear: 2020,
  },
  {
    code: 'DLU',
    name: 'Debate & Literary Union',
    category: 'Cultural',
    department: 'Business Administration',
    facultyAdvisor: 'Prof. Rohan Deshmukh',
    description: 'Parliamentary debates, policy forums, and institutional publications.',
    foundedYear: 2015,
  },
  {
    code: 'DMC',
    name: 'Design & Media Collective',
    category: 'Cultural',
    department: 'Information Systems',
    facultyAdvisor: 'Prof. Neha Kapoor',
    description: 'UI/UX design critiques, campus photography, and editorial visual systems.',
    foundedYear: 2021,
  },
  {
    code: 'ECL',
    name: 'Entrepreneurship Cell',
    category: 'Leadership',
    department: 'Business Administration',
    facultyAdvisor: 'Dr. Sanjay Verma',
    description: 'Startup incubation clinics, founder fireside chats, and venture pitch competitions.',
    foundedYear: 2018,
  },
  {
    code: 'GCI',
    name: 'Green Campus Initiative',
    category: 'Leadership',
    department: 'Biotechnology',
    facultyAdvisor: 'Dr. Priya Nair',
    description: 'Campus sustainability audits, biodiversity projects, and energy conservation drives.',
    foundedYear: 2022,
  },
];

const DEPARTMENTS = [
  'Computer Science',
  'Information Systems',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Business Administration',
  'Biotechnology',
];

const FIRST_NAMES = [
  'Aarav', 'Diya', 'Kabir', 'Ananya', 'Rohan', 'Sneha', 'Vihaan', 'Ishita',
  'Arjun', 'Meera', 'Siddharth', 'Kavya', 'Aditya', 'Riya', 'Pranav', 'Nisha',
  'Dev', 'Tara', 'Nikhil', 'Pooja', 'Harsh', 'Shreya', 'Kunal', 'Aanya',
  'Yash', 'Tanvi', 'Ritvik', 'Aditi', 'Manav', 'Sakshi',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Reddy', 'Nair', 'Gupta', 'Iyer', 'Verma', 'Joshi',
  'Mehta', 'Kulkarni', 'Chauhan', 'Bansal', 'Rao', 'Kapoor', 'Malhotra',
  'Desai', 'Singh', 'Menon', 'Bose', 'Jain',
];

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    try {
      const existingClubs = await db.select({ value: count() }).from(clubs);
      if (Number(existingClubs[0]?.value ?? 0) > 0) {
        return;
      }

      const insertedClubs = await db
        .insert(clubs)
        .values(SEED_CLUBS)
        .onConflictDoNothing()
        .returning();

      const allClubs =
        insertedClubs.length > 0 ? insertedClubs : await db.select().from(clubs);

      const clubByCode = new Map(allClubs.map((c) => [c.code, c]));

      // Create 60 realistic students across 6 departments
      const studentRows = Array.from({ length: 60 }, (_, idx) => {
        const first = FIRST_NAMES[idx % FIRST_NAMES.length];
        const last = LAST_NAMES[(idx * 3 + Math.floor(idx / 6)) % LAST_NAMES.length];
        // Weighted department distribution
        const deptIndex =
          idx < 16 ? 0 : idx < 28 ? 1 : idx < 38 ? 2 : idx < 47 ? 3 : idx < 54 ? 4 : 5;
        const department = DEPARTMENTS[deptIndex];
        const academicYear = (idx % 4) + 1;
        const codeNum = String(1001 + idx);
        return {
          studentCode: `STU-${codeNum}`,
          fullName: `${first} ${last}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${codeNum}@campus.edu`,
          department,
          academicYear,
        };
      });

      const insertedStudents = await db
        .insert(students)
        .values(studentRows)
        .onConflictDoNothing()
        .returning();

      const allStudents =
        insertedStudents.length > 0
          ? insertedStudents
          : await db.select().from(students);

      // Deterministic memberships: ICA Club & Coding Club lead in size, Green Campus smaller
      const clubTargets: Array<{ code: string; count: number; joinMonths: string[] }> = [
        { code: 'ICA', count: 32, joinMonths: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'] },
        { code: 'COD', count: 29, joinMonths: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'] },
        { code: 'DSG', count: 22, joinMonths: ['2026-07', '2026-08', '2026-09', '2026-10'] },
        { code: 'ROB', count: 19, joinMonths: ['2026-06', '2026-08', '2026-09', '2026-10'] },
        { code: 'DMC', count: 16, joinMonths: ['2026-07', '2026-08', '2026-09', '2026-11'] },
        { code: 'ECL', count: 14, joinMonths: ['2026-06', '2026-08', '2026-10'] },
        { code: 'DLU', count: 11, joinMonths: ['2026-07', '2026-09', '2026-10'] },
        { code: 'GCI', count: 8, joinMonths: ['2026-08', '2026-10', '2026-11'] },
      ];

      const membershipValues: Array<{
        studentId: number;
        clubId: number;
        role: string;
        joinedAt: string;
        status: string;
      }> = [];

      const membersByClubCode = new Map<string, number[]>();

      clubTargets.forEach((target, clubIdx) => {
        const club = clubByCode.get(target.code);
        if (!club) return;
        const memberIds: number[] = [];
        for (let i = 0; i < target.count; i++) {
          const studentIdx = (i * 2 + clubIdx * 5) % allStudents.length;
          const student = allStudents[studentIdx];
          if (!student || memberIds.includes(student.id)) continue;
          memberIds.push(student.id);
          const month = target.joinMonths[i % target.joinMonths.length];
          const day = String(((i * 7) % 26) + 1).padStart(2, '0');
          membershipValues.push({
            studentId: student.id,
            clubId: club.id,
            role: i === 0 ? 'President' : i < 3 ? 'Coordinator' : 'Member',
            joinedAt: `${month}-${day}`,
            status: 'Active',
          });
        }
        membersByClubCode.set(target.code, memberIds);
      });

      if (membershipValues.length > 0) {
        await db.insert(memberships).values(membershipValues).onConflictDoNothing();
      }

      // 18 Events spanning June 2026 – December 2026
      const eventDefs = [
        { code: 'ICA', title: 'Cloud Architecture & AI Summit', date: '2026-06-18', start: '14:00', end: '17:00', loc: 'Innovation Hall A', cap: 60, rate: 0.84 },
        { code: 'COD', title: 'Summer Algorithms Sprint', date: '2026-06-24', start: '15:00', end: '18:00', loc: 'CS Lab 204', cap: 50, rate: 0.72 },
        { code: 'ROB', title: 'Autonomous Rover Telemetry Demo', date: '2026-07-11', start: '11:00', end: '13:30', loc: 'Mechatronics Bay', cap: 45, rate: 0.88 },
        { code: 'DSG', title: 'Campus Data Storytelling Workshop', date: '2026-07-19', start: '14:30', end: '16:30', loc: 'Analytics Studio', cap: 40, rate: 0.78 },
        { code: 'DLU', title: 'Inter-Department Policy Debate', date: '2026-07-27', start: '16:00', end: '18:00', loc: 'Seminar Room 102', cap: 40, rate: 0.55 },
        { code: 'ICA', title: 'Hands-on Gemini & SQL Pipelines', date: '2026-08-14', start: '14:00', end: '16:30', loc: 'Innovation Hall A', cap: 60, rate: 0.87 },
        { code: 'COD', title: 'Open Source Contribution Night', date: '2026-08-22', start: '17:00', end: '20:00', loc: 'CS Lab 204', cap: 55, rate: 0.68 },
        { code: 'DMC', title: 'Editorial Design Systems Critique', date: '2026-08-29', start: '15:00', end: '17:00', loc: 'Design Loft 3B', cap: 35, rate: 0.81 },
        { code: 'ECL', title: 'Campus Founder Pitch Showcase', date: '2026-09-10', start: '14:00', end: '17:00', loc: 'Main Auditorium', cap: 80, rate: 0.79 },
        { code: 'ICA', title: 'Enterprise Automation Hackathon', date: '2026-09-18', start: '09:30', end: '17:30', loc: 'Innovation Hall A', cap: 70, rate: 0.91 },
        { code: 'DSG', title: 'Predictive Modeling Case Study', date: '2026-09-25', start: '14:00', end: '16:00', loc: 'Analytics Studio', cap: 45, rate: 0.82 },
        { code: 'COD', title: 'Annual Campus Hackathon Prep', date: '2026-10-08', start: '16:00', end: '19:00', loc: 'CS Lab 204', cap: 60, rate: 0.76 },
        { code: 'ROB', title: 'Embedded Firmware Bootcamp', date: '2026-10-15', start: '13:00', end: '16:00', loc: 'Mechatronics Bay', cap: 40, rate: 0.85 },
        { code: 'ICA', title: 'Applied ML Systems Colloquium', date: '2026-10-22', start: '14:00', end: '16:30', loc: 'Main Auditorium', cap: 75, rate: 0.89 },
        { code: 'GCI', title: 'Zero-Waste Campus Audit Drive', date: '2026-10-28', start: '10:00', end: '12:30', loc: 'Eco Courtyard', cap: 35, rate: 0.62 },
        { code: 'DSG', title: 'SQL & BI Dashboard Clinic', date: '2026-11-12', start: '15:00', end: '17:00', loc: 'Analytics Studio', cap: 50, rate: 0.86 },
        { code: 'ICA', title: 'Google Cloud & Analytics Showcase', date: '2026-11-28', start: '14:00', end: '16:30', loc: 'Main Auditorium', cap: 80, rate: 0.65 },
        { code: 'COD', title: 'Winter Systems Design Jam', date: '2026-12-06', start: '15:00', end: '18:00', loc: 'CS Lab 204', cap: 60, rate: 0.55 },
      ];

      const insertedEvents = await db
        .insert(events)
        .values(
          eventDefs
            .map((e) => {
              const club = clubByCode.get(e.code);
              if (!club) return null;
              return {
                clubId: club.id,
                title: e.title,
                description: `${club.name} institutional session hosted at ${e.loc}.`,
                eventDate: e.date,
                startTime: e.start,
                endTime: e.end,
                location: e.loc,
                capacity: e.cap,
                source: 'ClubPulse',
              };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
        )
        .returning();

      // Attendance records aligned with club members + cross-club attendees
      const attendanceValues: Array<{
        eventId: number;
        studentId: number;
        status: string;
      }> = [];

      insertedEvents.forEach((ev, idx) => {
        const def = eventDefs[idx];
        const clubMembers = membersByClubCode.get(def.code) ?? [];
        const presentCount = Math.max(3, Math.round(clubMembers.length * def.rate));
        const isFuture = def.date > '2026-11-20';

        clubMembers.forEach((studentId, mIdx) => {
          if (isFuture) {
            if (mIdx < presentCount) {
              attendanceValues.push({ eventId: ev.id, studentId, status: 'Registered' });
            }
          } else {
            attendanceValues.push({
              eventId: ev.id,
              studentId,
              status: mIdx < presentCount ? 'Present' : 'Absent',
            });
          }
        });
      });

      if (attendanceValues.length > 0) {
        await db.insert(attendance).values(attendanceValues).onConflictDoNothing();
      }

      await db.insert(importHistory).values([
        {
          source: 'CSV',
          sourceName: 'Fall_2026_Student_Club_Registry.csv',
          targetEntity: 'students',
          recordsTotal: 60,
          recordsImported: 60,
          recordsSkipped: 0,
          recordsFailed: 0,
          status: 'Completed',
          performedByEmail: 'system@clubpulse.edu',
        },
        {
          source: 'CSV',
          sourceName: 'Semester_Club_Attendance_Q3.csv',
          targetEntity: 'attendance',
          recordsTotal: attendanceValues.length,
          recordsImported: attendanceValues.length,
          recordsSkipped: 0,
          recordsFailed: 0,
          status: 'Completed',
          performedByEmail: 'system@clubpulse.edu',
        },
      ]);
    } catch (error) {
      seedPromise = null;
      console.error('Error seeding ClubPulse database:', error);
      throw new Error('Failed to initialize institutional baseline data.', { cause: error });
    }
  })();

  return seedPromise;
}
