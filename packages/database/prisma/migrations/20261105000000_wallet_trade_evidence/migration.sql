-- Frozen pre-trade market evidence for wallet accounting. Null means unknown, never a zero or FDV substitute.
ALTER TABLE "WalletTrade" ADD COLUMN "evidence" JSONB;
