-- Создание/обновление таблицы games для игры "Камень, Ножницы, Бумага"

-- Удаляем старую таблицу если существует (осторожно в продакшене!)
DROP TABLE IF EXISTS games;

-- Создаем новую таблицу с правильной структурой
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

-- Создаем индексы для быстрого поиска
CREATE INDEX idx_games_room_id ON games(room_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created_at ON games(created_at);

-- Включаем Row Level Security (RLS)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Политики безопасности (разрешаем всем читать и писать для простоты)
-- В продакшене следует настроить более строгие политики
CREATE POLICY "Allow all operations on games" ON games
  FOR ALL USING (true) WITH CHECK (true);

-- Включаем реалтайм для таблицы
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_games_updated_at 
    BEFORE UPDATE ON games 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Функция для очистки старых игр (старше 24 часов)
CREATE OR REPLACE FUNCTION cleanup_old_games()
RETURNS void AS $$
BEGIN
    DELETE FROM games 
    WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Комментарии к таблице и колонкам
COMMENT ON TABLE games IS 'Таблица для хранения игровых сессий "Камень, Ножницы, Бумага"';
COMMENT ON COLUMN games.room_id IS 'Уникальный идентификатор комнаты';
COMMENT ON COLUMN games.player1_id IS 'ID первого игрока (создателя комнаты)';
COMMENT ON COLUMN games.player2_id IS 'ID второго игрока (присоединившегося)';
COMMENT ON COLUMN games.player1_choice IS 'Выбор первого игрока';
COMMENT ON COLUMN games.player2_choice IS 'Выбор второго игрока';
COMMENT ON COLUMN games.status IS 'Статус игры: waiting_player2, ready, playing, finished';
COMMENT ON COLUMN games.created_at IS 'Время создания записи';
COMMENT ON COLUMN games.updated_at IS 'Время последнего обновления записи'; 