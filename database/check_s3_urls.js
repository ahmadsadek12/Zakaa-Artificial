// Script to check all S3 URLs in database to see what format they're in
require('dotenv').config();
const { queryMySQL } = require('../src/config/database');
const { S3_CONFIG } = require('../src/config/aws');

/**
 * Extract S3 key from URL
 */
function getS3KeyFromUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
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
  return key.startsWith('menus/') || key.startsWith('items/');
}

async function checkS3Urls() {
  console.log('🔍 Checking all S3 URLs in database...\n');
  
  // Check menus
  const menus = await queryMySQL(`
    SELECT id, business_id, name, menu_pdf_url, menu_image_urls
    FROM menus
    WHERE (menu_pdf_url IS NOT NULL OR menu_image_urls IS NOT NULL)
      AND deleted_at IS NULL
  `);
  
  console.log(`📋 Found ${menus.length} menus with files\n`);
  
  let oldFormatCount = 0;
  let newFormatCount = 0;
  let nonS3Count = 0;
  
  for (const menu of menus) {
    console.log(`Menu: ${menu.name} (ID: ${menu.id.substring(0, 8)}...)`);
    
    // Check PDF
    if (menu.menu_pdf_url) {
      const key = getS3KeyFromUrl(menu.menu_pdf_url);
      if (!key) {
        console.log(`  PDF: Non-S3 URL - ${menu.menu_pdf_url.substring(0, 60)}...`);
        nonS3Count++;
      } else if (needsMigration(key)) {
        console.log(`  PDF: OLD FORMAT - ${key}`);
        oldFormatCount++;
      } else {
        console.log(`  PDF: New format - ${key.substring(0, 60)}...`);
        newFormatCount++;
      }
    }
    
    // Check images
    if (menu.menu_image_urls) {
      let imageUrls = [];
      try {
        imageUrls = typeof menu.menu_image_urls === 'string'
          ? JSON.parse(menu.menu_image_urls)
          : menu.menu_image_urls;
        if (!Array.isArray(imageUrls)) imageUrls = [];
      } catch (e) {
        console.log(`  Images: Failed to parse`);
        continue;
      }
      
      console.log(`  Images: ${imageUrls.length} total`);
      for (const url of imageUrls) {
        if (!url) continue;
        const key = getS3KeyFromUrl(url);
        if (!key) {
          console.log(`    - Non-S3 URL - ${url.substring(0, 60)}...`);
          nonS3Count++;
        } else if (needsMigration(key)) {
          console.log(`    - OLD FORMAT - ${key}`);
          oldFormatCount++;
        } else {
          console.log(`    - New format - ${key.substring(0, 60)}...`);
          newFormatCount++;
        }
      }
    }
    
    console.log('');
  }
  
  // Check items
  const items = await queryMySQL(`
    SELECT id, business_id, name, item_image_url
    FROM items
    WHERE item_image_url IS NOT NULL
      AND deleted_at IS NULL
  `);
  
  console.log(`📦 Found ${items.length} items with images\n`);
  
  for (const item of items) {
    const key = getS3KeyFromUrl(item.item_image_url);
    if (!key) {
      console.log(`Item: ${item.name} - Non-S3 URL`);
      nonS3Count++;
    } else if (needsMigration(key)) {
      console.log(`Item: ${item.name} - OLD FORMAT - ${key}`);
      oldFormatCount++;
    } else {
      console.log(`Item: ${item.name} - New format - ${key.substring(0, 60)}...`);
      newFormatCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`Old format (needs migration): ${oldFormatCount}`);
  console.log(`New format (already migrated): ${newFormatCount}`);
  console.log(`Non-S3 URLs: ${nonS3Count}`);
  console.log('='.repeat(60));
}

if (require.main === module) {
  checkS3Urls()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { checkS3Urls };
