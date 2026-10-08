import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:public';

/** Route công khai: không đòi access token (spec 0003 AC-4). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
