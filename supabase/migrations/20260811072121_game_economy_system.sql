/*
# Game Economy System — single-tenant, no auth

1. Purpose
   Persist player progress for the Astra-Shastra FPS game:
   - Currency earned from kills/waves
   - Unlocked weapons, characters, and maps
   - Best score / stats tracking
   - Settings (graphics, audio, sensitivity, controls)

   This is a single-player game with no sign-in screen, so all data
   is stored in a single row accessible by the anon key.

2. New Tables
   - `player_profile`: singleton row (id=1) with currency, stats, settings JSONB
   - `unlocked_items`: tracks which weapons/characters/maps the player owns

3. Security
   - RLS enabled on all tables
   - Anon + authenticated can CRUD (intentionally public single-tenant data)
   - No user_id / auth — no sign-in screen in this game
*/

-- ============================================================
-- player_profile: singleton game state
-- ============================================================
CREATE TABLE IF NOT EXISTS player_profile (
  id int PRIMARY KEY DEFAULT 1,
  currency int NOT NULL DEFAULT 500,
  total_kills int NOT NULL DEFAULT 0,
  total_waves int NOT NULL DEFAULT 0,
  best_score int NOT NULL DEFAULT 0,
  best_wave int NOT NULL DEFAULT 0,
  games_played int NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE player_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profile" ON player_profile;
CREATE POLICY "anon_select_profile" ON player_profile FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_profile" ON player_profile;
CREATE POLICY "anon_insert_profile" ON player_profile FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_profile" ON player_profile;
CREATE POLICY "anon_update_profile" ON player_profile FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- unlocked_items: weapons, characters, maps the player owns
-- ============================================================
CREATE TABLE IF NOT EXISTS unlocked_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('weapon', 'character', 'map')),
  item_id text NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE (item_type, item_id)
);

ALTER TABLE unlocked_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_unlocks" ON unlocked_items;
CREATE POLICY "anon_select_unlocks" ON unlocked_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_unlocks" ON unlocked_items;
CREATE POLICY "anon_insert_unlocks" ON unlocked_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_unlocks" ON unlocked_items;
CREATE POLICY "anon_delete_unlocks" ON unlocked_items FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Seed: insert the singleton profile row + starter unlocks
-- ============================================================
INSERT INTO player_profile (id, currency) VALUES (1, 500)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO unlocked_items (item_type, item_id)
  SELECT 'weapon', w FROM (VALUES ('insas'), ('katta'), ('grenade36')) AS v(w)
  WHERE NOT EXISTS (
    SELECT 1 FROM unlocked_items WHERE item_type = 'weapon' AND item_id = v.w
  );

INSERT INTO unlocked_items (item_type, item_id)
  SELECT 'character', c FROM (VALUES ('shivaji')) AS v(c)
  WHERE NOT EXISTS (
    SELECT 1 FROM unlocked_items WHERE item_type = 'character' AND item_id = v.c
  );

INSERT INTO unlocked_items (item_type, item_id)
  SELECT 'map', m FROM (VALUES ('amber'), ('jhansi')) AS v(m)
  WHERE NOT EXISTS (
    SELECT 1 FROM unlocked_items WHERE item_type = 'map' AND item_id = v.m
  );
