-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SeniorityLevel" AS ENUM ('c_level', 'vp', 'director', 'manager', 'individual_contributor', 'unknown');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('developer_admin', 'sales_director', 'sdr_operator', 'read_only');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'enterprise',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'sdr_operator',
    "isDeveloper" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "industry" TEXT,
    "employeeCount" INTEGER,
    "annualRevenueUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT NOT NULL,
    "seniority" "SeniorityLevel" NOT NULL DEFAULT 'unknown',
    "companyName" TEXT NOT NULL,
    "companyDomain" TEXT NOT NULL,
    "industry" TEXT,
    "employeeCount" INTEGER,
    "annualRevenueUsd" DOUBLE PRECISION,
    "stage" TEXT NOT NULL DEFAULT 'discovered',
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "fitScore" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "isQualified" BOOLEAN NOT NULL DEFAULT false,
    "mxHosts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiEmailDraft" TEXT,
    "personalizationPrompt" TEXT,
    "linkedinUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mailbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "dailySendLimit" INTEGER NOT NULL DEFAULT 150,
    "sentTodayCount" INTEGER NOT NULL DEFAULT 0,
    "warmupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warmupStageDay" INTEGER NOT NULL DEFAULT 1,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 95.0,
    "status" TEXT NOT NULL DEFAULT 'warming',
    "spfStatus" TEXT NOT NULL DEFAULT 'verified',
    "dkimStatus" TEXT NOT NULL DEFAULT 'verified',
    "dmarcStatus" TEXT NOT NULL DEFAULT 'verified',
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundDispatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "leadId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "opensCount" INTEGER NOT NULL DEFAULT 0,
    "clicksCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundReply" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "leadId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "sentimentScore" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "suggestedAction" TEXT NOT NULL DEFAULT 'forward_sdr',
    "autoDraftReply" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "InboundReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "operatorEmail" TEXT NOT NULL,
    "operatorRole" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_domain_key" ON "Organization"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_organizationId_domain_key" ON "Account"("organizationId", "domain");

-- CreateIndex
CREATE INDEX "Lead_organizationId_verificationStatus_idx" ON "Lead"("organizationId", "verificationStatus");

-- CreateIndex
CREATE INDEX "Lead_organizationId_stage_idx" ON "Lead"("organizationId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_email_key" ON "Lead"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Mailbox_organizationId_idx" ON "Mailbox"("organizationId");

-- CreateIndex
CREATE INDEX "OutboundDispatch_organizationId_idx" ON "OutboundDispatch"("organizationId");

-- CreateIndex
CREATE INDEX "OutboundDispatch_mailboxId_status_idx" ON "OutboundDispatch"("mailboxId", "status");

-- CreateIndex
CREATE INDEX "InboundReply_organizationId_idx" ON "InboundReply"("organizationId");

-- CreateIndex
CREATE INDEX "InboundReply_mailboxId_status_idx" ON "InboundReply"("mailboxId", "status");

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_timestamp_idx" ON "ActivityLog"("organizationId", "timestamp");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundDispatch" ADD CONSTRAINT "OutboundDispatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundDispatch" ADD CONSTRAINT "OutboundDispatch_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundDispatch" ADD CONSTRAINT "OutboundDispatch_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundReply" ADD CONSTRAINT "InboundReply_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundReply" ADD CONSTRAINT "InboundReply_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundReply" ADD CONSTRAINT "InboundReply_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
