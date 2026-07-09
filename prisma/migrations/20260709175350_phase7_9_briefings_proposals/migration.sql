-- CreateEnum
CREATE TYPE "BriefingCadence" AS ENUM ('DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "cadence" "BriefingCadence" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "body" JSONB NOT NULL,
    "valueRecoveredCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prospectUrl" TEXT,
    "body" JSONB NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Briefing_scopeType_scopeId_idx" ON "Briefing"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_publicSlug_key" ON "Proposal"("publicSlug");

-- CreateIndex
CREATE INDEX "Proposal_workspaceId_idx" ON "Proposal"("workspaceId");

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

