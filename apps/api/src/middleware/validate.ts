import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { badRequest } from '../utils/errors.js';

type Source = 'body' | 'query' | 'params';

/** Validate and coerce a request part with a Zod schema, replacing it with parsed data. */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(badRequest('Validation failed', result.error.flatten()));
    }
    // Query/params are read-only getters in Express 5 but writable in 4; assign defensively.
    if (source === 'body') req.body = result.data;
    else Object.assign(req[source], result.data);
    next();
  };
}
