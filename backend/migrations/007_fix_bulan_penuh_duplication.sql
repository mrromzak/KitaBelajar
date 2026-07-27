-- 007_fix_bulan_penuh_duplication
-- Restore b1000000-0000-0000-0000-000000000003 back to Konsisten
-- Update b2000000-0000-0000-0000-000000000013 to be the unique Bulan Penuh

UPDATE badges 
   SET nama = 'Konsisten', 
       deskripsi = 'Pertahankan streak 5 hari dalam seminggu', 
       icon = 'konsisten .png', 
       tipe = 'streak' 
 WHERE id = 'b1000000-0000-0000-0000-000000000003';

UPDATE badges 
   SET nama = 'Bulan Penuh', 
       deskripsi = 'Streak 30 hari berturut-turut', 
       icon = '🌕', 
       tipe = 'streak' 
 WHERE id = 'b2000000-0000-0000-0000-000000000013';
