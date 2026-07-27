-- 008_fix_badge_duplicates
-- Definitively fix duplicate "Bulan Penuh" badge caused by migration_badge_refactor.sql
-- renaming b1000000-...003 from "Konsisten" to "Bulan Penuh" when b2000000-...013 already existed.
--
-- Changes:
--   1. Restore b1000000-0000-0000-0000-000000000003 as "Konsisten" with emoji icon (not PNG)
--   2. Ensure b2000000-0000-0000-0000-000000000013 is the unique "Bulan Penuh"
--   3. Merge any murid_badges from the duplicate ID into the correct one
--   4. Remove the duplicate badge row if no misi_template references it

-- Step 1: Restore Konsisten with emoji icon (avoid PNG-indexed-transparency issues)
UPDATE badges
   SET nama = 'Konsisten',
       deskripsi = 'Pertahankan streak 5 hari dalam seminggu',
       icon = '📅',
       tipe = 'streak'
 WHERE id = 'b1000000-0000-0000-0000-000000000003';

-- Step 2: Ensure Bulan Penuh is correct
UPDATE badges
   SET nama = 'Bulan Penuh',
       deskripsi = 'Streak 30 hari berturut-turut',
       icon = '🌕',
       tipe = 'streak'
 WHERE id = 'b2000000-0000-0000-0000-000000000013';

-- Step 3: Transfer any murid_badges from old duplicate to the correct ID
-- This handles users who earned "Bulan Penuh" when b1000000-...003 was wrongly renamed.
INSERT INTO murid_badges (murid_id, badge_id, diperoleh_at)
SELECT mb.murid_id, 'b2000000-0000-0000-0000-000000000013', mb.diperoleh_at
  FROM murid_badges mb
 WHERE mb.badge_id = 'b1000000-0000-0000-0000-000000000003'
   AND NOT EXISTS (
     SELECT 1 FROM murid_badges mb2
      WHERE mb2.murid_id = mb.murid_id
        AND mb2.badge_id = 'b2000000-0000-0000-0000-000000000013'
   )
ON CONFLICT (murid_id, badge_id) DO NOTHING;

-- Step 4: Delete the duplicate rows in murid_badges that reference the old ID
DELETE FROM murid_badges WHERE badge_id = 'b1000000-0000-0000-0000-000000000003';

-- Note: b1000000-...003 is kept in the badges table because misi_template
-- "Streak 5 Hari" references it as reward_badge_id.
