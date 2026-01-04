import { Request, Response, NextFunction } from 'express';

export function validateWaitlist(req: Request, res: Response, next: NextFunction) {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }
  // Simple email regex
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  return next();
}
