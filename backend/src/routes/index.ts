import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { doctorsRouter } from './doctors';
import { slotsRouter } from './slots';
import { appointmentsRouter } from './appointments';
import { clinicsRouter } from './clinics';
import { adminRouter } from './admin';

export const apiRouter = Router();

// Public: login is the only unauthenticated API route.
apiRouter.use('/auth', authRouter);

// Everything below requires a valid session. `authenticate` runs first so no
// downstream route is reachable without a verified { userId, role }.
apiRouter.use(authenticate);
apiRouter.use('/users', usersRouter);
apiRouter.use('/doctors', doctorsRouter);
apiRouter.use('/slots', slotsRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/clinics', clinicsRouter);
apiRouter.use('/admin', adminRouter);
