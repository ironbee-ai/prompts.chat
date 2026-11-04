-- CreateIndex
CREATE INDEX "prompts_slug_idx" ON "prompts"("slug");

-- CreateIndex
CREATE INDEX "prompts_isPrivate_isUnlisted_deletedAt_createdAt_idx" ON "prompts"("isPrivate", "isUnlisted", "deletedAt", "createdAt" DESC);
