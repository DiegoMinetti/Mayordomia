-- 001-initial-schema.sql
-- Initial schema mirroring the Google Sheets tabs that the gateway currently
-- reads/writes. Columns are snake_case in SQL; the Repository interface (PR 2)
-- maps to camelCase for handler compatibility.
--
-- Conventions:
--   - IDs are TEXT (UUIDs generated in app code).
--   - Timestamps are ISO 8601 TEXT set by the app (no DEFAULT now()).
--   - Booleans are INTEGER 0/1 with CHECK constraint.
--   - version column on every business entity for optimistic concurrency.
--   - Every business entity has organization_id for tenant scoping.

-- ============================================================================
-- Tenancy + identity
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sites_org ON sites(organization_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING',
  picture TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org_status ON users(organization_id, status);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Comma-separated permission IDs to keep round-trip with Sheets handlers.
  -- Normalized to a separate table in a future migration if needed.
  permission_ids TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(organization_id);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_org ON user_roles(organization_id);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  PRIMARY KEY (role_id, permission)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_org ON role_permissions(organization_id);

CREATE TABLE IF NOT EXISTS public_access_tokens (
  token TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_public_access_tokens_org ON public_access_tokens(organization_id);

-- ============================================================================
-- Operations: locations, resources, deliveries, maintenance
-- ============================================================================

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'ROOM',
  address TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'ASSET',
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  location_id TEXT REFERENCES locations(id),
  site_id TEXT REFERENCES sites(id),
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_resources_org ON resources(organization_id);
CREATE INDEX IF NOT EXISTS idx_resources_org_status ON resources(organization_id, status);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id TEXT,
  delivered_by TEXT,
  delivered_to TEXT,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN',
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_deliveries_org ON deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_org_status ON deliveries(organization_id, status);

CREATE TABLE IF NOT EXISTS delivery_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  delivery_id TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES resources(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);

CREATE TABLE IF NOT EXISTS maintenance (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_id TEXT REFERENCES resources(id),
  source TEXT NOT NULL DEFAULT 'MANUAL',
  severity TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'OPEN',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  assigned_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_maintenance_org ON maintenance(organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_org_status ON maintenance(organization_id, status);

CREATE TABLE IF NOT EXISTS maintenance_updates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  maintenance_id TEXT NOT NULL REFERENCES maintenance(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  status_after TEXT,
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_maintenance_updates_task ON maintenance_updates(maintenance_id);

-- ============================================================================
-- Requests + approvals
-- ============================================================================

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id TEXT REFERENCES sites(id),
  type TEXT NOT NULL,
  kind TEXT,
  requester_name TEXT NOT NULL,
  requester_email TEXT,
  description TEXT NOT NULL DEFAULT '',
  requested_for TEXT,
  source TEXT NOT NULL DEFAULT 'INTERNAL',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  event_start TEXT,
  event_end TEXT,
  urgency_reason TEXT,
  late_reason TEXT,
  current_area TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_requests_org ON requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_requests_org_status ON requests(organization_id, status);

CREATE TABLE IF NOT EXISTS request_approvals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  area_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewed_by TEXT,
  reviewed_at TEXT,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_request_approvals_request ON request_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_request_approvals_org ON request_approvals(organization_id);

-- ============================================================================
-- Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id TEXT REFERENCES sites(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  calendar_event_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_org_starts ON events(organization_id, starts_at);

CREATE TABLE IF NOT EXISTS event_areas (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  area_id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, area_id)
);

CREATE TABLE IF NOT EXISTS event_resources (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES resources(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (event_id, resource_id)
);

-- ============================================================================
-- Purchases
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id TEXT REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'DRAFT',
  justification TEXT NOT NULL DEFAULT '',
  decision TEXT,
  decided_by TEXT,
  decided_at TEXT,
  total_estimated REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_org ON purchase_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_org_status ON purchase_requests(organization_id, status);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_request_id TEXT NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_pr ON purchase_request_items(purchase_request_id);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_request_id TEXT NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  total REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_quotes_pr ON quotes(purchase_request_id);

-- ============================================================================
-- Notifications + audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_at ON audit_log(organization_id, at);
