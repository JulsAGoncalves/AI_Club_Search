import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { teamRouter } from './team.routes.js';
import { campaignRouter } from './campaign.routes.js';
import { groupRouter } from './group.routes.js';
import { clubRouter } from './club.routes.js';
import { activityRouter } from './activity.routes.js';
import { settingsRouter } from './settings.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ ok: true }));
apiRouter.use('/auth', authRouter);
apiRouter.use('/team', teamRouter);
apiRouter.use('/campaigns', campaignRouter);
apiRouter.use('/groups', groupRouter);
apiRouter.use('/clubs', clubRouter);
apiRouter.use('/activity', activityRouter);
apiRouter.use('/settings', settingsRouter);
