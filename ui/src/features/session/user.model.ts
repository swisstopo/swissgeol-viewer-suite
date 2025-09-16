import { SimpleUser } from '@swissgeol/ui-core';

export interface User extends SimpleUser {
  email: string;
  groups: string[];
  expiresAt: Date;
}
