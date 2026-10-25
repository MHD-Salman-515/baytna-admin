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
