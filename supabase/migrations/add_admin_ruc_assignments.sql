ALTER TABLE IF EXISTS unit_admins
ADD COLUMN IF NOT EXISTS ruc TEXT;

CREATE TABLE IF NOT EXISTS unit_admin_assignments (
  admin_edipi TEXT NOT NULL,
  ruc TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  PRIMARY KEY (admin_edipi, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_unit_admin_assignments_ruc
  ON unit_admin_assignments (ruc);
