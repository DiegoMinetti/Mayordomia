/**
 * Public surface of the db module. The rest of the gateway should import
 * from here, not from `node:sqlite` directly.
 */
export {
  openDatabase,
  probeDb,
  closeDatabase,
  type Db,
  type OpenDatabaseOptions,
} from './client.js';
export {
  applyMigrations,
  listAppliedMigrations,
  defaultMigrationsDir,
  type AppliedMigration,
  type ApplyMigrationsResult,
} from './migrator.js';
