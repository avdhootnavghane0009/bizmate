import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export function validationMiddleware(schema) {
  return async (req, res, next) => {
    try {
      if (schema.body && req.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query && req.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params && req.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(422).json({
          detail: err.errors.map(e => ({
            loc: [e.path.join('.')],
            msg: e.message,
            type: e.code,
          })),
        });
      }
      next(err);
    }
  };
}
