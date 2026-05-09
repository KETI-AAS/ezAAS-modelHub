export interface AuthTokenData {
  payload: {
    jwt_access_token: string;
    jwt_refresh_token?: string;
  };
  [key: string]: unknown;
}

export interface TokenProfile {
  user_seq: number;
  user_id: string;
  user_name: string;
  user_group_seq: number;
  user_group_name: string;
  user_photo_url?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPayload {
  profile: TokenProfile;
  exp: number;
  iat: number;
}
