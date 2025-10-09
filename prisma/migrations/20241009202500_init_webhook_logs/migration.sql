-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "web_server_webhook";

-- CreateTable
CREATE TABLE "web_server_webhook"."webhook_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB NOT NULL,
    "headers" JSONB,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "requestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "errorMessage" TEXT,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);
