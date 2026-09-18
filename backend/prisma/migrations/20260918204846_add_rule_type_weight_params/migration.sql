/*
  Warnings:

  - You are about to drop the column `ruleId` on the `Trade` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('CUSTOM', 'MIN_RR', 'MAX_TRADES_PER_DAY', 'MAX_TRADES_PER_WEEK', 'NO_TRADES_AFTER_TIME', 'MAX_DAILY_LOSS', 'REQUIRE_CONFIRMATION');

-- CreateEnum
CREATE TYPE "RuleWeight" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_ruleId_fkey";

-- DropIndex
DROP INDEX "Trade_ruleId_idx";

-- AlterTable
ALTER TABLE "Rule" ADD COLUMN     "params" JSONB,
ADD COLUMN     "type" "RuleType" NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN     "weight" "RuleWeight" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "ruleId",
ADD COLUMN     "autoGrade" "Grade",
ADD COLUMN     "gradeOverridden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TradeRuleBreak" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "TradeRuleBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeRuleBreak_ruleId_idx" ON "TradeRuleBreak"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeRuleBreak_tradeId_ruleId_key" ON "TradeRuleBreak"("tradeId", "ruleId");

-- AddForeignKey
ALTER TABLE "TradeRuleBreak" ADD CONSTRAINT "TradeRuleBreak_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeRuleBreak" ADD CONSTRAINT "TradeRuleBreak_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
