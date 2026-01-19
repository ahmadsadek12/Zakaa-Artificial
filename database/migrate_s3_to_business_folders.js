// Migration script: Move S3 files to business-specific folders
// This script migrates existing menu and item files from:
//   Old: menus/file.jpg, items/file.jpg
//   New: {businessId}/menus/file.jpg, {businessId}/items/file.jpg

require('dotenv').config();
const { queryMySQL } = require('../src/config/database');
const { s3, S3_CONFIG, extractKeyFromUrl } = require('../src/config/aws');
const logger = require('../src/utils/logger');

/**
 * Extract S3 key from URL
 */
function getS3KeyFromUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    // Remove leading '/' from pathname
    let key = urlObj.pathname.substring(1);
    
    // Remove bucket name if it's in the path
    if (key.startsWith(S3_CONFIG.bucket + '/')) {
      key = key.substring(S3_CONFIG.bucket.length + 1);
    }
    
    return key;
  } catch (error) {
    // Try string replacement method
    return url.replace(S3_CONFIG.baseUrl, '').replace(/^\//, '').replace(/^.*\.s3[^\/]*\//, '');
  }
}

/**
 * Check if key is in old format (needs migration)
 */
function needsMigration(key) {
  if (!key) return false;
  
  // Old format: menus/file.jpg or items/file.jpg
  // New format: {businessId}/menus/file.jpg or {businessId}/items/file.jpg
  return key.startsWith('menus/') || key.startsWith('items/');
}

/**
 * Get business ID from key (for old format files)
 * Since we can't determine business ID from the key alone, this will be passed from database
 */
function getNewKey(oldKey, businessId, folder) {
  if (!oldKey || !businessId) return null;
  
  // Extract filename from old key
  // Old: menus/filename.jpg -> filename.jpg
  // Old: items/filename.jpg -> filename.jpg
  const fileName = oldKey.replace(/^(menus|items)\//, '');
  
  // New: {businessId}/menus/filename.jpg
  // New: {businessId}/items/filename.jpg
  return `${businessId}/${folder}/${fileName}`;
}

/**
 * Copy S3 object from old location to new location
 */
async function copyS3Object(oldKey, newKey) {
  if (!s3) {
    throw new Error('S3 is not configured');
  }
  
  try {
    // Use copyObject to copy within the same bucket (much faster than download/upload)
    await s3.copyObject({
      Bucket: S3_CONFIG.bucket,
      CopySource: `${S3_CONFIG.bucket}/${oldKey}`,
      Key: newKey,
      MetadataDirective: 'COPY' // Copy metadata from source
    }).promise();
    
    logger.info('S3 object copied', { oldKey, newKey });
    return true;
  } catch (error) {
    // If file doesn't exist, that's okay (might have been deleted)
    if (error.code === 'NoSuchKey') {
      logger.warn('S3 object not found (may have been deleted)', { oldKey });
      return false;
    }
    throw error;
  }
}

/**
 * Delete old S3 object
 */
async function deleteOldS3Object(key) {
  if (!s3) return;
  
  try {
    await s3.deleteObject({
      Bucket: S3_CONFIG.bucket,
      Key: key
    }).promise();
    
    logger.info('Old S3 object deleted', { key });
  } catch (error) {
    logger.error('Failed to delete old S3 object', { key, error: error.message });
    // Don't throw - deletion is optional
  }
}

/**
 * Build new S3 URL from key
 */
function buildS3Url(key) {
  if (!key) return null;
  return `${S3_CONFIG.baseUrl}/${key}`;
}

/**
 * Migrate menu files
 */
async function migrateMenus(dryRun = false, deleteOld = false) {
  console.log('\n📋 Migrating menu files...');
  
  // Get all menus with files
  const menus = await queryMySQL(`
    SELECT id, business_id, name, menu_pdf_url, menu_image_urls
    FROM menus
    WHERE (menu_pdf_url IS NOT NULL OR menu_image_urls IS NOT NULL)
      AND deleted_at IS NULL
  `);
  
  console.log(`Found ${menus.length} menus with files to migrate`);
  
  let migratedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (const menu of menus) {
    try {
      let needsUpdate = false;
      const updates = {};
      
      // Migrate PDF URL
      if (menu.menu_pdf_url) {
        const oldKey = getS3KeyFromUrl(menu.menu_pdf_url);
        
        if (oldKey && needsMigration(oldKey)) {
          const newKey = getNewKey(oldKey, menu.business_id, 'menus');
          
          if (dryRun) {
            console.log(`  [DRY RUN] Would migrate menu ${menu.name} PDF: ${oldKey} -> ${newKey}`);
          } else {
            const copied = await copyS3Object(oldKey, newKey);
            
            if (copied) {
              const newUrl = buildS3Url(newKey);
              updates.menu_pdf_url = newUrl;
              needsUpdate = true;
              
              if (deleteOld) {
                await deleteOldS3Object(oldKey);
              }
              
              console.log(`  ✓ Migrated menu "${menu.name}" PDF: ${oldKey.substring(0, 50)}...`);
            } else {
              skippedCount++;
            }
          }
        }
      }
      
      // Migrate image URLs (JSON array)
      if (menu.menu_image_urls) {
        let imageUrls = [];
        
        try {
          imageUrls = typeof menu.menu_image_urls === 'string'
            ? JSON.parse(menu.menu_image_urls)
            : menu.menu_image_urls;
          
          if (!Array.isArray(imageUrls)) {
            imageUrls = [];
          }
        } catch (error) {
          logger.warn('Failed to parse menu_image_urls', { menuId: menu.id, error: error.message });
          // Don't continue - still try to migrate PDF if it exists
          imageUrls = [];
        }
        
        const newImageUrls = [];
        let imagesMigrated = false;
        
        for (const imageUrl of imageUrls) {
          if (!imageUrl) continue;
          
          const oldKey = getS3KeyFromUrl(imageUrl);
          
          if (oldKey && needsMigration(oldKey)) {
            const newKey = getNewKey(oldKey, menu.business_id, 'menus');
            
            if (dryRun) {
              console.log(`  [DRY RUN] Would migrate menu ${menu.name} image: ${oldKey} -> ${newKey}`);
            } else {
              const copied = await copyS3Object(oldKey, newKey);
              
              if (copied) {
                const newUrl = buildS3Url(newKey);
                newImageUrls.push(newUrl);
                imagesMigrated = true;
                
                if (deleteOld) {
                  await deleteOldS3Object(oldKey);
                }
              } else {
                // Keep original URL if copy failed
                newImageUrls.push(imageUrl);
              }
            }
          } else {
            // Already in new format or not an S3 URL, keep as-is
            newImageUrls.push(imageUrl);
          }
        }
        
        if (imagesMigrated && !dryRun) {
          updates.menu_image_urls = JSON.stringify(newImageUrls);
          needsUpdate = true;
          console.log(`  ✓ Migrated ${newImageUrls.length} images for menu "${menu.name}"`);
        }
      }
      
      // Update database
      if (needsUpdate && !dryRun) {
        const updateFields = [];
        const updateValues = [];
        
        if (updates.menu_pdf_url) {
          updateFields.push('menu_pdf_url = ?');
          updateValues.push(updates.menu_pdf_url);
        }
        
        if (updates.menu_image_urls) {
          updateFields.push('menu_image_urls = ?');
          updateValues.push(updates.menu_image_urls);
        }
        
        if (updateFields.length > 0) {
          updateValues.push(menu.id);
          
          await queryMySQL(
            `UPDATE menus SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            updateValues
          );
          
          migratedCount++;
        }
      } else if (needsUpdate && dryRun) {
        migratedCount++;
      }
      
    } catch (error) {
      console.error(`  ✗ Error migrating menu ${menu.name} (${menu.id}):`, error.message);
      logger.error('Menu migration error', { menuId: menu.id, error: error.message, stack: error.stack });
      errorCount++;
    }
  }
  
  console.log(`\nMenu migration complete: ${migratedCount} migrated, ${errorCount} errors, ${skippedCount} skipped\n`);
  return { migratedCount, errorCount, skippedCount };
}

/**
 * Migrate item files
 */
async function migrateItems(dryRun = false, deleteOld = false) {
  console.log('\n📦 Migrating item files...');
  
  // Get all items with images
  const items = await queryMySQL(`
    SELECT id, business_id, name, item_image_url
    FROM items
    WHERE item_image_url IS NOT NULL
      AND deleted_at IS NULL
  `);
  
  console.log(`Found ${items.length} items with images to migrate`);
  
  let migratedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (const item of items) {
    try {
      if (!item.item_image_url) continue;
      
      const oldKey = getS3KeyFromUrl(item.item_image_url);
      
      if (!oldKey || !needsMigration(oldKey)) {
        // Already in new format or not an S3 URL
        continue;
      }
      
      const newKey = getNewKey(oldKey, item.business_id, 'items');
      
      if (dryRun) {
        console.log(`  [DRY RUN] Would migrate item ${item.name} image: ${oldKey} -> ${newKey}`);
        migratedCount++;
      } else {
        const copied = await copyS3Object(oldKey, newKey);
        
        if (copied) {
          const newUrl = buildS3Url(newKey);
          
          // Update database
          await queryMySQL(
            `UPDATE items SET item_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [newUrl, item.id]
          );
          
          if (deleteOld) {
            await deleteOldS3Object(oldKey);
          }
          
          console.log(`  ✓ Migrated item "${item.name}" image: ${oldKey.substring(0, 50)}...`);
          migratedCount++;
        } else {
          skippedCount++;
        }
      }
      
    } catch (error) {
      console.error(`  ✗ Error migrating item ${item.name} (${item.id}):`, error.message);
      logger.error('Item migration error', { itemId: item.id, error: error.message, stack: error.stack });
      errorCount++;
    }
  }
  
  console.log(`\nItem migration complete: ${migratedCount} migrated, ${errorCount} errors, ${skippedCount} skipped\n`);
  return { migratedCount, errorCount, skippedCount };
}

/**
 * Main migration function
 */
async function runMigration() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const deleteOld = args.includes('--delete-old');
  
  console.log('🚀 Starting S3 file migration to business-specific folders...\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Delete old files: ${deleteOld ? 'YES' : 'NO'}\n`);
  
  if (!s3) {
    console.error('❌ S3 is not configured. Please set AWS credentials in .env file');
    process.exit(1);
  }
  
  try {
    // Migrate menus
    const menuResults = await migrateMenus(dryRun, deleteOld);
    
    // Migrate items
    const itemResults = await migrateItems(dryRun, deleteOld);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Menus:  ${menuResults.migratedCount} migrated, ${menuResults.errorCount} errors, ${menuResults.skippedCount} skipped`);
    console.log(`Items:  ${itemResults.migratedCount} migrated, ${itemResults.errorCount} errors, ${itemResults.skippedCount} skipped`);
    console.log(`Total:  ${menuResults.migratedCount + itemResults.migratedCount} files migrated`);
    console.log('='.repeat(60));
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made.');
      console.log('Run without --dry-run to perform the actual migration.');
    } else {
      console.log('\n✅ Migration complete!');
      if (!deleteOld) {
        console.log('⚠️  Old files are still in S3. Run with --delete-old to remove them.');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    logger.error('Migration failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
