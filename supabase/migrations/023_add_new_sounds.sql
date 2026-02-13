-- Add new sounds
-- Note: Replace the placeholder URLs with actual URLs from your storage bucket
INSERT INTO sounds (label, icon_key, file_url)
SELECT 'Rain', 'rain', 'https://example.com/rain.mp3'
WHERE NOT EXISTS (SELECT 1 FROM sounds WHERE icon_key = 'rain');

INSERT INTO sounds (label, icon_key, file_url)
SELECT 'Fire', 'fire', 'https://example.com/fire.mp3'
WHERE NOT EXISTS (SELECT 1 FROM sounds WHERE icon_key = 'fire');

INSERT INTO sounds (label, icon_key, file_url)
SELECT 'Night', 'night', 'https://example.com/night.mp3'
WHERE NOT EXISTS (SELECT 1 FROM sounds WHERE icon_key = 'night');

INSERT INTO sounds (label, icon_key, file_url)
SELECT 'Ocean', 'ocean', 'https://example.com/ocean.mp3'
WHERE NOT EXISTS (SELECT 1 FROM sounds WHERE icon_key = 'ocean');

INSERT INTO sounds (label, icon_key, file_url)
SELECT 'Storm', 'storm', 'https://example.com/storm.mp3'
WHERE NOT EXISTS (SELECT 1 FROM sounds WHERE icon_key = 'storm');

INSERT INTO sounds (label, icon_key, file_url)
SELECT 'White Noise', 'white', 'https://example.com/white.mp3'
WHERE NOT EXISTS (SELECT 1 FROM sounds WHERE icon_key = 'white');
