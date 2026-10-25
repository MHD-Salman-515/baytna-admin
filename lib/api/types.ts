// Hand-written API types. Swagger documents request bodies (the *Dto types
// below match components.schemas) but not responses, so response types here
// were taken from the live staging API. Keep them narrow: declare only what
// the console reads.

export type LocalizedText = { ar?: string; en?: string };

export type Country = {
  id: string;
  code: string;
  name: LocalizedText;
  phonePrefix: string;
  isActive: boolean;
  currencyCode: string;
};

/** GET /cities?countryId= (countryId is required). */
export type City = {
  id: string;
  countryId: string;
  name: LocalizedText;
  isActive: boolean;
};

/** GET /services */
export type Service = {
  id: string;
  key: string;
  name: LocalizedText;
  isActive: boolean;
};

export type Role = "CUSTOMER" | "WORKER" | "ADMIN" | (string & {});

export type AuthUser = {
  id: string;
  phone: string;
  roles: Role[];
  firstName?: string | null;
  lastName?: string | null;
  locale?: string;
};

// ---- auth ----------------------------------------------------------------

export type RequestOtpDto = { countryId: string; phone: string };
export type VerifyOtpDto = { countryId: string; phone: string; code: string };

export type VerifyOtpResponse = {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  user: AuthUser;
};

export type RefreshResponse = { accessToken: string; refreshToken: string };

// ---- dashboard -------------------------------------------------------------

export const BOOKING_STATUSES = [
  "SEARCHING",
  "PENDING_WORKER",
  "ACCEPTED",
  "ON_THE_WAY",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "NO_WORKER_FOUND",
  "NO_SHOW",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** GET /admin/console/dashboard. Booking maps omit statuses with zero bookings. */
export type Dashboard = {
  bookingsToday: Partial<Record<BookingStatus, number>>;
  bookingsThisWeek: Partial<Record<BookingStatus, number>>;
  pendingVerifications: number;
  openReports: number;
  unresolvedPanicAlerts: number;
  workersBelowLowBalanceThreshold: number;
  instantMatchingFailureRate: {
    totalInstant: number;
    noWorkerFound: number;
    /** 0-100, not 0-1. */
    ratePercent: number;
  };
};

// ---- workers ---------------------------------------------------------------

export const WORKER_STATUSES = ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export type DocumentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DocumentType =
  | "NATIONAL_ID_FRONT"
  | "NATIONAL_ID_BACK"
  | "CRIMINAL_RECORD"
  | "PROFILE_PHOTO"
  | "OTHER";

/**
 * GET /admin/workers items and GET /admin/workers/:id `profile`.
 * NOTE: carries no name or phone (backend gap; see README).
 */
export type WorkerProfile = {
  id: string;
  userId: string;
  countryId: string;
  cityId: string;
  yearsOfExperience: number;
  languages: string[];
  serviceAreas: string[];
  verificationStatus: WorkerStatus;
  rejectionReason: LocalizedText | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  isAvailable: boolean;
  financialStatus: string;
  rating: number;
  completedBookings: number;
  bio: LocalizedText | null;
  createdAt: string;
  updatedAt: string;
};

/** Metadata only. The file itself is behind a short-lived presigned URL. */
export type WorkerDocument = {
  id: string;
  workerProfileId: string;
  type: DocumentType;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  rejectionReason: LocalizedText | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

/** GET /admin/workers/:id */
export type WorkerDetail = { profile: WorkerProfile; documents: WorkerDocument[] };

export type WorkerService = {
  id: string;
  serviceId: string;
  pricingType: "HOURLY" | "BY_SIZE" | "FIXED" | (string & {});
  hourly: { rate: number; minHours: number } | null;
  fixed: { price: number } | null;
  currency: string;
  isActive: boolean;
};

export type BookingSummary = {
  id: string;
  bookingNumber: string;
  type: "SCHEDULED" | "INSTANT";
  status: BookingStatus;
  serviceId: string;
  scheduledFor: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  pricing: { basePrice: number; currency: string } | null;
};

/** GET /admin/console/workers/:id/360 — the parts the console reads. */
export type Worker360 = {
  services: WorkerService[];
  recentBookings: BookingSummary[];
};

export type ReviewDocumentDto = { action: "approve" | "reject"; reason?: LocalizedText };
export type ReviewWorkerDto = { action: "approve" | "reject" | "suspend"; reason?: LocalizedText };
