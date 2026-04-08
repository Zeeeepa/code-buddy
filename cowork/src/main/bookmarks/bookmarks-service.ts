/**
 * BookmarksService — Phase 3 step 4
 *
 * Lets users star individual chat messages and browse them later
 * across all sessions/projects. Stores one row per bookmark in
 * SQLite with an index on (projectId, sessionId).
 *
 * @module main/bookmarks/bookmarks-service
 */

import { logWarn } from '../utils/logger';
import type { DatabaseInstance } from '../db/database';

export interface BookmarkEntry {
  id: number;
  sessionId: string;
  projectId?: string | null;
  messageId: string;
  preview: string;
  note?: string | null;
  role?: string | null;
  createdAt: number;
}

export class BookmarksService {
  constructor(private db: DatabaseInstance) {
    this.ensureSchema();
  }

  private ensureSchema(): void {
    const database = this.db.raw;
    try {
      database
        .prepare(
          `CREATE TABLE IF NOT EXISTS message_bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            project_id TEXT,
            message_id TEXT NOT NULL,
            preview TEXT NOT NULL,
            note TEXT,
            role TEXT,
            created_at INTEGER NOT NULL,
            UNIQUE(session_id, message_id)
          )`
        )
        .run();
      database
        .prepare(
          `CREATE INDEX IF NOT EXISTS idx_bookmarks_project ON message_bookmarks(project_id, created_at DESC)`
        )
        .run();
      database
        .prepare(
          `CREATE INDEX IF NOT EXISTS idx_bookmarks_session ON message_bookmarks(session_id, created_at DESC)`
        )
        .run();
    } catch (err) {
      logWarn('[BookmarksService] schema setup failed:', err);
    }
  }

  /** Toggle a bookmark on/off. Returns the new state. */
  toggle(entry: {
    sessionId: string;
    projectId?: string | null;
    messageId: string;
    preview: string;
    role?: string;
  }): { bookmarked: boolean } {
    try {
      const database = this.db.raw;
      const existing = database
        .prepare(`SELECT id FROM message_bookmarks WHERE session_id = ? AND message_id = ?`)
        .get(entry.sessionId, entry.messageId) as { id: number } | undefined;

      if (existing) {
        database
          .prepare(`DELETE FROM message_bookmarks WHERE id = ?`)
          .run(existing.id);
        return { bookmarked: false };
      }

      database
        .prepare(
          `INSERT INTO message_bookmarks (session_id, project_id, message_id, preview, note, role, created_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`
        )
        .run(
          entry.sessionId,
          entry.projectId ?? null,
          entry.messageId,
          entry.preview.slice(0, 500),
          entry.role ?? null,
          Date.now()
        );
      return { bookmarked: true };
    } catch (err) {
      logWarn('[BookmarksService] toggle failed:', err);
      return { bookmarked: false };
    }
  }

  /** Update the user's note on an existing bookmark. */
  updateNote(id: number, note: string): boolean {
    try {
      this.db.raw
        .prepare(`UPDATE message_bookmarks SET note = ? WHERE id = ?`)
        .run(note, id);
      return true;
    } catch (err) {
      logWarn('[BookmarksService] updateNote failed:', err);
      return false;
    }
  }

  /** Delete a bookmark by id. */
  remove(id: number): boolean {
    try {
      this.db.raw.prepare(`DELETE FROM message_bookmarks WHERE id = ?`).run(id);
      return true;
    } catch (err) {
      logWarn('[BookmarksService] remove failed:', err);
      return false;
    }
  }

  /** List bookmarks, optionally filtered by project. */
  list(projectId?: string | null, limit = 100): BookmarkEntry[] {
    try {
      const database = this.db.raw;
      const rows = projectId
        ? database
            .prepare(
              `SELECT id, session_id as sessionId, project_id as projectId, message_id as messageId,
                      preview, note, role, created_at as createdAt
               FROM message_bookmarks
               WHERE project_id = ?
               ORDER BY created_at DESC
               LIMIT ?`
            )
            .all(projectId, limit)
        : database
            .prepare(
              `SELECT id, session_id as sessionId, project_id as projectId, message_id as messageId,
                      preview, note, role, created_at as createdAt
               FROM message_bookmarks
               ORDER BY created_at DESC
               LIMIT ?`
            )
            .all(limit);
      return rows as BookmarkEntry[];
    } catch (err) {
      logWarn('[BookmarksService] list failed:', err);
      return [];
    }
  }

  /** Fetch the set of bookmarked message IDs for one session. */
  getBookmarkedMessageIds(sessionId: string): string[] {
    try {
      const rows = this.db.raw
        .prepare(`SELECT message_id as messageId FROM message_bookmarks WHERE session_id = ?`)
        .all(sessionId) as Array<{ messageId: string }>;
      return rows.map((r) => r.messageId);
    } catch (err) {
      logWarn('[BookmarksService] getBookmarkedMessageIds failed:', err);
      return [];
    }
  }
}
