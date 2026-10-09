import { MembershipStatus, UserRole } from '../constants/domain.constants';

export interface JwtPayload {
  sub: string;
  username: string;
  uuid_company: string;
  roles: UserRole[];
  membership_status?: MembershipStatus;
  membership_renewal_at?: string | null;
  session_id?: string;
  iat?: number;
  exp?: number;
}

export interface SessionData {
  token: string;
  username: string;
  uuid_company: string;
  roles: UserRole[];
  membership_status?: MembershipStatus;
  membership_renewal_at?: string | null;
}

export interface LoginRequest {
  user_name: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      username: string;
      uuid_company: string;
    };
    session: unknown;
    terms?: {
      access_granted: boolean;
    };
  };
  error?: string;
}
