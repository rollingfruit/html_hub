-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FileRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectPath" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "requesterId" INTEGER,
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "reason" TEXT,
    "pendingContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FileRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FileRequest" ("createdAt", "id", "projectPath", "reason", "requestType", "requesterEmail", "requesterId", "requesterName", "status", "updatedAt") SELECT "createdAt", "id", "projectPath", "reason", "requestType", "requesterEmail", "requesterId", "requesterName", "status", "updatedAt" FROM "FileRequest";
DROP TABLE "FileRequest";
ALTER TABLE "new_FileRequest" RENAME TO "FileRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
