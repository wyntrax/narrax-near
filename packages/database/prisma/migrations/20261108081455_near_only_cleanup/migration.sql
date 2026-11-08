/*
  Warnings:

  - You are about to drop the column `smartMoneyCorrelation` on the `NarrativeMetric` table. All the data in the column will be lost.
  - You are about to drop the column `smartMoneyScore` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `devHoldingPct` on the `TokenHolderMetric` table. All the data in the column will be lost.
  - You are about to drop the column `smartWalletHolders` on the `TokenHolderMetric` table. All the data in the column will be lost.
  - You are about to drop the column `mode` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `BacktestRun` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChatProposal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConsensusSignal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DryRun` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExecutionAttempt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LinkedWallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PendingConfirmation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PortfolioSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Position` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PositionEvaluation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PositionExit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RiskDecision` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RiskProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SmartMoneySignal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TokenEarlyBuyers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrackedWallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Trade` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TradingPermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletCandidate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletCluster` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletFunding` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletLinkChallenge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletMetric` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletRelationship` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletTrade` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WebhookEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WyntraxEntitlement` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChatProposal" DROP CONSTRAINT "ChatProposal_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "ChatProposal" DROP CONSTRAINT "ChatProposal_userId_fkey";

-- DropForeignKey
ALTER TABLE "ConsensusSignal" DROP CONSTRAINT "ConsensusSignal_tokenId_fkey";

-- DropForeignKey
ALTER TABLE "DryRun" DROP CONSTRAINT "DryRun_userId_fkey";

-- DropForeignKey
ALTER TABLE "ExecutionAttempt" DROP CONSTRAINT "ExecutionAttempt_orderId_fkey";

-- DropForeignKey
ALTER TABLE "LinkedWallet" DROP CONSTRAINT "LinkedWallet_userId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_decisionId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_tokenId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

-- DropForeignKey
ALTER TABLE "PendingConfirmation" DROP CONSTRAINT "PendingConfirmation_userId_fkey";

-- DropForeignKey
ALTER TABLE "PortfolioSnapshot" DROP CONSTRAINT "PortfolioSnapshot_userId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_tokenId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_userId_fkey";

-- DropForeignKey
ALTER TABLE "PositionEvaluation" DROP CONSTRAINT "PositionEvaluation_positionId_fkey";

-- DropForeignKey
ALTER TABLE "PositionExit" DROP CONSTRAINT "PositionExit_positionId_fkey";

-- DropForeignKey
ALTER TABLE "RiskDecision" DROP CONSTRAINT "RiskDecision_decisionId_fkey";

-- DropForeignKey
ALTER TABLE "RiskProfile" DROP CONSTRAINT "RiskProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "SmartMoneySignal" DROP CONSTRAINT "SmartMoneySignal_tokenId_fkey";

-- DropForeignKey
ALTER TABLE "SmartMoneySignal" DROP CONSTRAINT "SmartMoneySignal_walletId_fkey";

-- DropForeignKey
ALTER TABLE "TokenEarlyBuyers" DROP CONSTRAINT "TokenEarlyBuyers_tokenId_fkey";

-- DropForeignKey
ALTER TABLE "TrackedWallet" DROP CONSTRAINT "TrackedWallet_clusterId_fkey";

-- DropForeignKey
ALTER TABLE "TrackedWallet" DROP CONSTRAINT "TrackedWallet_userId_fkey";

-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_positionId_fkey";

-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_userId_fkey";

-- DropForeignKey
ALTER TABLE "TradingPermission" DROP CONSTRAINT "TradingPermission_userId_fkey";

-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_userId_fkey";

-- DropForeignKey
ALTER TABLE "WalletFunding" DROP CONSTRAINT "WalletFunding_walletId_fkey";

-- DropForeignKey
ALTER TABLE "WalletLinkChallenge" DROP CONSTRAINT "WalletLinkChallenge_userId_fkey";

-- DropForeignKey
ALTER TABLE "WalletMetric" DROP CONSTRAINT "WalletMetric_walletId_fkey";

-- DropForeignKey
ALTER TABLE "WalletProfile" DROP CONSTRAINT "WalletProfile_walletId_fkey";

-- DropForeignKey
ALTER TABLE "WalletRelationship" DROP CONSTRAINT "WalletRelationship_fromId_fkey";

-- DropForeignKey
ALTER TABLE "WalletRelationship" DROP CONSTRAINT "WalletRelationship_toId_fkey";

-- DropForeignKey
ALTER TABLE "WalletTrade" DROP CONSTRAINT "WalletTrade_tokenId_fkey";

-- DropForeignKey
ALTER TABLE "WalletTrade" DROP CONSTRAINT "WalletTrade_walletId_fkey";

-- DropIndex
DROP INDEX "AccessGrant_source_status_validUntil_idx";

-- AlterTable
ALTER TABLE "NarrativeMetric" DROP COLUMN "smartMoneyCorrelation";

-- AlterTable
ALTER TABLE "Opportunity" DROP COLUMN "smartMoneyScore";

-- AlterTable
ALTER TABLE "TokenHolderMetric" DROP COLUMN "devHoldingPct",
DROP COLUMN "smartWalletHolders";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "mode";

-- DropTable
DROP TABLE "BacktestRun";

-- DropTable
DROP TABLE "ChatProposal";

-- DropTable
DROP TABLE "ConsensusSignal";

-- DropTable
DROP TABLE "DryRun";

-- DropTable
DROP TABLE "ExecutionAttempt";

-- DropTable
DROP TABLE "LinkedWallet";

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "PendingConfirmation";

-- DropTable
DROP TABLE "PortfolioSnapshot";

-- DropTable
DROP TABLE "Position";

-- DropTable
DROP TABLE "PositionEvaluation";

-- DropTable
DROP TABLE "PositionExit";

-- DropTable
DROP TABLE "RiskDecision";

-- DropTable
DROP TABLE "RiskProfile";

-- DropTable
DROP TABLE "SmartMoneySignal";

-- DropTable
DROP TABLE "TokenEarlyBuyers";

-- DropTable
DROP TABLE "TrackedWallet";

-- DropTable
DROP TABLE "Trade";

-- DropTable
DROP TABLE "TradingPermission";

-- DropTable
DROP TABLE "Wallet";

-- DropTable
DROP TABLE "WalletCandidate";

-- DropTable
DROP TABLE "WalletCluster";

-- DropTable
DROP TABLE "WalletFunding";

-- DropTable
DROP TABLE "WalletLinkChallenge";

-- DropTable
DROP TABLE "WalletMetric";

-- DropTable
DROP TABLE "WalletProfile";

-- DropTable
DROP TABLE "WalletRelationship";

-- DropTable
DROP TABLE "WalletTrade";

-- DropTable
DROP TABLE "WebhookEvent";

-- DropTable
DROP TABLE "WyntraxEntitlement";

-- DropEnum
DROP TYPE "ConfirmationKind";

-- DropEnum
DROP TYPE "ConfirmationStatus";

-- DropEnum
DROP TYPE "EntitlementChain";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "PositionStatus";

-- DropEnum
DROP TYPE "ProposalKind";

-- DropEnum
DROP TYPE "ProposalStatus";

-- DropEnum
DROP TYPE "RiskRoute";

-- DropEnum
DROP TYPE "TradeMode";

-- DropEnum
DROP TYPE "TradeSide";

-- DropEnum
DROP TYPE "TradingMode";

-- DropEnum
DROP TYPE "WalletStyle";

-- DropEnum
DROP TYPE "WyntraxTier";

-- CreateIndex
CREATE INDEX "AccessGrant_tier_status_validUntil_idx" ON "AccessGrant"("tier", "status", "validUntil");

-- CreateIndex
CREATE INDEX "AgentDecision_createdAt_idx" ON "AgentDecision"("createdAt");
