export interface TokenProfile {
  user_seq: number;
  user_id: string;
  user_name: string;
  user_social_seq: number;
  user_social_id: string;
  user_social_provider_seq: number;
  user_social_provider: string;
  user_group_seq: number;
  user_group_name: string;
  user_photo_url?: string;
  lang_code?: string;
}

export interface UserPayload {
  profile: TokenProfile;
}

export interface TokenPayload {
  iss: string;
  exp: number;
  iat: number;
  profile: TokenProfile;
}

export interface AuthTokenData {
  target: string;
  payload: {
    jwt_access_token: string;
    user: UserPayload;
  };
}
