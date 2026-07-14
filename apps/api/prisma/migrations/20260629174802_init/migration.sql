-- CreateEnum
CREATE TYPE "SportType" AS ENUM ('BADMINTON', 'TENNIS', 'PICKLEBALL', 'SQUASH');

-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('DISCOVERED', 'CONTACT_FOUND', 'VERIFIED', 'UNCERTAIN', 'INVALID', 'EMAIL_SENT', 'REPLIED', 'DEMO_BOOKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'UNCERTAIN', 'INVALID');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'SENT', 'REPLIED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'DISCOVERING', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('DISCOVERY', 'VERIFICATION', 'OUTREACH', 'REPLY_POLL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" JSONB NOT NULL,
    "sportTypes" "SportType"[],
    "autoSendVerified" BOOLEAN NOT NULL DEFAULT false,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 30,
    "followUpDays" INTEGER NOT NULL DEFAULT 5,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "sportType" "SportType" NOT NULL,
    "website" TEXT,
    "source" TEXT NOT NULL DEFAULT 'overpass',
    "externalId" TEXT,
    "status" "ClubStatus" NOT NULL DEFAULT 'DISCOVERED',
    "campaignId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reasoning" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "clubId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outreach" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "clubId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "messageId" TEXT,
    "outreachId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "demoLink" TEXT,
    "signOff" TEXT,
    "teamId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "campaignId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_teamId_idx" ON "Membership"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_teamId_key" ON "Membership"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_teamId_idx" ON "Invite"("teamId");

-- CreateIndex
CREATE INDEX "Campaign_teamId_idx" ON "Campaign"("teamId");

-- CreateIndex
CREATE INDEX "Club_campaignId_status_idx" ON "Club"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Club_campaignId_externalId_key" ON "Club"("campaignId", "externalId");

-- CreateIndex
CREATE INDEX "Contact_clubId_idx" ON "Contact"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Outreach_clubId_key" ON "Outreach"("clubId");

-- CreateIndex
CREATE INDEX "EmailMessage_outreachId_idx" ON "EmailMessage"("outreachId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_teamId_key" ON "EmailTemplate"("teamId");

-- CreateIndex
CREATE INDEX "Job_campaignId_idx" ON "Job"("campaignId");

-- CreateIndex
CREATE INDEX "Activity_teamId_createdAt_idx" ON "Activity"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "Outreach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
