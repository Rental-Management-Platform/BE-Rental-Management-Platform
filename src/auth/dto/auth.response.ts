import type { UserResponse } from '../../users/users.mapper';

export interface TokenResponse {
  readonly accessToken: string;
  /** Số giây access token còn hiệu lực. */
  readonly expiresIn: number;
}

export interface RegisterResponse extends TokenResponse {
  readonly user: UserResponse;
}
