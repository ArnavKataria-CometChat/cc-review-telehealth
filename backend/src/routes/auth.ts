import { Router } from 'express';
import { z } from 'zod';
import { signSession } from '../auth/jwt';
import { verifyPassword } from '../auth/password';
import { findUserByEmail } from '../db/store';
import { toPublicUser } from '../domain/types';
import { unauthorized } from '../middleware/httpError';
import { audit } from '../services/audit';
import { asyncHandler } from '../utils/asyncHandler';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

// POST /api/auth/login — email+password. Issues a session JWT carrying
// { userId, role } plus the public user object.
authRouter.post(
  '/login',
  asyncHandler((req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      audit(null, 'auth.login_failed', `email:${email}`);
      throw unauthorized('Invalid email or password');
    }
    const token = signSession({ userId: user.id, role: user.role });
    audit({ id: user.id, role: user.role }, 'auth.login', `user:${user.id}`);
    res.json({ token, user: toPublicUser(user) });
  }),
);
