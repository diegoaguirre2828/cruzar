-- =============================================================
-- Cruzar — random handle generation for profile.display_name
-- =============================================================
-- Paste into Supabase SQL editor and run. Idempotent.
--
-- Purpose: never leak email prefixes on public surfaces
-- (leaderboard, reports feed, usernames). Every profile gets a
-- border-cultural random handle at signup (e.g. "cruzante_norte_42").
-- User can customize via /mas Account settings.
--
-- Mirror of lib/handleGenerator.ts — same adjective + noun pools
-- so the SQL backfill and the TS generator produce identical-looking
-- handles. Kept in SQL so new profiles created by Supabase auth
-- triggers get a handle the instant the row lands, before any JS
-- runs.
-- =============================================================

CREATE OR REPLACE FUNCTION cruzar_random_handle()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  adjectives TEXT[] := ARRAY[
    'norte','sur','libre','fuerte','rapido','veloz',
    'silente','alerta','sabio','tranquilo','audaz','feliz',
    'claro','dorado','azul','rojo','verde','plateado',
    'nocturno','diurno','solitario','valiente','sereno','firme',
    'agil','brillante','leal','certero','noble','amable'
  ];
  nouns TEXT[] := ARRAY[
    'cruzante','viajante','guardian','vecino','compa','conductor',
    'lucero','puente','rio','frontera','bordero','rancher',
    'raza','peregrino','explorador','centinela','faro','halcon',
    'aguila','lobo','tigre','zorro','coyote','caballo',
    'camino','sendero','horizonte','mapa','brujula','estrella'
  ];
  noun TEXT;
  adj TEXT;
  num TEXT;
BEGIN
  noun := nouns[1 + floor(random() * array_length(nouns, 1))::int];
  adj := adjectives[1 + floor(random() * array_length(adjectives, 1))::int];
  num := (100 + floor(random() * 9000))::text;
  RETURN noun || '_' || adj || '_' || num;
END;
$$;

-- ─── Trigger: auto-populate display_name on profile INSERT ──────
CREATE OR REPLACE FUNCTION cruzar_fill_display_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    NEW.display_name := cruzar_random_handle();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cruzar_profiles_fill_display_name ON profiles;
CREATE TRIGGER cruzar_profiles_fill_display_name
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION cruzar_fill_display_name();

-- ─── Backfill existing rows ─────────────────────────────────────
-- Hit every profile whose display_name is currently NULL, empty,
-- OR contains an '@' (which means it leaked from an email prefix
-- at some point). Privacy fix — replace with random handles so no
-- existing user's email is visible anywhere public.
UPDATE profiles
SET display_name = cruzar_random_handle()
WHERE display_name IS NULL
   OR display_name = ''
   OR display_name LIKE '%@%';

-- Mark display_name as NOT NULL going forward so new rows can't
-- slip through without one. The trigger above guarantees this for
-- inserts; the constraint just enforces it at the DB level.
-- Commented out because adding NOT NULL on an existing column is
-- a locking operation on a growing table — revisit once we've
-- confirmed the backfill above caught everything.
-- ALTER TABLE profiles ALTER COLUMN display_name SET NOT NULL;
