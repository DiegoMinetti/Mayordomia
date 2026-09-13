import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDatabase,
  closeDatabase,
  applyMigrations,
  defaultMigrationsDir,
  type Db,
} from '../../src/db/index.js';

describe('db.schema.001-initial-schema', () => {
  let db: Db;

  beforeEach(() => {
    db = openDatabase({ path: ':memory:' });
    applyMigrations(db, defaultMigrationsDir());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  function tableExists(name: string): boolean {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(name);
    return row !== undefined && row !== null;
  }

  function indexExists(name: string): boolean {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name = ?")
      .get(name);
    return row !== undefined && row !== null;
  }

  it('creates all 24 business tables plus the migrations ledger', () => {
    const expectedTables = [
      'organizations',
      'sites',
      'users',
      'roles',
      'user_roles',
      'role_permissions',
      'public_access_tokens',
      'locations',
      'resources',
      'deliveries',
      'delivery_items',
      'maintenance',
      'maintenance_updates',
      'requests',
      'request_approvals',
      'events',
      'event_areas',
      'event_resources',
      'suppliers',
      'purchase_requests',
      'purchase_request_items',
      'quotes',
      'notifications',
      'audit_log',
      '_mayordomia_migrations',
    ];
    expect(expectedTables).toHaveLength(25);
    for (const t of expectedTables) {
      expect(tableExists(t), `expected table ${t}`).toBe(true);
    }
  });

  it('creates the expected tenant indexes', () => {
    const expected = [
      'idx_sites_org',
      'idx_users_org',
      'idx_users_org_status',
      'idx_roles_org',
      'idx_resources_org',
      'idx_resources_org_status',
      'idx_requests_org',
      'idx_requests_org_status',
      'idx_events_org',
      'idx_notifications_target',
    ];
    for (const i of expected) {
      expect(indexExists(i), `expected index ${i}`).toBe(true);
    }
  });

  it('enforces foreign key on user_roles', () => {
    expect(() =>
      db.exec(
        "INSERT INTO user_roles (user_id, role_id, organization_id, created_at) VALUES ('u1', 'r1', 'o1', '2026-01-01T00:00:00Z')",
      ),
    ).toThrow(/FOREIGN KEY/);
  });

  it('enforces unique (organization_id, email) on users', () => {
    db.exec(
      "INSERT INTO organizations (id, name, created_at) VALUES ('o1', 'Org', '2026-01-01T00:00:00Z')",
    );
    db.exec(
      "INSERT INTO users (id, organization_id, email, name, status, created_at) VALUES ('u1', 'o1', 'a@b.com', 'A', 'ACTIVE', '2026-01-01T00:00:00Z')",
    );
    expect(() =>
      db.exec(
        "INSERT INTO users (id, organization_id, email, name, status, created_at) VALUES ('u2', 'o1', 'a@b.com', 'A2', 'ACTIVE', '2026-01-01T00:00:00Z')",
      ),
    ).toThrow(/UNIQUE/);
  });
});
