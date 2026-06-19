-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentOnboardingStep" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isOnboardingComplete" BOOLEAN NOT NULL DEFAULT false;
