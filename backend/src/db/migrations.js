export const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version INTEGER UNIQUE NOT NULL,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS scans (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          scan_type TEXT NOT NULL,
          target_preview TEXT NOT NULL,
          risk_score INTEGER NOT NULL,
          severity TEXT NOT NULL,
          category TEXT NOT NULL,
          evidence_json TEXT NOT NULL,
          explanation TEXT NOT NULL,
          recommended_actions_json TEXT NOT NULL,
          uncertainty TEXT NOT NULL,
          engine_used TEXT NOT NULL,
          engine_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_scans_user_time ON scans(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_scans_severity ON scans(severity);

        CREATE TABLE IF NOT EXISTS shared_messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          recipient_email TEXT NOT NULL,
          content_snippet TEXT NOT NULL,
          status TEXT NOT NULL,
          risk_score INTEGER NOT NULL,
          severity TEXT NOT NULL,
          blocked_reason TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_shared_sender ON shared_messages(sender_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS appeals (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS privacy_settings (
          user_id TEXT PRIMARY KEY,
          history_retention_days INTEGER NOT NULL DEFAULT 30,
          processing_mode TEXT NOT NULL DEFAULT 'local_only',
          consent_given INTEGER NOT NULL DEFAULT 1,
          email_monitoring_enabled INTEGER NOT NULL DEFAULT 0,
          email_address TEXT,
          email_oauth_scope TEXT,
          email_last_synced TEXT,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          event_type TEXT NOT NULL,
          ip_address TEXT,
          details_json TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
      `);
    }
  }
];

export function runMigrations(db) {
  // Ensure schema_migrations exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all();
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      db.exec('BEGIN TRANSACTION;');
      try {
        migration.up(db);
        db.prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
        ).run(migration.version, migration.name, new Date().toISOString());
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    }
  }
}
