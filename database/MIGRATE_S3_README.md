# S3 Migration Script - Move Files to Business-Specific Folders

This script migrates existing S3 files from old folder structure to new business-specific folders.

## Before Migration

**Old Structure:**
```
s3-bucket/
  ├── menus/
  │   ├── file1.jpg
  │   └── file2.pdf
  └── items/
      └── file3.jpg
```

## After Migration

**New Structure:**
```
s3-bucket/
  ├── {business-id-1}/
  │   ├── menus/
  │   │   ├── file1.jpg
  │   │   └── file2.pdf
  │   └── items/
  │       └── file3.jpg
  └── {business-id-2}/
      ├── menus/
      └── items/
```

## Usage

### 1. Dry Run (Recommended First Step)

Test the migration without making any changes:

```bash
npm run migrate-s3:dry-run
# or
node database/migrate_s3_to_business_folders.js --dry-run
```

This will show you what would be migrated without actually copying files or updating the database.

### 2. Run Migration (Copy Files Only)

Copy files to new locations and update database, but keep old files:

```bash
npm run migrate-s3
# or
node database/migrate_s3_to_business_folders.js
```

### 3. Run Migration and Delete Old Files

Copy files, update database, and delete old files:

```bash
node database/migrate_s3_to_business_folders.js --delete-old
```

⚠️ **Warning**: `--delete-old` permanently deletes old files. Only use after verifying new files work correctly.

## What It Does

1. **Finds all menus** with PDF or image URLs
2. **Finds all items** with image URLs
3. **Extracts S3 keys** from URLs
4. **Identifies files** in old format (`menus/...` or `items/...`)
5. **Copies files** to new format (`{businessId}/menus/...` or `{businessId}/items/...`)
6. **Updates database** with new URLs
7. **Optionally deletes** old files (with `--delete-old` flag)

## Safety Features

- ✅ Dry run mode to preview changes
- ✅ Skips files already in new format
- ✅ Handles missing files gracefully
- ✅ Updates database only after successful copy
- ✅ Comprehensive error handling and logging

## Requirements

- AWS credentials configured in `.env` file
- S3 bucket accessible
- Database connection configured
- Files must be in old format (`menus/...` or `items/...`)

## Troubleshooting

### Files Not Found
If some files can't be found (already deleted), they'll be skipped and logged.

### Database Errors
The script will continue with other files even if one fails. Check logs for details.

### S3 Permissions
Ensure your AWS credentials have:
- `s3:GetObject` (to read old files)
- `s3:PutObject` (to create new files)
- `s3:DeleteObject` (if using `--delete-old`)

## Example Output

```
🚀 Starting S3 file migration to business-specific folders...

Mode: LIVE
Delete old files: NO

📋 Migrating menu files...
Found 15 menus with files to migrate
  ✓ Migrated menu "Main Menu" PDF: menus/abc123-menu.pdf...
  ✓ Migrated 3 images for menu "Lunch Specials"
  ✓ Migrated menu "Dinner Menu" PDF: menus/def456-menu.pdf...

Menu migration complete: 15 migrated, 0 errors, 0 skipped

📦 Migrating item files...
Found 45 items with images to migrate
  ✓ Migrated item "Pizza Margherita" image: items/ghi789-pizza.jpg...
  ✓ Migrated item "Caesar Salad" image: items/jkl012-salad.jpg...

Item migration complete: 45 migrated, 0 errors, 0 skipped

============================================================
📊 Migration Summary
============================================================
Menus:  15 migrated, 0 errors, 0 skipped
Items:  45 migrated, 0 errors, 0 skipped
Total:  60 files migrated
============================================================

✅ Migration complete!
⚠️  Old files are still in S3. Run with --delete-old to remove them.
```
