#!/bin/bash
# Run reservation table migrations on EC2
# This script handles MySQL compatibility (no IF NOT EXISTS support)

cd ~/zakaa

# Get MySQL password from .env
MYSQL_PASS=$(grep MYSQL_PASSWORD .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_NAME="zakaa_db"

if [ -z "$MYSQL_PASS" ]; then
    echo "Error: MYSQL_PASSWORD not found in .env"
    exit 1
fi

echo "Running reservation migrations..."

# Run reservations migration
mysql -u root -p"$MYSQL_PASS" "$DB_NAME" <<EOF
-- Add reservation_type column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'reservations';
SET @columnname = 'reservation_type';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 'Column already exists.'",
  "ALTER TABLE reservations ADD COLUMN reservation_type ENUM('table','appointment','other') DEFAULT 'table' AFTER status"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add other columns
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'owner_user_id') > 0,
  "SELECT 'owner_user_id exists'",
  "ALTER TABLE reservations ADD COLUMN owner_user_id CHAR(36) NULL AFTER business_user_id"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'min_seats_snapshot') > 0,
  "SELECT 'min_seats_snapshot exists'",
  "ALTER TABLE reservations ADD COLUMN min_seats_snapshot INT NULL AFTER table_id"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'max_seats_snapshot') > 0,
  "SELECT 'max_seats_snapshot exists'",
  "ALTER TABLE reservations ADD COLUMN max_seats_snapshot INT NULL AFTER min_seats_snapshot"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'position_snapshot') > 0,
  "SELECT 'position_snapshot exists'",
  "ALTER TABLE reservations ADD COLUMN position_snapshot VARCHAR(100) NULL AFTER max_seats_snapshot"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'platform') > 0,
  "SELECT 'platform exists'",
  "ALTER TABLE reservations ADD COLUMN platform ENUM('whatsapp','telegram','instagram','facebook','dashboard') DEFAULT 'whatsapp' AFTER source"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'completed_at') > 0,
  "SELECT 'completed_at exists'",
  "ALTER TABLE reservations ADD COLUMN completed_at TIMESTAMP NULL AFTER status"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'cancelled_at') > 0,
  "SELECT 'cancelled_at exists'",
  "ALTER TABLE reservations ADD COLUMN cancelled_at TIMESTAMP NULL AFTER completed_at"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Migrate existing data
UPDATE reservations
SET 
  reservation_type = COALESCE(
    CASE 
      WHEN reservation_kind = 'table' THEN 'table'
      WHEN reservation_kind = 'appointment' THEN 'appointment'
      ELSE 'other'
    END,
    'table'
  ),
  owner_user_id = COALESCE(user_id, business_user_id),
  platform = CASE 
    WHEN source = 'whatsapp' THEN 'whatsapp'
    WHEN source = 'telegram' THEN 'telegram'
    WHEN source = 'instagram' THEN 'instagram'
    WHEN source = 'facebook' THEN 'facebook'
    WHEN source = 'dashboard' THEN 'dashboard'
    ELSE 'whatsapp'
  END
WHERE reservation_type IS NULL OR owner_user_id IS NULL OR platform IS NULL;

-- Add indexes (ignore errors if they exist)
CREATE INDEX IF NOT EXISTS idx_res_datetime ON reservations(reservation_date, reservation_time);
CREATE INDEX IF NOT EXISTS idx_res_table ON reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_res_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_res_owner_user_id ON reservations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_res_type ON reservations(reservation_type);
EOF

echo "Reservation migrations completed!"
echo "Restarting PM2..."
pm2 restart zakaa
