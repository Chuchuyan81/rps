-- Схема игры RPS с Row Level Security и RPC (без открытого DML для anon).
--
-- ВАЖНО: в Dashboard Supabase включите Anonymous sign-ins:
-- Authentication → Providers → Anonymous → Enable
--
-- После изменений: SQL Editor → выполнить этот файл (или раздел миграции на существующей БД).

-- Удаляем старую таблицу если существует (осторожно в продакшене!)
DROP TABLE IF EXISTS games CASCADE;

CREATE TABLE games (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL UNIQUE,
    player1_id TEXT,
    player2_id TEXT,
    player1_choice TEXT CHECK (player1_choice IN ('камень', 'ножницы', 'бумага')),
    player2_choice TEXT CHECK (player2_choice IN ('камень', 'ножницы', 'бумага')),
    status TEXT NOT NULL DEFAULT 'waiting_player2' CHECK (status IN ('waiting_player2', 'ready', 'playing', 'finished')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_games_room_id ON games(room_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created_at ON games(created_at);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Только участники видят строку (нужно для Realtime postgres_changes)
CREATE POLICY "games_select_if_participant" ON games
  FOR SELECT TO authenticated
  USING (
    auth.uid()::text = player1_id
    OR auth.uid()::text = player2_id
  );

-- Прямые INSERT/UPDATE/DELETE с клиента запрещены — только RPC (SECURITY DEFINER)

REVOKE ALL ON TABLE games FROM PUBLIC;
REVOKE ALL ON TABLE games FROM anon;
REVOKE ALL ON TABLE games FROM authenticated;
GRANT SELECT ON TABLE games TO authenticated;

-- ---------- Вспомогательные функции ----------

CREATE OR REPLACE FUNCTION public.rps_health()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN jsonb_build_object('ok', false, 'error', 'not_signed_in')
    ELSE jsonb_build_object('ok', true)
  END;
$$;

-- Создание комнаты: player1 = текущий пользователь (UUID из Anonymous Auth)
CREATE OR REPLACE FUNCTION public.create_rps_room()
RETURNS games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_room_id text;
  v_attempts int := 0;
  v_row games;
BEGIN
  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 25 THEN
      RAISE EXCEPTION 'room_id_exhausted';
    END IF;
    v_room_id := lpad((floor(1000 + random() * 9000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM games g WHERE g.room_id = v_room_id);
  END LOOP;

  INSERT INTO games (room_id, player1_id, player2_id, player1_choice, player2_choice, status)
  VALUES (v_room_id, v_uid, NULL, NULL, NULL, 'waiting_player2')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Присоединение к комнате (room_id: 4 цифры или '9999' для бота)
CREATE OR REPLACE FUNCTION public.join_rps_room(p_room_id text)
RETURNS games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_row games;
BEGIN
  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_room_id IS NULL OR (
    p_room_id !~ '^\d{4}$'
  ) THEN
    RAISE EXCEPTION 'invalid_room_id';
  END IF;

  SELECT * INTO v_row FROM games WHERE room_id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.player1_id IS NOT DISTINCT FROM v_uid THEN
    RETURN v_row;
  END IF;

  IF v_row.player2_id IS NOT NULL AND v_row.player2_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'room_full';
  END IF;

  IF v_row.player2_id IS NULL THEN
    UPDATE games SET
      player2_id = v_uid,
      status = 'ready',
      updated_at = NOW()
    WHERE room_id = p_room_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_rps_move(p_room_id text, p_choice text)
RETURNS games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_row games;
BEGIN
  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_choice NOT IN ('камень', 'ножницы', 'бумага') THEN
    RAISE EXCEPTION 'invalid_choice';
  END IF;

  SELECT * INTO v_row FROM games WHERE room_id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  IF v_row.player1_id IS NOT DISTINCT FROM v_uid THEN
    IF v_row.player1_choice IS NOT NULL THEN
      RAISE EXCEPTION 'move_already_submitted';
    END IF;
    UPDATE games SET
      player1_choice = p_choice,
      status = CASE WHEN status = 'ready' THEN 'playing' ELSE status END,
      updated_at = NOW()
    WHERE room_id = p_room_id
    RETURNING * INTO v_row;
  ELSIF v_row.player2_id IS NOT DISTINCT FROM v_uid THEN
    IF v_row.player2_choice IS NOT NULL THEN
      RAISE EXCEPTION 'move_already_submitted';
    END IF;
    UPDATE games SET
      player2_choice = p_choice,
      status = CASE WHEN status = 'ready' THEN 'playing' ELSE status END,
      updated_at = NOW()
    WHERE room_id = p_room_id
    RETURNING * INTO v_row;
  ELSE
    RAISE EXCEPTION 'not_a_player';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_rps_round(p_room_id text)
RETURNS games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_row games;
BEGIN
  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE games SET
    player1_choice = NULL,
    player2_choice = NULL,
    status = 'ready',
    updated_at = NOW()
  WHERE room_id = p_room_id
    AND (player1_id = v_uid OR player2_id = v_uid)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_a_player_or_room_missing';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_rps_game(p_room_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
BEGIN
  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_room_id = '9999' THEN
    RAISE EXCEPTION 'cannot_delete_bot_room';
  END IF;

  DELETE FROM games
  WHERE room_id = p_room_id
    AND (player1_id = v_uid OR player2_id = v_uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_bot_room()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
BEGIN
  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE games SET
    player2_id = NULL,
    player1_choice = NULL,
    player2_choice = NULL,
    status = 'waiting_player2',
    updated_at = NOW()
  WHERE room_id = '9999'
    AND player1_id = 'bot_player_9999'
    AND player2_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_bot_room()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO games (room_id, player1_id, player2_id, player1_choice, player2_choice, status)
  VALUES ('9999', 'bot_player_9999', NULL, NULL, NULL, 'waiting_player2')
  ON CONFLICT (room_id) DO NOTHING;

  UPDATE games SET
    player2_id = NULL,
    player1_choice = NULL,
    player2_choice = NULL,
    status = 'waiting_player2',
    updated_at = NOW()
  WHERE room_id = '9999'
    AND player1_id = 'bot_player_9999';
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_bot_move()
RETURNS games
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_choice text;
  v_row games;
BEGIN
  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_choice := (ARRAY['камень', 'ножницы', 'бумага'])[1 + floor(random() * 3)::int];

  UPDATE games SET
    player1_choice = v_choice,
    status = CASE WHEN status = 'ready' THEN 'playing' ELSE status END,
    updated_at = NOW()
  WHERE room_id = '9999'
    AND player1_id = 'bot_player_9999'
    AND player2_id = v_uid
    AND player1_choice IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bot_move_not_allowed';
  END IF;

  RETURN v_row;
END;
$$;

-- Триггер updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION cleanup_old_games()
RETURNS void AS $$
BEGIN
  DELETE FROM games
  WHERE created_at < NOW() - INTERVAL '24 hours'
    AND room_id <> '9999';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE games IS 'Игровые сессии RPS; доступ через RPC и SELECT для участников';

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Права на RPC
GRANT EXECUTE ON FUNCTION public.rps_health() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_rps_room() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_rps_room(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rps_move(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_rps_round(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_rps_game(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_bot_room() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_bot_room() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bot_move() TO anon, authenticated;
