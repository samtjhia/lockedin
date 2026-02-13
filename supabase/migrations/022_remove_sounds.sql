-- Remove unwanted sounds from the database
DELETE FROM public.sounds 
WHERE icon_key IN ('coffee', 'music', 'wind');
