import { NextFunction, Request, Response } from 'express';
import { verifySession } from '../auth/jwt';
import { store } from '../db/store';
import { Role, User } from '../domain/types';
import { unauthorized } from './httpError';

// Express request augmentation: authenticated routes get a typed `req.user`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        record: User;
      };
    }
  }
}

// Verifies the Bearer session token, loads the user, and attaches req.user.
// Applied globally to every /api route so no endpoint is accidentally open.
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Missing Bearer token'));
  }

  let claims;
  try {
    claims = verifySession(token);
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }

  const record = store.users.get(claims.userId);
  if (!record || record.role !== claims.role) {
    return next(unauthorized('Session no longer valid'));
  }

  req.user = { id: record.id, role: record.role, record };
  next();
}
