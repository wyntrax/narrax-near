-- CreateEnum
CREATE TYPE "SmartTradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "SmartWalletStatus" AS ENUM ('QUALIFIED', 'PROVISIONAL', 'INSUFFICIENT');

-- CreateTable
CREATE TABLE "SmartWallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastTradeAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartWalletTrade" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "poolAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "side" "SmartTradeSide" NOT NULL,
    "tokenAmount" DECIMAL(38,18) NOT NULL,
    "priceUsd" DECIMAL(38,18),
    "valueUsd" DECIMAL(38,18) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartWalletTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartWalletProfile" (
    "walletId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeCount" INTEGER NOT NULL,
    "buyCount" INTEGER NOT NULL,
    "sellCount" INTEGER NOT NULL,
    "volumeUsd" DECIMAL(38,2) NOT NULL,
    "totalBoughtUsd" DECIMAL(38,2) NOT NULL,
    "realizedPnlUsd" DECIMAL(38,2) NOT NULL,
    "closedTrades" INTEGER NOT NULL,
    "closedTokens" INTEGER NOT NULL,
    "winningTrades" INTEGER NOT NULL,
    "losingTrades" INTEGER NOT NULL,
    "winRate" DOUBLE PRECISION,
    "medianRoi" DOUBLE PRECISION,
    "profitFactor" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "score" DOUBLE PRECISION,
    "status" "SmartWalletStatus" NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    "reasons" TEXT[],
    "unmatchedSells" INTEGER NOT NULL,
    "excessSellUnits" INTEGER NOT NULL,
    "observedFrom" TIMESTAMP(3),
    "observedTo" TIMESTAMP(3),

    CONSTRAINT "SmartWalletProfile_pkey" PRIMARY KEY ("walletId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmartWallet_address_key" ON "SmartWallet"("address");

-- CreateIndex
CREATE INDEX "SmartWallet_lastTradeAt_idx" ON "SmartWallet"("lastTradeAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmartWalletTrade_externalId_key" ON "SmartWalletTrade"("externalId");

-- CreateIndex
CREATE INDEX "SmartWalletTrade_walletId_at_idx" ON "SmartWalletTrade"("walletId", "at");

-- CreateIndex
CREATE INDEX "SmartWalletTrade_tokenId_at_idx" ON "SmartWalletTrade"("tokenId", "at");

-- CreateIndex
CREATE INDEX "SmartWalletTrade_at_idx" ON "SmartWalletTrade"("at");

-- CreateIndex
CREATE INDEX "SmartWalletProfile_eligible_score_idx" ON "SmartWalletProfile"("eligible", "score");

-- CreateIndex
CREATE INDEX "SmartWalletProfile_realizedPnlUsd_idx" ON "SmartWalletProfile"("realizedPnlUsd");

-- AddForeignKey
ALTER TABLE "SmartWalletTrade" ADD CONSTRAINT "SmartWalletTrade_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SmartWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartWalletTrade" ADD CONSTRAINT "SmartWalletTrade_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartWalletProfile" ADD CONSTRAINT "SmartWalletProfile_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SmartWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
