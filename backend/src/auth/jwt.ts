import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { Role } from '../domain/types';

// The session payload — exactly the stable identity other clients consume:
// { userId, role }. Later phases map userId -> a CometChat user.
export interface SessionClaims {
  userId: string;
  role: Role;
}

export function signSession(claims: SessionClaims): string {
  const options: SignOptions = {
    expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(claims, config.jwt.secret, options);
}

export function verifySession(token: string): SessionClaims {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as Record<string, unknown>).userId !== 'string' ||
    typeof (decoded as Record<string, unknown>).role !== 'string'
  ) {
    throw new Error('Malformed session token');
  }
  const { userId, role } = decoded as { userId: string; role: Role };
  return { userId, role };
}
