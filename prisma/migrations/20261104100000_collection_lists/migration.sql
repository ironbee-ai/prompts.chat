-- CreateTable
CREATE TABLE "collection_lists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" VARCHAR(500),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_lists_pkey" PRIMARY KEY ("id")
);

-- Default list per user who already has saved prompts
INSERT INTO "collection_lists" ("id", "userId", "name", "slug", "isPublic", "isDefault", "createdAt", "updatedAt")
SELECT
    'cl_default_' || "userId",
    "userId",
    'Saved',
    'saved',
    false,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "userId" FROM "collections") AS existing_users;

-- Add new columns before changing the primary key
ALTER TABLE "collections" ADD COLUMN "listId" TEXT;
ALTER TABLE "collections" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

UPDATE "collections" AS c
SET "listId" = 'cl_default_' || c."userId";

ALTER TABLE "collections" ALTER COLUMN "listId" SET NOT NULL;

ALTER TABLE "collections" DROP CONSTRAINT "collections_pkey";
ALTER TABLE "collections" ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("listId", "promptId");

-- CreateIndex
CREATE UNIQUE INDEX "collection_lists_userId_slug_key" ON "collection_lists"("userId", "slug");
CREATE INDEX "collection_lists_userId_idx" ON "collection_lists"("userId");
CREATE INDEX "collection_lists_userId_isDefault_idx" ON "collection_lists"("userId", "isDefault");
CREATE INDEX "collections_userId_promptId_idx" ON "collections"("userId", "promptId");

-- AddForeignKey
ALTER TABLE "collection_lists" ADD CONSTRAINT "collection_lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collections" ADD CONSTRAINT "collections_listId_fkey" FOREIGN KEY ("listId") REFERENCES "collection_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
