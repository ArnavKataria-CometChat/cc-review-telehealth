import { NextFunction, Request, RequestHandler, Response } from 'express';

// Wraps an async route handler so thrown errors/rejections reach errorHandler.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
