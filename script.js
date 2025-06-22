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
  const buttonText = actionButton?.querySelector('.button-text');
  const buttonIcon = actionButton?.querySelector('.button-icon');

  if (!roomInput || !actionButton || !buttonText) return;

  // Фильтруем только цифры
  roomInput.value = roomInput.value.replace(/[^0-9]/g, '');

  // Всегда показываем "Создать комнату" когда поле пустое
  // И "Присоединиться" когда поле заполнено
  if (roomInput.value.trim() === "") {
    buttonText.textContent = "Создать комнату";
    if (buttonIcon) {
      buttonIcon.innerHTML = '<path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    }
    console.log("Button set to: Создать комнату");
  } else {
    buttonText.textContent = "Присоединиться";
    if (buttonIcon) {
      buttonIcon.innerHTML = '<path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    }
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
  
  if (!roomInput || !actionButton) return;

  const room_id = roomInput.value.trim();
  // Сохраняем оригинальный текст кнопки ДО вызова showLoader
  const originalButtonText = actionButton.textContent;

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
    console.log(`Room ID ${room_id} inserted into input field`);
    // Обновляем кнопку после заполнения поля
    updateButton();
    console.log("Button updated after room creation");
  }

  showGameUI();
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

    showGameUI();
    showStatus("Присоединились к комнате! Игра началась!");
    
    // Активируем кнопки для игрока 2 сразу после присоединения
    toggleChoiceButtons(true);
    
    subscribeToUpdates();

  } catch (error) {
    console.error('Ошибка присоединения к комнате:', error);
    throw error;
  }
}

// Отображение кнопок выбора
function showGameUI() {
  const choices = document.getElementById("choices");
  const roomInput = document.getElementById("roomInput");
  const actionButton = document.getElementById("actionButton");

  if (choices) choices.style.display = "block";
  if (roomInput) roomInput.disabled = true;
  if (actionButton) {
    actionButton.style.display = "block";
    actionButton.textContent = "Закончить игру";
    // Убираем старый обработчик и добавляем новый
    actionButton.onclick = null;
    actionButton.onclick = () => fullCleanup();
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
    }
    if (opponentChoice && !gameState.opponentChoice) {
      gameState.opponentChoice = opponentChoice;
      showStatus("Оппонент сделал ход. Ожидание результата...");
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
  const choices = document.getElementById("choices");
  const roomInput = document.getElementById("roomInput");
  const actionButton = document.getElementById("actionButton");

  if (choices) choices.style.display = "none";
  if (roomInput) {
    roomInput.disabled = false;
    roomInput.value = "";
  }
  if (actionButton) {
    actionButton.style.display = "block";
    actionButton.textContent = "Создать комнату";
    // Восстанавливаем правильный обработчик
    actionButton.onclick = null;
    actionButton.onclick = handleAction;
  }

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
    // Для iOS показываем сразу
    if (isIOSDevice() && !isPWAMode()) {
      showIOSInstallInstructions();
    }
    
    // Для Android ждем событие beforeinstallprompt (уже обработано в HTML)
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

// Показ инструкций для iOS
function showIOSInstallInstructions() {
  const installBtn = document.getElementById('install-btn');
  if (!installBtn) return;
  
  installBtn.style.display = 'block';
  installBtn.onclick = () => {
    showIOSInstallModal();
  };
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

// Обновление статуса подключения
function updateConnectionStatus(isOnline) {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  
  if (statusIndicator && statusText) {
    if (isOnline) {
      statusIndicator.className = 'status-indicator online';
      statusText.textContent = 'Онлайн';
    } else {
      statusIndicator.className = 'status-indicator offline';
      statusText.textContent = 'Офлайн';
    }
  }
}

// Управление прогресс-баром
function updateProgressBar(step) {
  const steps = document.querySelectorAll('.progress-step');
  steps.forEach((stepEl, index) => {
    stepEl.classList.remove('active');
    if (index <= step) {
      stepEl.classList.add('active');
    }
  });
}

// Переключение секций
function showSection(sectionName) {
  const sections = ['roomSection', 'waitingSection', 'gameSection'];
  sections.forEach(section => {
    const el = document.getElementById(section);
    if (el) {
      el.style.display = section === sectionName ? 'block' : 'none';
    }
  });
  
  // Обновляем прогресс-бар
  const progressMap = {
    'roomSection': 0,
    'waitingSection': 1,
    'gameSection': 2
  };
  updateProgressBar(progressMap[sectionName] || 0);
}

// Показ кода комнаты в секции ожидания
function displayRoomCode(roomCode) {
  const roomCodeDisplay = document.getElementById('roomCodeDisplay');
  if (roomCodeDisplay) {
    roomCodeDisplay.textContent = roomCode;
  }
}

// Копирование кода комнаты
function copyRoomCode() {
  const roomCodeDisplay = document.getElementById('roomCodeDisplay');
  if (roomCodeDisplay && roomCodeDisplay.textContent !== '----') {
    navigator.clipboard.writeText(roomCodeDisplay.textContent).then(() => {
      showToast('Код комнаты скопирован!', 'success');
    }).catch(() => {
      showToast('Не удалось скопировать код', 'error');
    });
  }
}

// Система уведомлений (Toast)
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '<path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    error: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    info: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16V12M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };

  toast.innerHTML = `
    <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
      ${icons[type] || icons.info}
    </svg>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  `;

  container.appendChild(toast);
  
  // Показываем toast
  setTimeout(() => toast.classList.add('show'), 100);
  
  // Автоматически убираем toast
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Модальные окна
function showModal(modalId) {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById(modalId);
  
  if (overlay && modal) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Диалог случайной игры
function showRandomRoomDialog() {
  showModal('randomRoomModal');
}

function findRandomGame() {
  closeModal();
  showToast('Поиск случайной игры...', 'info');
  // Здесь можно добавить логику поиска случайной игры
}

// Обновление статистики
function updateStats(wins = 0, losses = 0, draws = 0) {
  const winsEl = document.getElementById('winsCount');
  const lossesEl = document.getElementById('lossesCount');
  const drawsEl = document.getElementById('drawsCount');
  
  if (winsEl) winsEl.textContent = wins;
  if (lossesEl) lossesEl.textContent = losses;
  if (drawsEl) drawsEl.textContent = draws;
}

// Обновление выборов игроков
function updatePlayerChoice(isMyChoice, choice) {
  const targetId = isMyChoice ? 'myChoiceDisplay' : 'opponentChoiceDisplay';
  const element = document.getElementById(targetId);
  
  if (element) {
    const emojiMap = {
      'камень': '🪨',
      'ножницы': '✂️',
      'бумага': '📄'
    };
    
    element.innerHTML = `<div class="choice-result">${emojiMap[choice] || choice}</div>`;
  }
}

// Сброс выборов игроков
function resetPlayerChoices() {
  const myChoice = document.getElementById('myChoiceDisplay');
  const opponentChoice = document.getElementById('opponentChoiceDisplay');
  
  if (myChoice) {
    myChoice.innerHTML = '<div class="choice-placeholder">?</div>';
  }
  if (opponentChoice) {
    opponentChoice.innerHTML = '<div class="choice-placeholder">?</div>';
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
  showSection('roomSection');
  
  // Добавляем обработчики для закрытия модальных окон по клику вне них
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  });
  
  // Инициализируем статистику
  updateStats();
  
  // Инициализируем статус подключения
  updateConnectionStatus(navigator.onLine);
  
  console.log('🎨 Новый UI инициализирован');
});

