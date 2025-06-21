# 🛠 Настройка Supabase для игры "Камень, Ножницы, Бумага"

## 📋 Требования
- Аккаунт в Supabase
- Созданный проект в Supabase

## 🔧 Пошаговая настройка

### 1. Получение API ключей
1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в `Settings` > `API`
4. Скопируйте:
   - **Project URL** (например: `https://yourproject.supabase.co`)
   - **Anon/Public key**

### 2. Обновление ключей в коде
Замените в файле `script.js` строки:
```javascript
const supabaseUrl = "https://kdbbyqsdmucjvsatbiog.supabase.co";
const supabaseKey = "ваш-anon-key-здесь";
```

### 3. Настройка базы данных
1. Перейдите в `Database` > `SQL Editor`
2. Скопируйте содержимое файла `supabase-setup.sql`
3. Выполните SQL запрос

### 4. Проверка Realtime
1. Перейдите в `Database` > `Tables`
2. Найдите таблицу `games`
3. Убедитесь, что в колонке "Realtime" стоит галочка ✅

### 5. Настройка RLS (Row Level Security)
Убедитесь, что политики безопасности настроены:
```sql
-- Проверить статус RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'games';

-- Проверить политики
SELECT * FROM pg_policies WHERE tablename = 'games';
```

## 🔍 Диагностика проблем

### Проблема: "Supabase library not loaded"
**Решение**: Убедитесь, что CDN загружается:
```html
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
```

### Проблема: "Connection test failed"
**Причины**:
1. Неверные API ключи
2. Таблица `games` не создана
3. Неправильные политики RLS

**Решение**:
1. Проверьте API ключи
2. Выполните SQL скрипт setup
3. Проверьте политики безопасности

### Проблема: Realtime не работает
**Решение**:
1. Убедитесь, что таблица добавлена в публикацию:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE games;
```
2. Проверьте в Dashboard: `Database` > `Replication`

### Проблема: "Комната не найдена"
**Причины**:
1. Таблица не создана
2. RLS блокирует доступ
3. Неправильный room_id

**Диагностика**:
```sql
-- Проверить существование таблицы
SELECT * FROM information_schema.tables WHERE table_name = 'games';

-- Проверить данные
SELECT * FROM games LIMIT 5;
```

## 🧪 Тестирование подключения

### Через браузер (консоль разработчика):
```javascript
// Тест подключения
const testSupabase = async () => {
  const { data, error } = await supabase
    .from('games')
    .select('count')
    .limit(1);
  
  console.log('Test result:', { data, error });
};

testSupabase();
```

### Создание тестовой записи:
```javascript
// Создание тестовой комнаты
const testRoom = async () => {
  const { data, error } = await supabase
    .from('games')
    .insert([{
      room_id: 'TEST123',
      player1_id: 'test_player',
      status: 'waiting_player2'
    }])
    .select();
  
  console.log('Test room:', { data, error });
};

testRoom();
```

## 📊 Структура таблицы games

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | BIGSERIAL | Первичный ключ |
| `room_id` | TEXT | Уникальный ID комнаты |
| `player1_id` | TEXT | ID первого игрока |
| `player2_id` | TEXT | ID второго игрока |
| `player1_choice` | TEXT | Выбор игрока 1 |
| `player2_choice` | TEXT | Выбор игрока 2 |
| `status` | TEXT | Статус игры |
| `created_at` | TIMESTAMPTZ | Время создания |
| `updated_at` | TIMESTAMPTZ | Время обновления |

## 🔒 Безопасность

### Рекомендации для продакшена:
1. **Настройте строгие RLS политики**:
```sql
-- Только создатель может видеть игру
CREATE POLICY "Players can see own games" ON games
  FOR SELECT USING (player1_id = auth.uid() OR player2_id = auth.uid());
```

2. **Ограничьте домены**:
   - Настройте CORS в Supabase Dashboard
   - Добавьте только разрешенные домены

3. **Используйте аутентификацию**:
   - Включите авторизацию пользователей
   - Замените анонимный доступ на авторизованный

## 🚀 Развертывание

### GitHub Pages:
1. Обновите API ключи в `script.js`
2. Commit и push изменения
3. Включите GitHub Pages в настройках репозитория

### Vercel/Netlify:
1. Создайте переменные окружения:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Обновите код для использования переменных

## ⚡ Оптимизация

### Индексы базы данных:
```sql
-- Уже созданы в setup скрипте
CREATE INDEX idx_games_room_id ON games(room_id);
CREATE INDEX idx_games_status ON games(status);
```

### Очистка старых данных:
```sql
-- Запустить вручную или настроить cron
SELECT cleanup_old_games();
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте консоль браузера на ошибки
2. Убедитесь, что все SQL скрипты выполнены
3. Проверьте статус Supabase сервисов
4. Обратитесь к [документации Supabase](https://supabase.com/docs) 