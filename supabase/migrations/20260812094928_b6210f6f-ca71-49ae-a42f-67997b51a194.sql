CREATE TABLE IF NOT EXISTS public.player_profile (
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

GRANT SELECT, INSERT, UPDATE ON public.player_profile TO anon, authenticated;
GRANT ALL ON public.player_profile TO service_role;

ALTER TABLE public.player_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profile" ON public.player_profile;
CREATE POLICY "anon_select_profile" ON public.player_profile FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_profile" ON public.player_profile;
CREATE POLICY "anon_insert_profile" ON public.player_profile FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_profile" ON public.player_profile;
CREATE POLICY "anon_update_profile" ON public.player_profile FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.unlocked_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('weapon', 'character', 'map')),
  item_id text NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE (item_type, item_id)
);

GRANT SELECT, INSERT, DELETE ON public.unlocked_items TO anon, authenticated;
GRANT ALL ON public.unlocked_items TO service_role;

ALTER TABLE public.unlocked_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_unlocks" ON public.unlocked_items;
CREATE POLICY "anon_select_unlocks" ON public.unlocked_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_unlocks" ON public.unlocked_items;
CREATE POLICY "anon_insert_unlocks" ON public.unlocked_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_unlocks" ON public.unlocked_items;
CREATE POLICY "anon_delete_unlocks" ON public.unlocked_items FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO public.player_profile (id, currency) VALUES (1, 500)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.unlocked_items (item_type, item_id)
  SELECT 'weapon', w FROM (VALUES ('insas'), ('katta'), ('grenade36')) AS v(w)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.unlocked_items WHERE item_type = 'weapon' AND item_id = v.w
  );

INSERT INTO public.unlocked_items (item_type, item_id)
  SELECT 'character', c FROM (VALUES ('shivaji')) AS v(c)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.unlocked_items WHERE item_type = 'character' AND item_id = v.c
  );

INSERT INTO public.unlocked_items (item_type, item_id)
  SELECT 'map', m FROM (VALUES ('amber'), ('jhansi')) AS v(m)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.unlocked_items WHERE item_type = 'map' AND item_id = v.m
  );