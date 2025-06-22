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

// Показать уведомление (toast)
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Иконки для разных типов
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Показываем toast
  setTimeout(() => toast.classList.add('show'), 100);
  
  // Автоматически убираем toast
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// Создать контейнер для toast уведомлений
function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// Показать статус игры
function showStatus(message, isError = false) {
  const statusEl = document.getElementById("statusMessage");
  if (statusEl) {
    statusEl.innerText = message;
  }
  console.log(`Status: ${message}`);
  
  // Показываем toast для ошибок
  if (isError) {
    showToast(message, 'error');
  }
}

// Показать лоадер
function showLoader(show = true) {
  const actionButton = document.getElementById("actionButton");
  const buttonText = actionButton?.querySelector('.btn-text');
  
  if (actionButton) {
    actionButton.disabled = show;
    if (show) {
      if (buttonText) {
        buttonText.textContent = "Загрузка...";
      }
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
  if (trimmed.length !== 4) {
    return { valid: false, message: "ID комнаты должен содержать ровно 4 цифры" };
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return { valid: false, message: "ID комнаты должен содержать только цифры" };
  }
  return { valid: true, roomId: trimmed };
}

// Динамическое изменение кнопки
function updateButton() {
  const roomInput = document.getElementById("roomInput");
  const actionButton = document.getElementById("actionButton");
  const buttonText = actionButton?.querySelector('.btn-text');

  if (!roomInput || !actionButton || !buttonText) return;

  // Фильтруем только цифры
  roomInput.value = roomInput.value.replace(/[^0-9]/g, '');

  // Всегда показываем "Создать комнату" когда поле пустое
  // И "Присоединиться" когда поле заполнено
  if (roomInput.value.trim() === "") {
    buttonText.textContent = "Создать комнату";
    console.log("Button set to: Создать комнату");
  } else {
    buttonText.textContent = "Присоединиться";
    console.log(`Button set to: Присоединиться (Room ID: ${roomInput.value})`);
  }
}

// Обработка нажатия на кнопку
async function handleAction() {
  if (!supabase) {
    showStatus("Supabase не инициализирован", true);
    return;
  }

  const roomInput = document.getElementById("roomInput");
  const actionButton = document.getElementById("actionButton");
  const buttonText = actionButton?.querySelector('.btn-text');
  
  if (!roomInput || !actionButton || !buttonText) return;

  const room_id = roomInput.value.trim();
  // Сохраняем оригинальный текст кнопки ДО вызова showLoader
  const originalButtonText = buttonText.textContent;

  showLoader(true);
  showStatus("");

  try {
    if (originalButtonText.includes("Создать")) {
      console.log("Creating new room...");
      await createRoom();
    } else {
      console.log(`Attempting to join room: ${room_id}`);
      // Валидация только при присоединении к комнате
      const validation = validateRoomId(room_id);
      if (!validation.valid) {
        showStatus(validation.message, true);
        showLoader(false);
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
  const maxAttempts = 10;

  // Генерируем уникальный ID игрока
  gameState.playerId = generatePlayerId();
  gameState.isPlayer1 = true;

  // Создаем уникальный room_id из 4 цифр с несколькими попытками
  while (attempts < maxAttempts) {
    // Генерируем ID из 4 случайных цифр
    room_id = Math.floor(1000 + Math.random() * 9000).toString();
    
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
  const roomInput = document.getElementById("roomInput");
  if (roomInput) {
    roomInput.value = room_id;
    roomInput.disabled = true;
    console.log(`Room ID ${room_id} inserted into input field`);
    // Обновляем кнопку после заполнения поля
    updateButton();
    console.log("Button updated after room creation");
  }

  // Переключаемся на секцию ожидания
      showGameState('waitingState');
  displayRoomCode(room_id);
  
  showStatus(`Комната ${room_id} создана! Ожидание второго игрока...`);
  subscribeToUpdates();
}

// Очистка старых/поврежденных комнат (опционально)
async function cleanupOldRooms() {
  try {
    // Удаляем комнаты старше 1 часа
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from("games")
      .delete()
      .lt("created_at", oneHourAgo);

    if (error) {
      console.error('Ошибка очистки старых комнат:', error);
    } else {
      console.log('Старые комнаты очищены');
    }
  } catch (error) {
    console.error('Исключение при очистке:', error);
  }
}

// Присоединение к комнате
async function joinRoom(room_id) {
  // Опциональная очистка старых комнат перед присоединением
  await cleanupOldRooms();
  
  // Генерируем уникальный ID игрока только если его еще нет
  if (!gameState.playerId) {
    gameState.playerId = generatePlayerId();
  }
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

    console.log('Найдена комната для присоединения:', existingGame);
    console.log('Текущий playerId:', gameState.playerId);
    console.log('Player1 ID в комнате:', existingGame.player1_id);
    console.log('Player2 ID в комнате:', existingGame.player2_id);

    // Проверяем, что игрок не пытается присоединиться к своей же комнате
    // НО: пропускаем эту проверку, так как у разных сессий разные playerId
    // if (existingGame.player1_id === gameState.playerId) {
    //   throw new Error("Нельзя присоединиться к своей собственной комнате!");
    // }

    // Проверяем заполненность комнаты
    if (existingGame.player2_id && existingGame.player2_id.trim() !== '') {
      console.log('Комната уже заполнена. player2_id:', existingGame.player2_id);
      throw new Error("Комната уже заполнена!");
    }

    if (existingGame.status !== 'waiting_player2') {
      console.log('Статус комнаты не подходит для присоединения:', existingGame.status);
      throw new Error("Комната недоступна для присоединения!");
    }

    console.log('Все проверки пройдены, присоединяемся к комнате...');

    // Присоединяемся к комнате с дополнительными условиями
    const { data: updatedGame, error: updateError } = await supabase
      .from("games")
      .update({ 
        player2_id: gameState.playerId,
        status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq("room_id", room_id)
      .eq("status", "waiting_player2") // Проверяем статус
      .is("player2_id", null) // Используем is() для проверки NULL
      .select()
      .single();

    if (updateError) {
      console.error('Ошибка при обновлении комнаты:', updateError);
      if (updateError.code === 'PGRST116') {
        throw new Error("Комната уже заполнена или недоступна!");
      }
      throw updateError;
    }

    if (!updatedGame) {
      throw new Error("Не удалось присоединиться к комнате. Возможно, она уже заполнена.");
    }

    console.log('Успешно присоединились к комнате:', updatedGame);

    // Обновляем состояние
    gameState.currentRoom = room_id;
    gameState.gameStatus = 'ready';

    // Переключаемся на игровую секцию
    showGameState('playingState');
    resetPlayerChoices();
    
    showStatus("Присоединились к комнате! Игра началась!");
    
    subscribeToUpdates();

  } catch (error) {
    console.error('Ошибка присоединения к комнате:', error);
    throw error;
  }
}

// Отображение кнопок выбора
function showGameUI() {
  // Переключаемся на игровое состояние
  showGameState('playingState');
  
  // Показываем кнопку выхода
  const exitBtn = document.getElementById('exitBtn');
  if (exitBtn) {
    exitBtn.style.display = 'block';
  }
  
  // Показываем информацию о комнате
  const roomInfo = document.getElementById('roomInfo');
  const roomCodeMini = document.getElementById('roomCodeMini');
  if (roomInfo && roomCodeMini && gameState.currentRoom) {
    roomCodeMini.textContent = gameState.currentRoom;
    roomInfo.style.display = 'block';
  }

  // Активируем кнопки если игра готова (особенно важно для игрока 2)
  if (gameState.gameStatus === 'ready') {
    toggleChoiceButtons(true);
  } else {
    // Изначально блокируем кнопки выбора для ожидания
    toggleChoiceButtons(false);
  }
}

// Блокировка/разблокировка кнопок выбора
function toggleChoiceButtons(enabled) {
  const buttons = document.querySelectorAll(".choice-btn");
  buttons.forEach(button => {
    button.disabled = !enabled;
    button.style.opacity = enabled ? "1" : "0.5";
    button.style.pointerEvents = enabled ? "auto" : "none";
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
  updatePlayerChoice(true, choice);
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
    
    // Сбрасываем отображение выборов игроков
    resetPlayerChoices();
    
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
      // Переключаемся на игровую секцию
      showGameState('playingState');
      resetPlayerChoices();
    }
    gameState.gameStatus = 'ready';
    // Активируем кнопки для обоих игроков когда игра готова
    toggleChoiceButtons(true);
  }

  // Обрабатываем ходы
  if (player1_choice || player2_choice) {
    const myChoice = gameState.isPlayer1 ? player1_choice : player2_choice;
    const opponentChoice = gameState.isPlayer1 ? player2_choice : player1_choice;

    // Обновляем локальное состояние
    if (myChoice && !gameState.myChoice) {
      gameState.myChoice = myChoice;
      updatePlayerChoice(true, myChoice);
    }
    if (opponentChoice && !gameState.opponentChoice) {
      gameState.opponentChoice = opponentChoice;
      // НЕ показываем выбор оппонента до результата
      showStatus("Оппонент сделал ход. Ожидание результата...");
    }

    // Если оба сделали ходы, показываем результат
    if (player1_choice && player2_choice) {
      const result = determineWinner(player1_choice, player2_choice);
      const myChoiceDisplay = gameState.isPlayer1 ? player1_choice : player2_choice;
      const opponentChoiceDisplay = gameState.isPlayer1 ? player2_choice : player1_choice;
      
      // Показываем выбор оппонента только сейчас
      updatePlayerChoice(false, opponentChoiceDisplay);
      
      // Показываем большое модальное окно с результатом
      showGameResult(result.message, myChoiceDisplay, opponentChoiceDisplay, result.winner);
      
      gameState.gameStatus = 'finished';
      toggleChoiceButtons(false);
      
      // Предлагаем сыграть снова через 5 секунд
      setTimeout(() => {
        showStatus("Хотите сыграть еще раз?");
        resetRound();
      }, 5000);
    }
  }
}

// Очистка ресурсов
// Удаление комнаты из БД после игры
async function deleteRoomFromDB() {
  if (!gameState.currentRoom || !supabase) {
    return;
  }

  try {
    const { error } = await supabase
      .from("games")
      .delete()
      .eq("room_id", gameState.currentRoom);

    if (error) {
      console.error('Error deleting room:', error);
    } else {
      console.log(`Room ${gameState.currentRoom} deleted from database`);
    }
  } catch (error) {
    console.error('Exception deleting room:', error);
  }
}

function cleanup() {
  if (gameState.channel) {
    supabase.removeChannel(gameState.channel);
    gameState.channel = null;
  }
}

// Полная очистка при выходе
async function fullCleanup() {
  // Удаляем комнату из БД перед очисткой состояния
  await deleteRoomFromDB();
  
  cleanup();
  
  // Сброс состояния игры
  gameState.currentRoom = null;
  gameState.playerId = null;
  gameState.isPlayer1 = false;
  gameState.myChoice = null;
  gameState.opponentChoice = null;
  gameState.gameStatus = 'idle';

  // Сброс UI
  const roomInput = document.getElementById("roomInput");
  const exitBtn = document.getElementById('exitBtn');
  const roomInfo = document.getElementById('roomInfo');

  if (roomInput) {
    roomInput.disabled = false;
    roomInput.value = "";
  }
  
  // Скрываем кнопку выхода и информацию о комнате
  if (exitBtn) exitBtn.style.display = 'none';
  if (roomInfo) roomInfo.style.display = 'none';

  // Возвращаемся к начальному состоянию
  showGameState('roomState');
  resetPlayerChoices();
  updateButton();

  toggleChoiceButtons(false);
  showStatus("Игра завершена. Комната удалена из базы данных.");
}

// Обработка закрытия страницы
window.addEventListener('beforeunload', (event) => {
  if (gameState.currentRoom) {
    // Синхронный вызов для удаления комнаты
    deleteRoomFromDB();
    cleanup();
  }
});

// Обработка потери фокуса страницы
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameState.currentRoom) {
    console.log("Страница скрыта");
  } else if (!document.hidden && gameState.currentRoom) {
    console.log("Страница видима");
  }
});

// === PWA ФУНКЦИОНАЛЬНОСТЬ ===

// Дополнительные функции для управления PWA установкой
function initializePWAFeatures() {
  console.log('🚀 Инициализация PWA функций');
  
  // Проверяем, если уже в PWA режиме
  if (isPWAMode()) {
    console.log('🔧 Приложение запущено в PWA режиме');
    hidePWAFeatures();
  }
  
  // Добавляем обработчики для кнопки установки
  setupInstallButton();
  
  // Отслеживаем изменения режима отображения
  watchForPWAMode();
}

// Проверка PWA режима (более точная)
function isPWAMode() {
  const displayMode = getPWADisplayMode();
  return displayMode === 'pwa' || 
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

// Получение режима отображения
function getPWADisplayMode() {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'pwa';
  }
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui';
  }
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  return 'browser';
}

// Скрытие PWA элементов если уже установлено
function hidePWAFeatures() {
  const installBtn = document.getElementById('install-btn');
  const pwaFeatures = document.querySelector('.pwa-features');
  
  if (installBtn) {
    installBtn.style.display = 'none';
  }
  
  if (pwaFeatures) {
    pwaFeatures.innerHTML = `
      <p class="features-text">
        🎉 <strong>Приложение установлено!</strong>
        • Работает офлайн • Быстрая загрузка • Доступно с рабочего стола
      </p>
    `;
  }
}

// Настройка кнопки установки
function setupInstallButton() {
  const installBtn = document.getElementById('install-btn');
  if (!installBtn) return;
  
  // Проверяем, нужно ли показывать кнопку
  if (shouldShowInstallButton()) {
    installBtn.style.display = 'flex'; // Показываем кнопку
    
    // Для iOS показываем инструкции
    if (isIOSDevice() && !isPWAMode()) {
      installBtn.onclick = () => {
        showIOSInstallModal();
      };
    }
    
    // Для Android ждем событие beforeinstallprompt (уже обработано в HTML)
  } else {
    installBtn.style.display = 'none';
  }
}

// Проверка необходимости показа кнопки установки
function shouldShowInstallButton() {
  return isMobileDevice() && 
         !isPWAMode() && 
         !localStorage.getItem('pwa-install-dismissed');
}

// Проверка iOS устройства
function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Модальное окно для iOS
function showIOSInstallModal() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
    box-sizing: border-box;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 20px;
      padding: 30px;
      max-width: 350px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    ">
      <h3 style="margin: 0 0 20px 0; color: #333;">📱 Установить приложение</h3>
      <div style="text-align: left; margin: 20px 0; line-height: 1.6; color: #666;">
        <p style="margin: 10px 0;"><strong>1.</strong> Нажмите кнопку "Поделиться" (📤) внизу экрана</p>
        <p style="margin: 10px 0;"><strong>2.</strong> Выберите "На экран Домой" или "Add to Home Screen"</p>
        <p style="margin: 10px 0;"><strong>3.</strong> Нажмите "Добавить"</p>
        <p style="margin: 20px 0 0 0; text-align: center; color: #28a745; font-weight: bold;">
          🎉 Приложение появится на рабочем столе!
        </p>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 25px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 10px;
      ">Понятно</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Закрытие по клику вне модального окна
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
}

// Отслеживание изменений PWA режима
function watchForPWAMode() {
  // Проверяем при изменении медиа-запросов
  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  mediaQuery.addEventListener('change', (e) => {
    if (e.matches) {
      console.log('🎉 Переключение в PWA режим');
      hidePWAFeatures();
    }
  });
}

// Проверка мобильного устройства (улучшенная)
function isMobileDevice() {
  // Проверка User Agent
  const userAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Проверка сенсорного экрана
  const touchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Проверка размера экрана
  const smallScreen = window.innerWidth <= 768;
  
  // Проверка iPad с клавиатурой (определяется как desktop)
  const iPadPro = navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform);
  
  return userAgent || (touchScreen && smallScreen) || iPadPro;
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  // Небольшая задержка для загрузки других скриптов
  setTimeout(initializePWAFeatures, 100);
});

// Дополнительная проверка при загрузке страницы
window.addEventListener('load', () => {
  console.log('📋 PWA статус при загрузке:');
  console.log('- Мобильное устройство:', isMobileDevice());
  console.log('- PWA режим:', isPWAMode());
  console.log('- Режим отображения:', getPWADisplayMode());
  console.log('- iOS устройство:', isIOSDevice());
});

// === НОВЫЕ ФУНКЦИИ ДЛЯ ОБНОВЛЕННОГО UI ===

// Очистка поля ввода
function clearInput() {
  const roomInput = document.getElementById("roomInput");
  if (roomInput) {
    roomInput.value = "";
    roomInput.focus();
    updateButton();
  }
}

// Управление боковым меню
function toggleMenu() {
  const sideMenu = document.getElementById('sideMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  
  if (sideMenu && menuOverlay) {
    const isOpen = sideMenu.classList.contains('open');
    
    if (isOpen) {
      sideMenu.classList.remove('open');
      menuOverlay.classList.remove('open');
    } else {
      sideMenu.classList.add('open');
      menuOverlay.classList.add('open');
    }
  }
}

// Показать случайную игру
function showRandomDialog() {
  showToast("Функция в разработке", 'info');
}

// Показать доступные комнаты
async function showAvailableRooms() {
  if (!supabase) {
    showStatus("Supabase не инициализирован", true);
    return;
  }

  showLoader(true);
  showStatus("Поиск доступных комнат...");

  try {
    // Получаем все комнаты, которые ожидают второго игрока
    const { data: availableRooms, error } = await supabase
      .from('games')
      .select('room_id, created_at')
      .eq('status', 'waiting')
      .is('player2_id', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Ошибка получения доступных комнат:', error);
      showStatus("Ошибка получения списка комнат", true);
      return;
    }

    if (!availableRooms || availableRooms.length === 0) {
      showToast("Нет доступных комнат. Создайте новую!", 'info');
      showStatus("Нет доступных комнат");
      return;
    }

    // Создаем модальное окно со списком комнат
    showAvailableRoomsModal(availableRooms);

  } catch (error) {
    console.error('Ошибка при поиске комнат:', error);
    showStatus("Произошла ошибка при поиске комнат", true);
  } finally {
    showLoader(false);
  }
}

// Показать модальное окно с доступными комнатами
function showAvailableRoomsModal(rooms) {
  // Удаляем существующее модальное окно если есть
  const existingModal = document.getElementById('availableRoomsModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'availableRoomsModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
    box-sizing: border-box;
  `;

  const roomsList = rooms.map(room => {
    const timeAgo = getTimeAgo(room.created_at);
    return `
      <div class="room-item" onclick="joinRoomFromList('${room.room_id}')" style="
        background: rgba(255, 255, 255, 0.1);
        padding: 12px 16px;
        border-radius: 12px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        justify-content: space-between;
        align-items: center;
      " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" 
         onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
        <div>
          <div style="font-weight: 600; font-size: 18px; color: #6366f1;">Комната ${room.room_id}</div>
          <div style="font-size: 12px; color: #94a3b8;">Создана ${timeAgo}</div>
        </div>
        <div style="color: #10b981; font-size: 12px;">Присоединиться →</div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="
      background: #1e293b;
      border-radius: 20px;
      padding: 24px;
      max-width: 400px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #f8fafc; font-size: 20px;">Доступные комнаты</h3>
        <button onclick="this.closest('#availableRoomsModal').remove()" style="
          background: rgba(255,255,255,0.1);
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          color: #f8fafc;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        ">✕</button>
      </div>
      <div style="color: #cbd5e1; margin-bottom: 16px; font-size: 14px;">
        Найдено комнат: ${rooms.length}
      </div>
      <div class="rooms-list">
        ${roomsList}
      </div>
      <div style="margin-top: 16px; text-align: center;">
        <button onclick="this.closest('#availableRoomsModal').remove()" style="
          background: rgba(255,255,255,0.1);
          border: none;
          padding: 10px 20px;
          border-radius: 12px;
          color: #cbd5e1;
          cursor: pointer;
          font-size: 14px;
        ">Закрыть</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Закрытие по клику вне модального окна
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
}

// Присоединиться к комнате из списка
async function joinRoomFromList(roomId) {
  // Закрываем модальное окно
  const modal = document.getElementById('availableRoomsModal');
  if (modal) {
    modal.remove();
  }

  // Заполняем поле ввода и присоединяемся
  const roomInput = document.getElementById("roomInput");
  if (roomInput) {
    roomInput.value = roomId;
    updateButton();
  }

  await joinRoom(roomId);
}

// Получить время "назад" для отображения
function getTimeAgo(dateString) {
  const now = new Date();
  const created = new Date(dateString);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин назад`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} дн назад`;
}

// Обновление статистики
function updateStats(wins = 0, losses = 0, draws = 0) {
  // Обновляем статистику в localStorage если переданы параметры
  if (arguments.length > 0) {
    localStorage.setItem('rps_wins', wins.toString());
    localStorage.setItem('rps_losses', losses.toString());
    localStorage.setItem('rps_draws', draws.toString());
  }
  
  // Получаем текущую статистику из localStorage
  const currentWins = parseInt(localStorage.getItem('rps_wins') || '0');
  const currentLosses = parseInt(localStorage.getItem('rps_losses') || '0');
  const currentDraws = parseInt(localStorage.getItem('rps_draws') || '0');
  
  // Обновляем отображение
  const winsEl = document.getElementById('winsCount');
  const lossesEl = document.getElementById('lossesCount');
  const drawsEl = document.getElementById('drawsCount');
  
  if (winsEl) winsEl.textContent = currentWins;
  if (lossesEl) lossesEl.textContent = currentLosses;
  if (drawsEl) drawsEl.textContent = currentDraws;
}

// Обновление выборов игроков
function updatePlayerChoice(isMyChoice, choice) {
  const targetId = isMyChoice ? 'myChoice' : 'opponentChoice';
  const element = document.getElementById(targetId);
  const statusId = isMyChoice ? 'myStatus' : 'opponentStatus';
  const statusElement = document.getElementById(statusId);
  
  if (element) {
    const emojiMap = {
      'камень': '🪨',
      'ножницы': '✂️',
      'бумага': '📄'
    };
    
    element.innerHTML = `<div class="choice-result">${emojiMap[choice] || choice}</div>`;
  }
  
  if (statusElement) {
    statusElement.textContent = isMyChoice ? 'Ход сделан' : 'Ход сделан';
  }
}

// Сброс выборов игроков
function resetPlayerChoices() {
  const myChoice = document.getElementById('myChoice');
  const opponentChoice = document.getElementById('opponentChoice');
  const myStatus = document.getElementById('myStatus');
  const opponentStatus = document.getElementById('opponentStatus');
  
  if (myChoice) {
    myChoice.innerHTML = '<div class="choice-placeholder">?</div>';
  }
  if (opponentChoice) {
    opponentChoice.innerHTML = '<div class="choice-placeholder">?</div>';
  }
  if (myStatus) {
    myStatus.textContent = 'Ваш ход';
  }
  if (opponentStatus) {
    opponentStatus.textContent = 'Ожидание';
  }
}

// Обновление таймера игры
function startGameTimer(duration = 30) {
  const timerText = document.querySelector('.timer-text');
  const timerProgress = document.querySelector('.timer-progress');
  
  if (!timerText || !timerProgress) return;
  
  let timeLeft = duration;
  const circumference = 113; // 2 * PI * 18 (радиус круга)
  
  const timer = setInterval(() => {
    const progress = (timeLeft / duration) * circumference;
    timerProgress.style.strokeDashoffset = circumference - progress;
    timerText.textContent = timeLeft;
    
    if (timeLeft <= 0) {
      clearInterval(timer);
      // Автоматический выбор или действие при истечении времени
      showToast('Время вышло!', 'warning');
    }
    
    timeLeft--;
  }, 1000);
  
  return timer;
}

// Анимация выбора
function animateChoice(choice) {
  const choiceCards = document.querySelectorAll('.choice-card');
  choiceCards.forEach(card => {
    card.classList.remove('selected');
    if (card.dataset.choice === choice) {
      card.classList.add('selected');
    }
  });
}

// Показ уведомления об обновлении
function showUpdateToast() {
  const toast = document.createElement('div');
  toast.className = 'toast info';
  toast.innerHTML = `
    <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2"/>
      <path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="toast-message">Доступно обновление приложения</span>
    <button class="primary-button" onclick="updateApp()" style="margin-left: 12px; height: 32px; padding: 0 16px; font-size: 0.875rem;">
      Обновить
    </button>
  `;
  
  const container = document.getElementById('toastContainer');
  if (container) {
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
  }
}

// Обновление приложения
function updateApp() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
}

// Модальное окно для iOS установки
function showIOSInstallModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">Установить приложение</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 3rem; margin-bottom: 16px;">📱</div>
          <p style="font-size: 1.125rem; font-weight: 600; margin-bottom: 16px;">Установите приложение на устройство</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 16px; font-size: 0.875rem; line-height: 1.6;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 24px; height: 24px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.75rem;">1</div>
            <span>Нажмите кнопку "Поделиться" (📤) внизу экрана</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 24px; height: 24px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.75rem;">2</div>
            <span>Выберите "На экран Домой" или "Add to Home Screen"</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 24px; height: 24px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.75rem;">3</div>
            <span>Нажмите "Добавить"</span>
          </div>
        </div>
        <div style="text-align: center; margin-top: 24px; padding: 16px; background: var(--surface-variant); border-radius: var(--border-radius-small);">
          <span style="font-weight: 600; color: var(--success);">🎉 Приложение появится на рабочем столе!</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="primary-button" onclick="this.parentElement.parentElement.parentElement.remove()">
          Понятно
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  
  // Закрытие по клику вне модального окна
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
      document.body.style.overflow = '';
    }
  };
}

// Инициализация нового UI при загрузке
document.addEventListener('DOMContentLoaded', () => {
  // Инициализируем начальное состояние
  showGameState('roomState');
  
  // Добавляем обработчики для закрытия модальных окон по клику вне них
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  });
  
  // Инициализируем статистику (без параметров - загружаем из localStorage)
  updateStats();
  
  // Инициализируем статус подключения
  updateConnectionStatus(navigator.onLine);
  
  console.log('🎨 Новый UI инициализирован');
});

// Показ результата игры в большом модальном окне
function showGameResult(message, myChoice, opponentChoice, winner) {
  const modal = document.createElement('div');
  modal.className = 'game-result-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
    box-sizing: border-box;
    animation: fadeIn 0.3s ease;
  `;

  // Определяем цвет и эмодзи в зависимости от результата
  let bgColor, emoji, borderColor;
  switch(winner) {
    case 'me':
      bgColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      borderColor = '#10b981';
      emoji = '🎉';
      break;
    case 'opponent':
      bgColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      borderColor = '#ef4444';
      emoji = '😢';
      break;
    case 'draw':
      bgColor = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
      borderColor = '#6366f1';
      emoji = '🤝';
      break;
    default:
      bgColor = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
      borderColor = '#6366f1';
      emoji = '🎮';
  }

  // Функция для получения эмодзи выбора
  const getChoiceEmoji = (choice) => {
    switch(choice) {
      case 'камень': return '🪨';
      case 'ножницы': return '✂️';
      case 'бумага': return '📄';
      default: return '❓';
    }
  };

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 24px;
      padding: 40px 30px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
      border: 3px solid ${borderColor};
      animation: scaleIn 0.4s ease;
    ">
      <div style="
        width: 80px;
        height: 80px;
        background: ${bgColor};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px auto;
        font-size: 36px;
      ">${emoji}</div>
      
      <h2 style="
        margin: 0 0 30px 0; 
        color: #1f2937; 
        font-size: 28px;
        font-weight: 700;
      ">${message}</h2>
      
      <div style="
        display: flex;
        justify-content: space-around;
        align-items: center;
        margin: 30px 0;
        padding: 20px;
        background: #f8fafc;
        border-radius: 16px;
        border: 2px solid #e2e8f0;
      ">
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">${getChoiceEmoji(myChoice)}</div>
          <div style="font-weight: 600; color: #374151; font-size: 16px;">Вы</div>
          <div style="color: #6b7280; font-size: 14px;">${myChoice}</div>
        </div>
        
        <div style="
          font-size: 24px; 
          font-weight: bold; 
          color: #6b7280;
          margin: 0 20px;
        ">VS</div>
        
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">${getChoiceEmoji(opponentChoice)}</div>
          <div style="font-weight: 600; color: #374151; font-size: 16px;">Оппонент</div>
          <div style="color: #6b7280; font-size: 14px;">${opponentChoice}</div>
        </div>
      </div>
      
      <div style="
        margin-top: 30px;
        padding: 16px;
        background: ${bgColor};
        border-radius: 12px;
        color: white;
        font-weight: 600;
        font-size: 16px;
      ">
        Следующий раунд через 5 секунд...
      </div>
    </div>
  `;

  // Добавляем CSS анимации
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(modal);

  // Закрытие модального окна через 5 секунд
  setTimeout(() => {
    modal.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
      modal.remove();
      style.remove();
    }, 300);
  }, 5000);

  // Закрытие по клику вне модального окна
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => {
        modal.remove();
        style.remove();
      }, 300);
    }
  };
}

