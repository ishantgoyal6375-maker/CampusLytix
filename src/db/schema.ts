import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  role: text('role').notNull().default('VIEWER'), // 'ADMIN' | 'VIEWER'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
});

export const universities = pgTable('universities', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  universityName: text('university_name').notNull(),
  verificationStatus: text('verification_status').notNull().default('CONFIRMED'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const blocks = pgTable('blocks', {
  id: serial('id').primaryKey(),
  universityId: integer('university_id').references(() => universities.id, {
    onDelete: 'set null',
  }),
  code: text('code').notNull().unique(),
  blockName: text('block_name').notNull(),
  schoolName: text('school_name'),
  blockHeadName: text('block_head_name'),
  blockHeadDesignation: text('block_head_designation'),
  isDemoPlaceholder: boolean('is_demo_placeholder').notNull().default(false),
  verificationStatus: text('verification_status')
    .notNull()
    .default('PENDING_VERIFICATION'), // CONFIRMED | DEMO | PENDING_VERIFICATION
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clubs = pgTable('clubs', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  fullName: text('full_name'),
  category: text('category').notNull(),
  department: text('department').notNull(),
  facultyAdvisor: text('faculty_advisor'),
  description: text('description'),
  foundedYear: integer('founded_year'),
  status: text('status').notNull().default('Active'),
  operationalIdentity: text('operational_identity'),
  operationalScope: text('operational_scope'),
  institutionalDistinction: text('institutional_distinction'),
  universityId: integer('university_id').references(() => universities.id, {
    onDelete: 'set null',
  }),
  blockId: integer('block_id').references(() => blocks.id, {
    onDelete: 'set null',
  }),
  demoBlockId: integer('demo_block_id').references(() => blocks.id, {
    onDelete: 'set null',
  }),
  parentClubId: integer('parent_club_id'),
  operationalStatus: text('operational_status').notNull().default('Active'),
  verificationStatus: text('verification_status')
    .notNull()
    .default('PENDING_VERIFICATION'), // CONFIRMED | DEMO | PENDING_VERIFICATION
  fieldVerification: text('field_verification'), // JSON string of field-level statuses
  isCgcDirectory: boolean('is_cgc_directory').notNull().default(false),
  isSyntheticData: boolean('is_synthetic_data').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clubLeadership = pgTable('club_leadership', {
  id: serial('id').primaryKey(),
  clubId: integer('club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  supervisingAuthority: text('supervising_authority'),
  authorityDesignation: text('authority_designation'),
  coordinatorName: text('coordinator_name'),
  coordinatorDesignation: text('coordinator_designation'),
  effectiveFrom: text('effective_from'),
  effectiveTo: text('effective_to'),
  isDemoPlaceholder: boolean('is_demo_placeholder').notNull().default(false),
  verificationStatus: text('verification_status')
    .notNull()
    .default('PENDING_VERIFICATION'), // CONFIRMED | DEMO | PENDING_VERIFICATION
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clubActivities = pgTable('club_activities', {
  id: serial('id').primaryKey(),
  clubId: integer('club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  activityName: text('activity_name').notNull(),
  activityCategory: text('activity_category').notNull(),
  description: text('description'),
  verificationStatus: text('verification_status').notNull().default('DEMO'), // CONFIRMED | DEMO | PENDING_VERIFICATION
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  studentCode: text('student_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  department: text('department').notNull(),
  academicYear: integer('academic_year').notNull().default(2),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const memberships = pgTable(
  'memberships',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    clubId: integer('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('Member'),
    joinedAt: text('joined_at').notNull(), // YYYY-MM-DD
    status: text('status').notNull().default('Active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('memberships_student_club_idx').on(table.studentId, table.clubId),
  ]
);

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  clubId: integer('club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: text('event_date').notNull(), // YYYY-MM-DD
  startTime: text('start_time').default('14:00'),
  endTime: text('end_time').default('16:00'),
  location: text('location').default('Main Auditorium'),
  capacity: integer('capacity').notNull().default(100),
  googleCalendarEventId: text('google_calendar_event_id').unique(),
  source: text('source').notNull().default('ClubPulse'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const attendance = pgTable(
  'attendance',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('Present'), // Present | Registered | Absent
    checkedInAt: timestamp('checked_in_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('attendance_event_student_idx').on(table.eventId, table.studentId),
  ]
);

export const importHistory = pgTable('import_history', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  sourceName: text('source_name').notNull(),
  targetEntity: text('target_entity').notNull(),
  recordsTotal: integer('records_total').notNull().default(0),
  recordsImported: integer('records_imported').notNull().default(0),
  recordsSkipped: integer('records_skipped').notNull().default(0),
  recordsFailed: integer('records_failed').notNull().default(0),
  status: text('status').notNull().default('Completed'),
  performedByUid: text('performed_by_uid'),
  performedByEmail: text('performed_by_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const storedFiles = pgTable('stored_files', {
  id: serial('id').primaryKey(),
  fileName: text('file_name').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  category: text('category').notNull().default('Dataset'),
  storageBackend: text('storage_backend').notNull().default('local_private'),
  storagePath: text('storage_path').notNull(),
  driveFileId: text('drive_file_id'),
  uploadedByUid: text('uploaded_by_uid'),
  uploadedByEmail: text('uploaded_by_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const integrationLogs = pgTable('integration_logs', {
  id: serial('id').primaryKey(),
  serviceKey: text('service_key').notNull(),
  action: text('action').notNull(),
  status: text('status').notNull(),
  message: text('message'),
  accountEmail: text('account_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const universitiesRelations = relations(universities, ({ many }) => ({
  blocks: many(blocks),
  clubs: many(clubs),
}));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
  university: one(universities, {
    fields: [blocks.universityId],
    references: [universities.id],
  }),
  clubs: many(clubs),
}));

export const clubsRelations = relations(clubs, ({ one, many }) => ({
  university: one(universities, {
    fields: [clubs.universityId],
    references: [universities.id],
  }),
  block: one(blocks, {
    fields: [clubs.blockId],
    references: [blocks.id],
  }),
  leadership: many(clubLeadership),
  activities: many(clubActivities),
  memberships: many(memberships),
  events: many(events),
}));

export const clubLeadershipRelations = relations(clubLeadership, ({ one }) => ({
  club: one(clubs, {
    fields: [clubLeadership.clubId],
    references: [clubs.id],
  }),
}));

export const clubActivitiesRelations = relations(clubActivities, ({ one }) => ({
  club: one(clubs, {
    fields: [clubActivities.clubId],
    references: [clubs.id],
  }),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  memberships: many(memberships),
  attendance: many(attendance),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  student: one(students, {
    fields: [memberships.studentId],
    references: [students.id],
  }),
  club: one(clubs, {
    fields: [memberships.clubId],
    references: [clubs.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  club: one(clubs, {
    fields: [events.clubId],
    references: [clubs.id],
  }),
  attendance: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  event: one(events, {
    fields: [attendance.eventId],
    references: [events.id],
  }),
  student: one(students, {
    fields: [attendance.studentId],
    references: [students.id],
  }),
}));
