-- Update the check constraint to allow more icon keys for the new sounds
ALTER TABLE public.sounds DROP CONSTRAINT IF EXISTS sounds_icon_key_check;

ALTER TABLE public.sounds ADD CONSTRAINT sounds_icon_key_check 
CHECK (icon_key IN (
    'rain', 'coffee', 'music', 'fire', 'wind', -- Original set
    'night', 'ocean', 'storm', 'white'         -- New set
));
    