import { NextFunction, Request, Response } from 'express';
import { Role } from '../domain/types';
import { forbidden, unauthorized } from './httpError';

// Role guard factory. Usage: router.get('/clinics', authorize('admin'), handler).
// Every mutating/role-specific route composes this after `authenticate`.
export function authorize(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(
        forbidden(
          `Requires role: ${allowed.join(' or ')} (you are '${req.user.role}')`,
        ),
      );
    }
    next();
  };
}
