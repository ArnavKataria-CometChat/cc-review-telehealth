import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from './httpError';
import { config } from '../config';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'not_found', message: `No route ${req.method} ${req.path}` },
  });
}

// Central error handler — normalises HttpError, Zod validation errors, and
// unexpected failures into a consistent JSON envelope.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  if (config.nodeEnv !== 'production') {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(500).json({
    error: { code: 'internal_error', message: 'Something went wrong' },
  });
}
