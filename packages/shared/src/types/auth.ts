export interface AuthUser {
  id: string;
  spotifyUserId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}


export interface JwtPayload {
  sub: string;         // internal user UUID
  spotifyUserId: string;
  iat?: number;
  exp?: number;
}
