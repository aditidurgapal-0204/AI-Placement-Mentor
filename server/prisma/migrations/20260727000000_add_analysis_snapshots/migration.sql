-- Resume extraction is stored separately from analysis so a changed target role
-- can reuse the validated resume facts without another provider call.
ALTER TABLE "PlacementProfile" ADD COLUMN "resumeHash" TEXT;

CREATE TYPE "AnalysisSnapshotStatus" AS ENUM ('COMPLETED', 'FAILED');

CREATE TABLE "ResumeExtraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeHash" TEXT NOT NULL,
    "extractionVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "model" TEXT,
    "facts" JSONB NOT NULL,
    "validationReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeExtraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeExtractionId" TEXT,
    "profileFingerprint" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "scoringVersion" TEXT NOT NULL,
    "reasoningVersion" TEXT NOT NULL,
    "languageVersion" TEXT NOT NULL,
    "status" "AnalysisSnapshotStatus" NOT NULL DEFAULT 'COMPLETED',
    "scoreLedger" JSONB NOT NULL,
    "canonicalEvidence" JSONB NOT NULL,
    "mentorSnapshot" JSONB NOT NULL,
    "analysisV2" JSONB NOT NULL,
    "legacyAnalysis" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResumeExtraction_userId_resumeHash_extractionVersion_key"
  ON "ResumeExtraction"("userId", "resumeHash", "extractionVersion");
CREATE INDEX "ResumeExtraction_userId_createdAt_idx" ON "ResumeExtraction"("userId", "createdAt");
CREATE UNIQUE INDEX "AnalysisSnapshot_userId_inputFingerprint_key"
  ON "AnalysisSnapshot"("userId", "inputFingerprint");
CREATE INDEX "AnalysisSnapshot_userId_createdAt_idx" ON "AnalysisSnapshot"("userId", "createdAt");
CREATE INDEX "AnalysisSnapshot_resumeExtractionId_idx" ON "AnalysisSnapshot"("resumeExtractionId");

ALTER TABLE "ResumeExtraction"
  ADD CONSTRAINT "ResumeExtraction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisSnapshot"
  ADD CONSTRAINT "AnalysisSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisSnapshot"
  ADD CONSTRAINT "AnalysisSnapshot_resumeExtractionId_fkey"
  FOREIGN KEY ("resumeExtractionId") REFERENCES "ResumeExtraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
