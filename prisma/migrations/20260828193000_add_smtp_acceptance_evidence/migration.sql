ALTER TABLE "OutboundDispatch"
ADD COLUMN "providerResponse" TEXT,
ADD COLUMN "providerAcceptedRecipients" JSONB,
ADD COLUMN "providerRejectedRecipients" JSONB;
