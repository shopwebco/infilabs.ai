-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "purchasedAt" TIMESTAMP(3),
    "raw" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_integrationId_externalOrderId_key" ON "MarketplaceOrder"("integrationId", "externalOrderId");

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "MarketplaceIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

