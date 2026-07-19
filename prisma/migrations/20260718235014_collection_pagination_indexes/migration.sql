-- CreateIndex
CREATE INDEX "LibraryCharacter_userId_createdAt_id_idx" ON "LibraryCharacter"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "LibraryCharacter_userId_name_id_idx" ON "LibraryCharacter"("userId", "name", "id");

-- CreateIndex
CREATE INDEX "Story_userId_kind_createdAt_id_idx" ON "Story"("userId", "kind", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Story_userId_kind_updatedAt_id_idx" ON "Story"("userId", "kind", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "Story_userId_kind_title_id_idx" ON "Story"("userId", "kind", "title", "id");
