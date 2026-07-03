-- CreateTable
CREATE TABLE "parcels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tracking_number" TEXT NOT NULL,
    "customer_name" TEXT,
    "address" TEXT,
    "city" TEXT,
    "cod_amount" REAL,
    "order_no" TEXT,
    "courier_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'logged',
    "last_checkpoint" TEXT,
    "eta" DATETIME,
    "trackingmore_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "parcels_tracking_number_key" ON "parcels"("tracking_number");
