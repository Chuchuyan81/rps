// Правильная инициализация Supabase
const supabaseUrl = "https://cchbitomcbuczxwxjobw.supabase.co";
const supabaseKey = "sb_publishable_cBZoHPWOyuMvv2byGoDxfw_h1bNou9G";

// Константы для бот-комнаты
const BOT_ROOM_ID = '9999';
const BOT_PLAYER_ID = 'bot_player_9999';

// Глобальное состояние игры
const gameState = {
  currentRoom: null,      // ID текущей комнаты
  playerId: null,         // Уникальный ID игрока  
  isPlayer1: false,       // Роль игрока
  channel: null,          // Supabase канал
  myChoice: null,         // Мой выбор
  opponentChoice: null,   // Выбор оппонента
  gameStatus: 'idle',     // Статус: idle|waiting|playing|finished
  playingWithBot: false   // Играем ли мы с ботом
};

// Ждем загрузки Supabase библиотеки
let supabase = null;

// Делаем supabase доступным глобально для отладки
window.supabaseClient = null;

/**
 * Тестирует подключение к Supabase
 * Выполняет простой запрос для проверки работоспособности
 */
async function testConnection() {
  if (!supabase) {
    console.error('Supabase не инициализирован для тестирования');
    showStatus("Ошибка: Supabase не инициализирован", true);
    return;
  }

  try {
    console.log('🔍 Тестирование подключения к Supabase...');
    
    // Простой запрос для проверки соединения
    const { data, error } = await supabase
      .from('games')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Ошибка тестирования подключения:', error);
      showStatus("Ошибка подключения к базе данных", true);
      return;
    }
    
    console.log('✅ Подключение к Supabase успешно протестировано');
    console.log('📊 Количество активных игр:', data);
    
  } catch (error) {
    console.error('❌ Исключение при тестировании:', error);
    showStatus("Ошибка тестирования подключения", true);
  }
}

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
    
    // Проверяем видимость кнопки бота
    const botButton = document.getElementById('botMenuButton');
    if (botButton) {
      console.log('🤖 Кнопка бота найдена и видна:', botButton.style.display !== 'none');
      console.log('🤖 Стили кнопки бота:', window.getComputedStyle(botButton).display);
    } else {
      console.log('🤖 Кнопка бота не найдена в DOM - это нормально, она в меню');
    }
    
    // Тестируем подключение
    testConnection();
    
    // Инициализируем бот-комнату при загрузке
    initializeBotRoom();
    
    // Добавляем обработчики для сетевых событий
    window.addEventListener('offline', () => {
      showStatus("Нет соединения. Проверяйте интернет.", true);
    });

    window.addEventListener('online', () => {
      showStatus("Соединение восстановлено.");
      if (gameState.currentRoom) {
        subscribeToUpdates();
      }
    });
    
  } catch (error) {
    console.error('Error initializing Supabase:', error);
    showStatus("Ошибка инициализации Supabase: " + error.message, true);
  }
});

/**
 * Инициализация бот-комнаты при загрузке страницы
 * Создает комнату с ботом, если её нет
 */
async function initializeBotRoom() {
  console.log('🤖 Инициализация бот-комнаты...');
  
  if (!supabase) {
    console.error('Supabase не доступен для инициализации бот-комнаты');
    return;
  }

  try {
    await ensureBotRoomExists();
    console.log('🤖 Бот-комната инициализирована успешно');
  } catch (error) {
    console.error('🤖 Ошибка инициализации бот-комнаты:', error);
  }
}

/**
 * Функция для игры с ботом
 * Присоединяется к специальной комнате с ботом
 */
async function playWithBot() {
  console.log('🤖 Функция playWithBot вызвана');
  
  if (!supabase) {
    console.error('Supabase не инициализирован');
    showStatus("Supabase не инициализирован", true);
    return;
  }

  console.log('🤖 Начинаем подключение к боту...');
  showLoader(true);
  showStatus("Подключение к боту...");

  try {
    // Устанавливаем флаг игры с ботом
    gameState.playingWithBot = true;
    console.log('🤖 Флаг playingWithBot установлен');
    
    // Генерируем ID игрока
    gameState.playerId = generatePlayerId();
    gameState.isPlayer1 = false; // Игрок всегда второй, бот - первый
    console.log('🤖 ID игрока сгенерирован:', gameState.playerId);
    
    // Проверяем/создаем комнату с ботом
    console.log('🤖 Проверяем/создаем бот-комнату...');
    await ensureBotRoomExists();
    
    // Присоединяемся к комнате с ботом
    console.log('🤖 Присоединяемся к бот-комнате...');
    const { data: updatedGame, error: updateError } = await retryWrapper(() =>
      supabase
        .from("games")
        .update({ 
          player2_id: gameState.playerId,
          status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq("room_id", BOT_ROOM_ID)
        .select()
        .single()
    );

    if (updateError) {
      console.error('Ошибка при присоединении к бот-комнате:', updateError);
      throw new Error(`Ошибка подключения к боту: ${updateError.message}`);
    }

    console.log('🤖 Успешно присоединились к бот-комнате:', updatedGame);

    // Обновляем состояние
    gameState.currentRoom = BOT_ROOM_ID;
    gameState.gameStatus = 'ready';

    // Обновляем UI
    const roomInput = document.getElementById("room");
    if (roomInput) {
      roomInput.value = BOT_ROOM_ID;
    }

    console.log('🤖 Показываем игровой UI...');
    showGameUI();
    showStatus("Подключились к боту! Сделайте ваш выбор:");
    
    // Активируем кнопки для игры
    toggleChoiceButtons(true);
    
    console.log('🤖 Подписываемся на обновления...');
    subscribeToUpdates();

    // Бот делает первый ход сразу
    console.log('🤖 Бот делает первый ход...');
    await makeBotMove();

    console.log('🤖 Подключение к боту завершено успешно!');

  } catch (error) {
    console.error('🤖 Ошибка подключения к боту:', error);
    showStatus(`Ошибка подключения к боту: ${error.message}`, true);
    gameState.playingWithBot = false;
  } finally {
    showLoader(false);
  }
}

/**
 * Обеспечивает существование комнаты с ботом
 */
async function ensureBotRoomExists() {
  try {
    // Проверяем существование комнаты с ботом
    const { data: existingRoom, error: selectError } = await retryWrapper(() =>
      supabase
        .from("games")
        .select("*")
        .eq("room_id", BOT_ROOM_ID)
        .single()
    );

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError;
    }

    if (!existingRoom) {
      // Создаем новую комнату с ботом
      const gameData = {
        room_id: BOT_ROOM_ID,
        player1_id: BOT_PLAYER_ID,
        player2_id: null,
        player1_choice: null,
        player2_choice: null,
        status: 'waiting_player2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await retryWrapper(() =>
        supabase
          .from("games")
          .insert([gameData])
          .select()
          .single()
      );

      if (error) {
        throw new Error(`Ошибка создания бот-комнаты: ${error.message}`);
      }

      console.log('Бот-комната создана:', data);
    } else {
      // Сбрасываем состояние существующей комнаты
      const { error: resetError } = await retryWrapper(() =>
        supabase
          .from("games")
          .update({
            player2_id: null,
            player1_choice: null,
            player2_choice: null,
            status: 'waiting_player2',
            updated_at: new Date().toISOString()
          })
          .eq("room_id", BOT_ROOM_ID)
      );

      if (resetError) {
        console.error('Ошибка сброса бот-комнаты:', resetError);
      } else {
        console.log('Бот-комната сброшена для новой игры');
      }
    }
  } catch (error) {
    console.error('Ошибка при обеспечении бот-комнаты:', error);
    throw error;
  }
}

/**
 * Логика бота для автоматических ходов
 * Бот делает случайный выбор без задержки
 */
async function makeBotMove() {
  if (!gameState.playingWithBot || gameState.currentRoom !== BOT_ROOM_ID) {
    return;
  }

  const choices = ['камень', 'ножницы', 'бумага'];
  const botChoice = choices[Math.floor(Math.random() * choices.length)];

  try {
    const { error } = await retryWrapper(() =>
      supabase
        .from("games")
        .update({
          player1_choice: botChoice,
          status: 'playing',
          updated_at: new Date().toISOString()
        })
        .eq("room_id", BOT_ROOM_ID)
    );

    if (error) {
      console.error('Ошибка хода бота:', error);
    } else {
      console.log('Бот сделал ход:', botChoice);
    }
  } catch (error) {
    console.error('Исключение при ходе бота:', error);
  }
}

// Отображение кнопок выбора
function showGameUI() {
  const choices = document.getElementById("choices");
  const roomControls = document.querySelector(".room-controls");
  const actionButton = document.getElementById("actionButton");

  if (choices) choices.style.display = "block";
  
  // Скрываем поле комнаты во время игры
  if (roomControls) {
    roomControls.classList.add("hidden");
  }
  
  if (actionButton) {
    actionButton.style.display = "none"; // Скрываем кнопку действия во время игры
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

    const { error } = await retryWrapper(() =>
      supabase
        .from("games")
        .update(updateData)
        .eq("room_id", gameState.currentRoom)
    );

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
    return { winner: 'draw', message: '🤝 Ничья! Отличная игра!' };
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
      message: player1Wins ? '🏆 Потрясающе! Вы победили! Вы настоящий чемпион! 🥇' : '😊 Хорошая попытка! В следующий раз обязательно получится! 🌟'
    };
  } else {
    return {
      winner: player1Wins ? 'opponent' : 'me',
      message: player1Wins ? '😊 Хорошая попытка! В следующий раз обязательно получится! 🌟' : '🏆 Потрясающе! Вы победили! Вы настоящий чемпион! 🥇'
    };
  }
}

// Сброс раунда
async function resetRound() {
  if (!gameState.currentRoom || !supabase) return;

  try {
    const { error } = await retryWrapper(() =>
      supabase
        .from("games")
        .update({ 
          player1_choice: null, 
          player2_choice: null, 
          status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq("room_id", gameState.currentRoom)
    );

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
    console.log('🚀 Второй игрок присоединился! Предыдущий статус:', gameState.gameStatus);
    if (gameState.gameStatus === 'waiting' || gameState.gameStatus === 'waiting_player2') {
      if (gameState.playingWithBot) {
        showStatus("Бот готов! Сделайте ваш выбор:");
      } else {
        showStatus("Второй игрок присоединился! Сделайте ваш выбор:");
      }
    }
    gameState.gameStatus = 'ready';
    // Активируем кнопки для обоих игроков когда игра готова
    toggleChoiceButtons(true);
    console.log('✅ Игра готова! Кнопки активированы. Новый статус:', gameState.gameStatus);
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
      if (gameState.playingWithBot) {
        showStatus("Бот сделал ход. Ожидание результата...");
      } else {
        showStatus("Оппонент сделал ход. Ожидание результата...");
      }
    }

    // Если оба сделали ходы, показываем результат
    if (player1_choice && player2_choice) {
      const result = determineWinner(player1_choice, player2_choice);
      const myChoiceDisplay = gameState.isPlayer1 ? player1_choice : player2_choice;
      const opponentChoiceDisplay = gameState.isPlayer1 ? player2_choice : player1_choice;
      
      const opponentName = gameState.playingWithBot ? "Бот" : "Оппонент";
      
      // Показываем результат с цветовым различием и выбором соперника
      showGameResult(result, myChoiceDisplay, opponentChoiceDisplay, opponentName);
      
      gameState.gameStatus = 'finished';
      toggleChoiceButtons(false);
      
      // Автоматический сброс через 4 секунды
      setTimeout(() => {
        resetRound();
      }, 4000);
    }
  }

  // Если играем с ботом и игрок сделал ход, запускаем ход бота
  if (gameState.playingWithBot && player2_choice && !player1_choice) {
    makeBotMove();
  }
}

// Очистка ресурсов
// Удаление комнаты из БД после игры
async function deleteRoomFromDB() {
  if (!gameState.currentRoom || !supabase) {
    return;
  }

  try {
    const { error } = await retryWrapper(() =>
      supabase
        .from("games")
        .delete()
        .eq("room_id", gameState.currentRoom)
    );

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
  // Удаляем комнату из БД перед очисткой состояния (но не бот-комнату)
  if (gameState.currentRoom && gameState.currentRoom !== BOT_ROOM_ID) {
    await deleteRoomFromDB();
  } else if (gameState.playingWithBot && gameState.currentRoom === BOT_ROOM_ID) {
    // Для бот-комнаты просто сбрасываем player2
    try {
      await retryWrapper(() =>
        supabase
          .from("games")
          .update({
            player2_id: null,
            player1_choice: null,
            player2_choice: null,
            status: 'waiting_player2',
            updated_at: new Date().toISOString()
          })
          .eq("room_id", BOT_ROOM_ID)
      );
      console.log('Бот-комната сброшена после выхода игрока');
    } catch (error) {
      console.error('Ошибка сброса бот-комнаты:', error);
    }
  }
  
  cleanup();
  
  // Сброс состояния игры
  gameState.currentRoom = null;
  gameState.playerId = null;
  gameState.isPlayer1 = false;
  gameState.myChoice = null;
  gameState.opponentChoice = null;
  gameState.gameStatus = 'idle';
  gameState.playingWithBot = false;

  // Сброс UI
  const choices = document.getElementById("choices");
  const roomControls = document.querySelector(".room-controls");
  const roomInput = document.getElementById("room");
  const actionButton = document.getElementById("actionButton");

  if (choices) choices.style.display = "none";
  
  // Показываем поле комнаты обратно
  if (roomControls) {
    roomControls.classList.remove("hidden");
  }
  
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
  
  const statusMessage = gameState.playingWithBot ? 
    "Игра с ботом завершена." : 
    "Игра завершена. Комната удалена из базы данных.";
  showStatus(statusMessage);
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

/**
 * Обертка для повторных попыток сетевых запросов с exponential backoff
 * @param {Function} asyncFn - Асинхронная функция для выполнения
 * @param {number} maxRetries - Максимальное количество попыток (по умолчанию 3)
 * @returns {Promise} - Результат выполнения функции
 */
async function retryWrapper(asyncFn, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      lastError = error;
      console.error(`Попытка ${attempt} не удалась: ${error.message}`);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

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

// Позитивная функция для показа статуса
function showStatus(message, isError = false) {
  const result = document.getElementById('result');
  if (!result) return;
  
  if (isError) {
    // Делаем ошибки менее негативными
    result.innerHTML = `<div class="status-message error-message">
      <span>😅 ${message}</span>
      <br><small>Не переживайте, всё получится! 💪</small>
    </div>`;
    result.className = 'result error';
  } else {
    // Добавляем больше позитива в обычные сообщения
    let positiveMessage = message;
    
    // Делаем сообщения более позитивными
    if (message.includes('Готов к игре')) {
      positiveMessage = '🎉 Всё готово! Давайте играть и веселиться! 🎮';
    } else if (message.includes('Подключение к боту')) {
      positiveMessage = '🤖 Подключаемся к дружелюбному боту... ⚡';
    } else if (message.includes('Подключились к боту')) {
      positiveMessage = '🤖✨ Отлично! Бот готов к игре! Покажите свои навыки! 🎯';
    } else if (message.includes('Второй игрок присоединился')) {
      positiveMessage = '🎊 Ура! Второй игрок присоединился! Пора играть! 🎪';
    } else if (message.includes('Новый раунд')) {
      positiveMessage = '🚀 Новый раунд! Время показать свои таланты! ⭐';
    } else if (message.includes('Вы победили')) {
      positiveMessage = '🏆 Потрясающе! Вы победили! Вы настоящий чемпион! 🥇';
    } else if (message.includes('Вы проиграли')) {
      positiveMessage = '😊 Хорошая попытка! В следующий раз обязательно получится! 🌟';
    } else if (message.includes('Ничья')) {
      positiveMessage = '🤝 Ничья! Отличная игра! Вы оба молодцы! 👏';
    } else if (message.includes('Ожидание хода')) {
      positiveMessage = message.replace('Ожидание хода', '⏳ Ожидаем хода');
    } else if (message.includes('Соединение восстановлено')) {
      positiveMessage = '🌐✨ Отлично! Соединение восстановлено! Продолжаем игру! 🎮';
    }
    
    result.innerHTML = `<div class="status-message success-message">
      <span>${positiveMessage}</span>
    </div>`;
    result.className = 'result success';
  }
  
  // Добавляем анимацию появления
  result.style.animation = 'none';
  result.offsetHeight; // Trigger reflow
  result.style.animation = 'resultPulse 0.5s ease-in-out';
}

// Обновление текста кнопки в зависимости от ввода
function updateButton() {
  const roomInput = document.getElementById('room');
  const actionButton = document.getElementById('actionButton');
  
  if (!roomInput || !actionButton) return;
  
  const roomValue = roomInput.value.trim();
  
  if (roomValue === '') {
    actionButton.textContent = '🚀 Создать комнату';
    actionButton.className = 'action-btn';
  } else if (roomValue.length === 4 && /^\d{4}$/.test(roomValue)) {
    actionButton.textContent = '🎯 Присоединиться к игре';
    actionButton.className = 'action-btn';
  } else {
    actionButton.textContent = '✨ Введите 4 цифры';
    actionButton.className = 'action-btn';
  }
}

// Обработка действий с кнопкой
async function handleAction() {
  const roomInput = document.getElementById('room');
  const actionButton = document.getElementById('actionButton');
  
  if (!roomInput || !actionButton) return;
  
  const roomValue = roomInput.value.trim();
  
  if (roomValue === '') {
    // Создаем новую комнату
    await createRoom();
  } else if (roomValue.length === 4 && /^\d{4}$/.test(roomValue)) {
    // Присоединяемся к существующей комнате
    await joinRoom(roomValue);
  } else {
    showStatus('✨ Пожалуйста, введите корректный ID комнаты из 4 цифр! 🎯', true);
  }
}

// Создание новой комнаты
async function createRoom() {
  if (!supabase) {
    showStatus('😅 Сервис не готов. Попробуйте через секунду! ⏰', true);
    return;
  }
  
  showStatus('🎨 Создаём вашу уникальную комнату... ✨');
  
  try {
    // Генерируем ID игрока
    gameState.playerId = generatePlayerId();
    gameState.isPlayer1 = true;
    
    // Пытаемся создать уникальный room_id
    let room_id;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      room_id = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Проверяем уникальность
      const { data: existingRoom } = await supabase
        .from('games')
        .select('room_id')
        .eq('room_id', room_id)
        .single();
      
      if (!existingRoom) {
        break; // Комната уникальна
      }
      
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      showStatus('😅 Слишком много комнат! Попробуйте ещё раз! 🎲', true);
      return;
    }
    
    // Создаем комнату
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
      .from('games')
      .insert([gameData])
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Успешно создали комнату
    gameState.currentRoom = room_id;
    gameState.gameStatus = 'waiting_player2';
    
    const roomInput = document.getElementById('room');
    if (roomInput) {
      roomInput.value = room_id;
    }
    
    // Показываем игровой интерфейс создателю комнаты
    showGameUI();
    showStatus(`🎉 Ваша комната создана! ID: ${room_id} 🎊 Ожидание второго игрока...`);
    console.log('🏠 Комната создана, ожидание второго игрока. Статус:', gameState.gameStatus);
    subscribeToUpdates();
    
  } catch (error) {
    console.error('Ошибка создания комнаты:', error);
    showStatus('😅 Что-то пошло не так при создании комнаты! Попробуйте ещё раз! 🔄', true);
  }
}

// Присоединение к комнате
async function joinRoom(roomId) {
  if (!supabase) {
    showStatus('😅 Сервис не готов. Попробуйте через секунду! ⏰', true);
    return;
  }
  
  showStatus('🚀 Присоединяемся к игре... ✨');
  
  try {
    // Проверяем существование комнаты
    const { data: room, error: selectError } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .single();
    
    if (selectError) {
      showStatus('😅 Комната не найдена! Проверьте ID! 🔍', true);
      return;
    }
    
    if (room.player2_id) {
      showStatus('😅 Комната уже заполнена! Попробуйте другую! 🎪', true);
      return;
    }
    
    // Присоединяемся к комнате
    gameState.playerId = generatePlayerId();
    gameState.isPlayer1 = false;
    
    const { data, error } = await supabase
      .from('games')
      .update({
        player2_id: gameState.playerId,
        status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Успешно присоединились
    gameState.currentRoom = roomId;
    gameState.gameStatus = 'ready';
    
    showGameUI();
    showStatus('🎊 Отлично! Вы присоединились к игре! Удачи! 🍀');
    subscribeToUpdates();
    
  } catch (error) {
    console.error('Ошибка присоединения:', error);
    showStatus('😅 Не удалось присоединиться! Попробуйте ещё раз! 🔄', true);
  }
}

// Генерация ID игрока
function generatePlayerId() {
  return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Вспомогательная функция для показа загрузки
function showLoader(show) {
  const actionButton = document.getElementById('actionButton');
  if (actionButton) {
    actionButton.disabled = show;
    if (show) {
      actionButton.textContent = '⏳ Загружаем...';
    }
  }
}

/**
 * Выход из игры и возврат на главный экран
 * Очищает состояние игры и показывает главное меню
 */
async function exitGame() {
  console.log('🚪 Выход из игры...');
  
  try {
    // Полная очистка состояния
    await fullCleanup();
    
    // Сброс состояния игры
    gameState.currentRoom = null;
    gameState.playerId = null;
    gameState.isPlayer1 = false;
    gameState.myChoice = null;
    gameState.opponentChoice = null;
    gameState.gameStatus = 'idle';
    gameState.playingWithBot = false;
    
    // Скрываем игровые элементы
    const choices = document.getElementById('choices');
    const result = document.getElementById('result');
    const roomControls = document.querySelector('.room-controls');
    const roomInput = document.getElementById('room');
    const actionButton = document.getElementById('actionButton');
    
    if (choices) choices.style.display = 'none';
    if (result) {
      result.innerHTML = '';
      result.className = 'result';
    }
    
    // Показываем поле комнаты обратно
    if (roomControls) {
      roomControls.classList.remove('hidden');
    }
    
    if (roomInput) {
      roomInput.value = '';
      roomInput.disabled = false;
    }
    if (actionButton) {
      actionButton.style.display = 'block';
      actionButton.textContent = '🚀 Создать комнату';
      actionButton.disabled = false;
    }
    
    showStatus("Добро пожаловать! Создайте комнату или присоединитесь к существующей.");
    
  } catch (error) {
    console.error('Ошибка при выходе из игры:', error);
    showStatus("Произошла ошибка при выходе из игры", true);
  }
}

/**
 * Показывает результат игры с цветовым различием и выбором соперника
 * @param {Object} result - результат игры от determineWinner
 * @param {string} myChoice - мой выбор
 * @param {string} opponentChoice - выбор соперника
 * @param {string} opponentName - имя соперника (Бот/Оппонент)
 */
function showGameResult(result, myChoice, opponentChoice, opponentName) {
  const resultElement = document.getElementById('result');
  if (!resultElement) return;
  
  // Определяем иконки для выборов
  const choiceIcons = {
    'камень': '🪨',
    'ножницы': '✂️',
    'бумага': '📄'
  };
  
  // Определяем класс для цветового различия
  let resultClass = 'result';
  if (result.winner === 'me') {
    resultClass += ' win';
  } else if (result.winner === 'draw') {
    resultClass += ' draw';
  } else {
    resultClass += ' lose';
  }
  
  // Создаем HTML для отображения результата
  const resultHTML = `
    <div class="status-message">
      <div style="font-size: 1.2rem; margin-bottom: 1rem;">
        ${result.message}
      </div>
      <div class="choices-display">
        <div class="player-choice">
          <span class="choice-icon">${choiceIcons[myChoice]}</span>
          <div class="choice-label">Вы: ${myChoice}</div>
        </div>
        <div class="player-choice">
          <span class="choice-icon">${choiceIcons[opponentChoice]}</span>
          <div class="choice-label">${opponentName}: ${opponentChoice}</div>
        </div>
      </div>
    </div>
  `;
  
  resultElement.innerHTML = resultHTML;
  resultElement.className = resultClass;
  
  // Добавляем анимацию появления
  resultElement.style.animation = 'none';
  resultElement.offsetHeight; // Trigger reflow
  resultElement.style.animation = 'resultPulse 0.5s ease-in-out';
}
