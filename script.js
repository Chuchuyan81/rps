// Правильная инициализация Supabase
const supabaseUrl = "https://kdbbyqsdmucjvsatbiog.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYmJ5cXNkbXVjanZzYXRiaW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0MzQxNzcsImV4cCI6MjA2NjAxMDE3N30.v6wR9s1zCyYL-xN2Rohoi35LJ-f1uA1Y5KPPjQoXhLU";

// Ждем загрузки Supabase библиотеки
let supabase = null;

// Делаем supabase доступным глобально для отладки
window.supabaseClient = null;

// Инициализация после загрузки библиотеки
window.addEventListener('DOMContentLoaded', () => {
  // Проверяем доступность Supabase
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded');
    showStatus("Ошибка загрузки библиотеки Supabase", true);
    return;
  }

  try {
    // Правильная инициализация клиента
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false // Отключаем персистентность для простоты
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });

    // Делаем клиент доступным глобально для отладки
    window.supabaseClient = supabase;
    
    console.log('Supabase client initialized:', supabase);
    console.log('Глобальная переменная window.supabaseClient доступна для тестирования');
    showStatus("Готов к игре! Создайте комнату или присоединитесь к существующей.");
    
    // Тестируем подключение
    testConnection();
    
  } catch (error) {
    console.error('Error initializing Supabase:', error);
    showStatus("Ошибка инициализации Supabase: " + error.message, true);
  }
});

// Состояние игры
let gameState = {
  currentRoom: null,
  playerId: null,
  isPlayer1: false,
  channel: null,
  myChoice: null,
  opponentChoice: null,
  gameStatus: 'idle' // idle, waiting, playing, finished
};

// Генерация уникального ID игрока
function generatePlayerId() {
  return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

// Тестирование подключения
async function testConnection() {
  if (!supabase) return;
  
  try {
    const { data, error } = await supabase
      .from('games')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Connection test failed:', error);
      showStatus(`Ошибка подключения к базе данных: ${error.message}`, true);
    } else {
      console.log('Connection test successful');
    }
  } catch (error) {
    console.error('Connection test error:', error);
    showStatus("Ошибка сети. Проверьте подключение к интернету.", true);
  }
}

// Показать статус игры
function showStatus(message, isError = false) {
  const resultEl = document.getElementById("result");
  if (resultEl) {
    resultEl.innerText = message;
    resultEl.className = `result ${isError ? 'error' : ''}`;
  }
  console.log(`Status: ${message}`);
}

// Показать лоадер
function showLoader(show = true) {
  const actionButton = document.getElementById("actionButton");
  if (actionButton) {
    actionButton.disabled = show;
    if (show) {
      actionButton.textContent = "Загрузка...";
      actionButton.classList.add('loading');
    } else {
      actionButton.classList.remove('loading');
      updateButton(); // Восстанавливаем правильный текст
    }
  }
}

// Валидация room_id
function validateRoomId(roomId) {
  const trimmed = roomId.trim();
  if (trimmed.length === 0) {
    return { valid: false, message: "ID комнаты не может быть пустым" };
  }
  if (trimmed.length < 3) {
    return { valid: false, message: "ID комнаты должен содержать минимум 3 символа" };
  }
  if (trimmed.length > 20) {
    return { valid: false, message: "ID комнаты слишком длинный (максимум 20 символов)" };
  }
  if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
    return { valid: false, message: "ID комнаты может содержать только буквы и цифры" };
  }
  return { valid: true, roomId: trimmed };
}

// Динамическое изменение кнопки
function updateButton() {
  const roomInput = document.getElementById("room");
  const actionButton = document.getElementById("actionButton");

  if (!roomInput || !actionButton) return;

  if (roomInput.value.trim() === "") {
    actionButton.textContent = "Создать комнату";
  } else {
    actionButton.textContent = "Присоединиться";
  }
}

// Обработка нажатия на кнопку
async function handleAction() {
  if (!supabase) {
    showStatus("Supabase не инициализирован", true);
    return;
  }

  const roomInput = document.getElementById("room");
  const actionButton = document.getElementById("actionButton");
  
  if (!roomInput || !actionButton) return;

  const room_id = roomInput.value.trim();

  showLoader(true);
  showStatus("");

  try {
    if (actionButton.textContent.includes("Создать")) {
      await createRoom();
    } else {
      const validation = validateRoomId(room_id);
      if (!validation.valid) {
        showStatus(validation.message, true);
        return;
      }
      await joinRoom(validation.roomId);
    }
  } catch (error) {
    console.error("Ошибка в handleAction:", error);
    showStatus(`Произошла ошибка: ${error.message}`, true);
  } finally {
    showLoader(false);
  }
}

// Создание комнаты
async function createRoom() {
  let room_id;
  let attempts = 0;
  const maxAttempts = 5;

  // Генерируем уникальный ID игрока
  gameState.playerId = generatePlayerId();
  gameState.isPlayer1 = true;

  // Создаем уникальный room_id с несколькими попытками
  while (attempts < maxAttempts) {
    room_id = 'room_' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    try {
      const { data: existingRoom, error: checkError } = await supabase
        .from("games")
        .select("room_id")
        .eq("room_id", room_id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (!existingRoom) break;
      attempts++;
    } catch (error) {
      console.error('Error checking room existence:', error);
      attempts++;
    }
  }

  if (attempts >= maxAttempts) {
    throw new Error("Не удалось создать уникальный ID комнаты. Попробуйте еще раз.");
  }

  // Создаем запись в базе данных
  const gameData = {
    room_id: room_id,
    player1_id: gameState.playerId,
    player2_id: null,
    player1_choice: null,
    player2_choice: null,
    status: 'waiting_player2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("games")
    .insert([gameData])
    .select()
    .single();

  if (error) {
    console.error('Error creating room:', error);
    throw new Error(`Ошибка создания комнаты: ${error.message}`);
  }

  console.log('Room created successfully:', data);

  // Обновляем состояние
  gameState.currentRoom = room_id;
  gameState.gameStatus = 'waiting';

  // Обновляем UI
  const roomInput = document.getElementById("room");
  if (roomInput) {
    roomInput.value = room_id;
  }

  showGameUI();
  showStatus(`Комната ${room_id} создана! Ожидание второго игрока...`);
  subscribeToUpdates();
}

// Присоединение к комнате
async function joinRoom(room_id) {
  // Генерируем уникальный ID игрока
  gameState.playerId = generatePlayerId();
  gameState.isPlayer1 = false;

  try {
    // Проверяем существование комнаты
    const { data: existingGame, error: selectError } = await supabase
      .from("games")
      .select("*")
      .eq("room_id", room_id)
      .single();

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        throw new Error("Комната не найдена!");
      }
      throw selectError;
    }

    if (!existingGame) {
      throw new Error("Комната не найдена!");
    }

    if (existingGame.player2_id) {
      throw new Error("Комната уже заполнена!");
    }

    if (existingGame.status !== 'waiting_player2') {
      throw new Error("Комната недоступна для присоединения!");
    }

    // Присоединяемся к комнате
    const { data: updatedGame, error: updateError } = await supabase
      .from("games")
      .update({ 
        player2_id: gameState.playerId,
        status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq("room_id", room_id)
      .eq("player2_id", null) // Дополнительная проверка для избежания race condition
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        throw new Error("Комната уже заполнена!");
      }
      throw updateError;
    }

    console.log('Successfully joined room:', updatedGame);

    // Обновляем состояние
    gameState.currentRoom = room_id;
    gameState.gameStatus = 'ready';

    showGameUI();
    showStatus("Присоединились к комнате! Игра началась!");
    subscribeToUpdates();

  } catch (error) {
    console.error('Error joining room:', error);
    throw error;
  }
}

// Отображение кнопок выбора
function showGameUI() {
  const choices = document.getElementById("choices");
  const roomInput = document.getElementById("room");
  const actionButton = document.getElementById("actionButton");

  if (choices) choices.style.display = "block";
  if (roomInput) roomInput.disabled = true;
  if (actionButton) actionButton.style.display = "none";

  // Изначально блокируем кнопки выбора
  toggleChoiceButtons(false);
}

// Блокировка/разблокировка кнопок выбора
function toggleChoiceButtons(enabled) {
  const buttons = document.querySelectorAll(".choice-btn");
  buttons.forEach(button => {
    button.disabled = !enabled;
    button.style.opacity = enabled ? "1" : "0.5";
  });
}

// Отправка хода
async function makeMove(choice) {
  if (!gameState.currentRoom || !supabase) return;

  if (gameState.myChoice) {
    showStatus("Вы уже сделали ход в этом раунде!", true);
    return;
  }

  if (gameState.gameStatus !== 'ready' && gameState.gameStatus !== 'playing') {
    showStatus("Игра еще не готова!", true);
    return;
  }

  // Сохраняем выбор локально
  gameState.myChoice = choice;
  toggleChoiceButtons(false);
  showStatus(`Ваш выбор: ${choice}. Ожидание хода оппонента...`);

  try {
    // Определяем, какое поле обновлять
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (gameState.isPlayer1) {
      updateData.player1_choice = choice;
    } else {
      updateData.player2_choice = choice;
    }

    // Если это первый ход в раунде, меняем статус на playing
    if (gameState.gameStatus === 'ready') {
      updateData.status = 'playing';
      gameState.gameStatus = 'playing';
    }

    const { error } = await supabase
      .from("games")
      .update(updateData)
      .eq("room_id", gameState.currentRoom);

    if (error) {
      throw error;
    }

    console.log('Move sent successfully:', choice);

  } catch (error) {
    console.error("Ошибка отправки хода:", error);
    showStatus(`Ошибка отправки хода: ${error.message}`, true);
    
    // Откатываем изменения
    gameState.myChoice = null;
    toggleChoiceButtons(true);
  }
}

// Определение победителя
function determineWinner(player1Choice, player2Choice) {
  if (player1Choice === player2Choice) {
    return { winner: 'draw', message: 'Ничья!' };
  }
  
  const rules = { 
    'камень': 'ножницы', 
    'ножницы': 'бумага', 
    'бумага': 'камень' 
  };
  
  const player1Wins = rules[player1Choice] === player2Choice;
  
  if (gameState.isPlayer1) {
    return {
      winner: player1Wins ? 'me' : 'opponent',
      message: player1Wins ? 'Вы победили! 🎉' : 'Вы проиграли! 😢'
    };
  } else {
    return {
      winner: player1Wins ? 'opponent' : 'me',
      message: player1Wins ? 'Вы проиграли! 😢' : 'Вы победили! 🎉'
    };
  }
}

// Сброс раунда
async function resetRound() {
  if (!gameState.currentRoom || !supabase) return;

  try {
    const { error } = await supabase
      .from("games")
      .update({ 
        player1_choice: null, 
        player2_choice: null, 
        status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq("room_id", gameState.currentRoom);

    if (error) {
      throw error;
    }

    // Сбрасываем локальное состояние
    gameState.myChoice = null;
    gameState.opponentChoice = null;
    gameState.gameStatus = 'ready';
    
    toggleChoiceButtons(true);
    showStatus("Новый раунд! Сделайте ваш выбор:");

    console.log('Round reset successfully');

  } catch (error) {
    console.error("Ошибка сброса раунда:", error);
    showStatus(`Ошибка сброса раунда: ${error.message}`, true);
  }
}

// Подписка на обновления
function subscribeToUpdates() {
  if (!supabase || !gameState.currentRoom) return;

  // Закрываем предыдущие подключения
  cleanup();

  console.log('Subscribing to updates for room:', gameState.currentRoom);

  gameState.channel = supabase
    .channel(`game-room-${gameState.currentRoom}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `room_id=eq.${gameState.currentRoom}`
      },
      (payload) => {
        console.log('Received update:', payload);
        handleGameUpdate(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'games',
        filter: `room_id=eq.${gameState.currentRoom}`
      },
      () => {
        showStatus("Игра была завершена", true);
        cleanup();
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to game updates');
      } else if (status === 'CHANNEL_ERROR') {
        showStatus("Ошибка подключения к обновлениям. Перезагрузите страницу.", true);
      }
    });
}

// Обработка обновлений игры
function handleGameUpdate(gameData) {
  const { player1_choice, player2_choice, status, player2_id } = gameData;

  console.log('Handling game update:', gameData);

  // Обновляем статус подключения игроков
  if (status === 'ready' && player2_id) {
    if (gameState.gameStatus === 'waiting') {
      showStatus("Второй игрок присоединился! Сделайте ваш выбор:");
      toggleChoiceButtons(true);
    }
    gameState.gameStatus = 'ready';
  }

  // Обрабатываем ходы
  if (player1_choice || player2_choice) {
    const myChoice = gameState.isPlayer1 ? player1_choice : player2_choice;
    const opponentChoice = gameState.isPlayer1 ? player2_choice : player1_choice;

    // Обновляем локальное состояние
    if (myChoice && !gameState.myChoice) {
      gameState.myChoice = myChoice;
    }
    if (opponentChoice && !gameState.opponentChoice) {
      gameState.opponentChoice = opponentChoice;
      showStatus(`Оппонент сделал ход: ${opponentChoice}. Ожидание результата...`);
    }

    // Если оба сделали ходы, показываем результат
    if (player1_choice && player2_choice) {
      const result = determineWinner(player1_choice, player2_choice);
      const myChoiceDisplay = gameState.isPlayer1 ? player1_choice : player2_choice;
      const opponentChoiceDisplay = gameState.isPlayer1 ? player2_choice : player1_choice;
      
      showStatus(`${result.message} (Вы: ${myChoiceDisplay}, Оппонент: ${opponentChoiceDisplay})`);
      
      gameState.gameStatus = 'finished';
      toggleChoiceButtons(false);
      
      // Автоматический сброс через 4 секунды
      setTimeout(() => {
        resetRound();
      }, 4000);
    }
  }
}

// Очистка ресурсов
function cleanup() {
  if (gameState.channel) {
    supabase.removeChannel(gameState.channel);
    gameState.channel = null;
  }
}

// Полная очистка при выходе
function fullCleanup() {
  cleanup();
  gameState = {
    currentRoom: null,
    playerId: null,
    isPlayer1: false,
    channel: null,
    myChoice: null,
    opponentChoice: null,
    gameStatus: 'idle'
  };
}

// Обработка закрытия страницы
window.addEventListener('beforeunload', () => {
  fullCleanup();
});

// Обработка потери фокуса страницы
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameState.currentRoom) {
    console.log("Страница скрыта");
  } else if (!document.hidden && gameState.currentRoom) {
    console.log("Страница видима");
  }
});
