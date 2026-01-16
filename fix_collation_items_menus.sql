-- Fix collation mismatch between items and menus tables
-- This fixes the error: Illegal mix of collations (utf8mb4_0900_ai_ci,IMPLICIT) and (utf8mb4_unicode_ci,IMPLICIT)

-- Fix items table columns
ALTER TABLE items 
MODIFY COLUMN id CHAR(36) COLLATE utf8mb4_0900_ai_ci NOT NULL,
MODIFY COLUMN business_id CHAR(36) COLLATE utf8mb4_0900_ai_ci NOT NULL,
MODIFY COLUMN user_id CHAR(36) COLLATE utf8mb4_0900_ai_ci NULL,
MODIFY COLUMN branch_id CHAR(36) COLLATE utf8mb4_0900_ai_ci NULL,
MODIFY COLUMN menu_id CHAR(36) COLLATE utf8mb4_0900_ai_ci NULL,
MODIFY COLUMN name VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
MODIFY COLUMN description TEXT COLLATE utf8mb4_0900_ai_ci NULL,
MODIFY COLUMN ingredients TEXT COLLATE utf8mb4_0900_ai_ci NULL;

-- Fix menus table columns
ALTER TABLE menus 
MODIFY COLUMN id CHAR(36) COLLATE utf8mb4_0900_ai_ci NOT NULL,
MODIFY COLUMN business_id CHAR(36) COLLATE utf8mb4_0900_ai_ci NOT NULL,
MODIFY COLUMN name VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
MODIFY COLUMN description TEXT COLLATE utf8mb4_0900_ai_ci NULL;
