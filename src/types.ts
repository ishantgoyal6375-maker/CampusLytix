export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: 'ADMIN' | 'VIEWER' | string;
  lastLoginAt?: string;
  createdAt?: string;
}

export type VerificationStatus = 'CONFIRMED' | 'DEMO' | 'PENDING_VERIFICATION';
export type StructureViewMode = 'verified' | 'demo';

export interface ClubRanking {
  id: number;
  code: string;
  name: string;
  fullName?: string;
  category: string;
  department: string;
  facultyAdvisor: string | null;
  institutionalDistinction?: string | null;
  operationalIdentity?: string | null;
  verificationStatus?: VerificationStatus | string;
  isCgcDirectory?: boolean;
  isSyntheticData?: boolean;
  verifiedBlockName?: string | null;
  memberCount: number;
  eventCount: number;
  totalCheckIns: number;
  uniqueAttendees: number;
  avgEventTurnout: number;
  attendanceRate: number;
  participationRatio: number;
}

export interface DepartmentMetric {
  department: string;
  totalStudents: number;
  engagedStudents: number;
  engagementRate: number;
  totalMemberships: number;
  totalAttendances: number;
  topClub: string;
}

export interface MonthlyTrend {
  month: string;
  label: string;
  eventsHeld: number;
  checkIns: number;
  registrations: number;
  uniqueParticipants: number;
  newMemberships: number;
}

export interface ClubEvent {
  id: number;
  clubId: number;
  clubName: string;
  clubCode: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  capacity: number;
  presentCount: number;
  registeredCount: number;
  attendanceRate: number | null;
  googleCalendarEventId: string | null;
  source: string;
}

export interface ImportHistoryRecord {
  id: number;
  source: string;
  sourceName: string;
  targetEntity: string;
  recordsTotal: number;
  recordsImported: number;
  recordsSkipped: number;
  recordsFailed: number;
  status: string;
  performedByEmail: string | null;
  createdAt: string;
}

export interface DashboardAnalytics {
  kpis: {
    totalStudents: number;
    activeClubs: number;
    cgcDirectoryClubCount?: number;
    totalMemberships: number;
    engagedStudents: number;
    engagementRate: number;
    totalEvents: number;
    totalCheckIns: number;
    avgAttendanceRate: number;
    hasSyntheticData?: boolean;
  };
  clubRankings: ClubRanking[];
  departmentAnalytics: DepartmentMetric[];
  monthlyTrends: MonthlyTrend[];
  eventsList: ClubEvent[];
  recentImports: ImportHistoryRecord[];
  filterOptions: {
    departments: string[];
    categories: string[];
    months: string[];
  };
  generatedAt: string;
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

export interface StoredFileRecord {
  id: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  storageBackend: string;
  storagePath: string;
  driveFileId: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
}

export interface ClubPulseAIResponse {
  summary: string;
  verifiedMetrics: Array<{
    label: string;
    value: string;
    context: string;
  }>;
  interpretation: string;
  recommendations: string[];
  dataScopeNote: string;
}

export interface CgcBlock {
  id: number;
  code: string;
  blockName: string;
  schoolName: string | null;
  blockHeadName: string | null;
  blockHeadDesignation: string | null;
  verificationStatus: VerificationStatus | string;
  isDemoPlaceholder: boolean;
}

export interface CgcLeadership {
  id: number;
  supervisingAuthority: string | null;
  authorityDesignation: string | null;
  coordinatorName: string | null;
  coordinatorDesignation: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  verificationStatus: VerificationStatus | string;
  isDemoPlaceholder?: boolean;
}

export interface CgcActivity {
  id: number;
  clubId: number;
  activityName: string;
  activityCategory: string;
  description: string | null;
  verificationStatus: VerificationStatus | string;
}

export interface CgcClub {
  id: number;
  code: string;
  name: string;
  fullName: string;
  category: string;
  department: string;
  description: string | null;
  operationalIdentity: string | null;
  operationalScope: string | null;
  institutionalDistinction: string | null;
  operationalStatus: string;
  verificationStatus: VerificationStatus | string;
  fieldVerification: {
    name: VerificationStatus | string;
    operationalScope: VerificationStatus | string;
    block: VerificationStatus | string;
    leadership: VerificationStatus | string;
    activities: VerificationStatus | string;
  };
  isSyntheticData: boolean;
  blockId: number | null;
  demoBlockId: number | null;
  verifiedBlock: CgcBlock | null;
  demoBlock: CgcBlock | null;
  parentClub: { id: number; code: string; name: string; fullName: string | null } | null;
  childClubs: Array<{ id: number; code: string; name: string; fullName: string | null }>;
  confirmedLeadership: CgcLeadership | null;
  demoLeadership: CgcLeadership | null;
  leadershipHistory: CgcLeadership[];
  activities: CgcActivity[];
  analytics: {
    memberCount: number;
    eventCount: number;
    totalCheckIns: number;
    attendanceRate: number;
    participationTrends: Array<{ month: string; label: string; checkIns: number; events: number }>;
    recentEvents: Array<{
      id: number;
      title: string;
      eventDate: string;
      location: string | null;
      presentCount: number;
    }>;
  };
}

export interface CgcBlockSummaryItem {
  blockId: number | null;
  code: string;
  blockName: string;
  schoolName: string | null;
  blockHeadName: string | null;
  blockHeadDesignation: string | null;
  verificationStatus: VerificationStatus | string;
  isDemoPlaceholder: boolean;
  clubCount: number;
  clubs: Array<{ id: number; code: string; name: string; category: string }>;
}

export interface CgcDirectoryData {
  university: { id: number; code: string; universityName: string };
  blocks: CgcBlock[];
  verifiedBlocks: CgcBlock[];
  demoBlocks: CgcBlock[];
  clubs: CgcClub[];
  blockSummary: CgcBlockSummaryItem[];
  categoryDistribution: Array<{ category: string; count: number }>;
  verificationCounts: {
    confirmedClubs: number;
    demoClubs: number;
    pendingClubs: number;
    confirmedBlocks: number;
    confirmedHierarchies: number;
    unverifiedHierarchies: number;
  };
}

export type NavSection =
  | 'overview'
  | 'directory'
  | 'structure'
  | 'clubs'
  | 'events'
  | 'data'
  | 'ai'
  | 'settings';
