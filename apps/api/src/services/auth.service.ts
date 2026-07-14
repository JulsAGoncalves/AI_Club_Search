import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type {
  AcceptInviteInput,
  AuthResponse,
  InviteMemberInput,
  LoginInput,
  RegisterInput,
} from '@courtreach/shared';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../middleware/auth.js';
import { badRequest, conflict, notFound, unauthorized } from '../utils/errors.js';
import { logActivity } from './activity.service.js';

const SALT_ROUNDS = 10;

function toAuthResponse(
  token: string,
  user: { id: string; name: string; email: string; createdAt: Date },
  team: { id: string; name: string; createdAt: Date },
  role: AuthResponse['role'],
): AuthResponse {
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() },
    team: { id: team.id, name: team.name, createdAt: team.createdAt.toISOString() },
    role,
  };
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with that email already exists');

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const teamName = input.teamName?.trim() || `${input.name}'s Team`;

  const { user, team } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, name: input.name, passwordHash },
    });
    const team = await tx.team.create({ data: { name: teamName } });
    await tx.membership.create({ data: { userId: user.id, teamId: team.id, role: 'OWNER' } });
    return { user, team };
  });

  await logActivity({
    teamId: team.id,
    actor: user.name,
    action: 'created the team',
    userId: user.id,
  });

  return toAuthResponse(signToken(user.id), user, team, 'OWNER');
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { memberships: { include: { team: true }, orderBy: { createdAt: 'asc' } } },
  });
  if (!user) throw unauthorized('Invalid email or password');

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid email or password');

  const membership = user.memberships[0];
  if (!membership) throw unauthorized('User has no team membership');

  return toAuthResponse(signToken(user.id), user, membership.team, membership.role);
}

export async function createInvite(teamId: string, input: InviteMemberInput) {
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  const invite = await prisma.invite.create({
    data: { teamId, email: input.email, role: input.role, token, expiresAt },
  });
  // In production an email would be sent here. For now we return the token/link.
  return invite;
}

export async function acceptInvite(input: AcceptInviteInput): Promise<AuthResponse> {
  const invite = await prisma.invite.findUnique({ where: { token: input.token }, include: { team: true } });
  if (!invite || invite.acceptedAt) throw notFound('Invite not found or already used');
  if (invite.expiresAt < new Date()) throw badRequest('Invite has expired');

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) throw conflict('An account with that email already exists; please log in instead');

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const { user } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: invite.email, name: input.name, passwordHash },
    });
    await tx.membership.create({ data: { userId: user.id, teamId: invite.teamId, role: invite.role } });
    await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return { user };
  });

  await logActivity({
    teamId: invite.teamId,
    actor: user.name,
    action: 'joined the team',
    userId: user.id,
  });

  return toAuthResponse(signToken(user.id), user, invite.team, invite.role);
}
