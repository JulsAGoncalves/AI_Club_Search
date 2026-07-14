import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { MembershipRole } from '@courtreach/shared';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, forbidden, unauthorized } from '../utils/errors.js';

export interface AuthContext {
  userId: string;
  teamId: string;
  role: MembershipRole;
}

export interface AuthedRequest extends Request {
  auth: AuthContext;
}

export interface JwtPayload {
  sub: string;
}

export function signToken(userId: string): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId } satisfies JwtPayload, env.JWT_SECRET, options);
}

/**
 * Requires a valid Bearer token. Resolves the active team from the
 * `x-team-id` header, falling back to the user's first membership.
 */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) throw unauthorized('Missing bearer token');

  const token = header.slice('Bearer '.length).trim();
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: payload.sub },
    orderBy: { createdAt: 'asc' },
  });
  if (memberships.length === 0) throw unauthorized('User has no team membership');

  const requestedTeamId = req.header('x-team-id');
  const membership =
    (requestedTeamId && memberships.find((m) => m.teamId === requestedTeamId)) ?? memberships[0];

  if (!membership) throw forbidden('No access to the requested team');

  (req as AuthedRequest).auth = {
    userId: membership.userId,
    teamId: membership.teamId,
    role: membership.role,
  };
  next();
});

/** Guard a route to specific roles (use after requireAuth). */
export function requireRole(...roles: MembershipRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { role } = (req as AuthedRequest).auth;
    if (!roles.includes(role)) return next(forbidden('Insufficient role'));
    next();
  };
}
