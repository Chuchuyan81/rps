// Инициализация Supabase
const { createClient } = supabase;
const supabaseClient = createClient(
  "https://kdbbyqsdmucjvsatbiog.supabase.co", 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYmJ5cXNkbXVjanZzYXRiaW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0MzQxNzcsImV4cCI6MjA2NjAxMDE3N30.v6wR9s1zCyYL-xN2Rohoi35LJ-f1uA1Y5KPPjQoXhLU"
);

let currentRoom = null;
let isPlayer1 = false;
let gameInProgress = false;
let choicesMade = false;
let channel = null;

// Показать статус игры
function showStatus(message, isError = false) {
  const resultEl = document.getElementById("result");
  resultEl.innerText = message;
  resultEl.style.color = isError ? "red" : "black";
}

// Показать лоадер
function showLoader(show = true) {
  const actionButton = document.getElementById("actionButton");
  if (show) {
    actionButton.disabled = true;
    actionButton.textContent = "Загрузка...";
  } else {
    actionButton.disabled = false;
  }
}

// Валидация room_id
function validateRoomId(roomId) {
  const trimmed = roomId.trim();
  if (trimmed.length === 0) return { valid: false, message: "ID комнаты не может быть пустым" };
  if (trimmed.length > 20) return { valid: false, message: "ID комнаты слишком длинный" };
  if (!/^[a-zA-Z0-9]+$/.test(trimmed)) return { valid: false, message: "ID комнаты может содержать только буквы и цифры" };
  return { valid: true, roomId: trimmed };
}

// Динамическое изменение кнопки
function updateButton() {
  const roomInput = document.getElementById("room");
  const actionButton = document.getElementById("actionButton");

  if (roomInput.value.trim() === "") {
    actionButton.textContent = "Создать комнату";
  } else {
    actionButton.textContent = "Присоединиться";
  }
}

// Обработка нажатия на кнопку
async function handleAction() {
  const roomInput = document.getElementById("room");
  const actionButton = document.getElementById("actionButton");
  const room_id = roomInput.value.trim();

  showLoader(true);
  showStatus("");

  try {
    if (actionButton.textContent === "Создать комнату") {
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
    console.error("Ошибка:", error);
    showStatus("Произошла ошибка. Проверьте подключение к интернету.", true);
  } finally {
    showLoader(false);
  }
}

// Создание комнаты
async function createRoom() {
  let room_id;
  let attempts = 0;
  const maxAttempts = 5;

  // Создаем уникальный room_id с несколькими попытками
  while (attempts < maxAttempts) {
    room_id = Math.random().toString(36).substr(2, 8);
    
    const { data: existingRoom } = await supabaseClient
      .from("games")
      .select("room_id")
      .eq("room_id", room_id)
      .single();

    if (!existingRoom) break;
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error("Не удалось создать уникальный ID комнаты");
  }

  const roomInput = document.getElementById("room");
  roomInput.value = room_id;

  const { error } = await supabaseClient.from("games").insert([
    {
      room_id,
      status: "waiting",
      player1_choice: null,
      player2_choice: null,
      player_count: 1
    }
  ]);

  if (error) {
    throw new Error(`Ошибка создания комнаты: ${error.message}`);
  }

  currentRoom = room_id;
  isPlayer1 = true;
  showGameUI();
  showStatus("Комната создана! Ожидание второго игрока...");
  subscribeToUpdates();
}

// Присоединение к комнате
async function joinRoom(room_id) {
  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .eq("room_id", room_id)
    .single();

  if (error || !data) {
    throw new Error("Комната не найдена!");
  }

  if (data.player_count >= 2) {
    throw new Error("Комната уже заполнена!");
  }

  // Обновляем количество игроков
  const { error: updateError } = await supabaseClient
    .from("games")
    .update({ player_count: 2, status: "ready" })
    .eq("room_id", room_id);

  if (updateError) {
    throw new Error(`Ошибка присоединения: ${updateError.message}`);
  }

  currentRoom = room_id;
  isPlayer1 = false;
  showGameUI();
  showStatus("Присоединились к комнате! Игра началась!");
  subscribeToUpdates();
}

// Отображение кнопок выбора
function showGameUI() {
  const choices = document.getElementById("choices");
  choices.style.display = "block";
  document.getElementById("room").disabled = true;
  document.getElementById("actionButton").style.display = "none";
}

// Блокировка/разблокировка кнопок выбора
function toggleChoiceButtons(enabled) {
  const buttons = document.querySelectorAll(".choices button");
  buttons.forEach(button => {
    button.disabled = !enabled;
    button.style.opacity = enabled ? "1" : "0.5";
  });
}

// Отправка хода
async function makeMove(choice) {
  if (!currentRoom || choicesMade) return;

  choicesMade = true;
  toggleChoiceButtons(false);
  showStatus("Ваш ход сделан. Ожидание хода оппонента...");

  try {
    const { data, error } = await supabaseClient
      .from("games")
      .select("player1_choice,player2_choice,status")
      .eq("room_id", currentRoom)
      .single();

    if (error) {
      throw new Error(`Ошибка загрузки данных: ${error.message}`);
    }

    // Проверяем, можем ли мы сделать ход
    const canMakeMove = isPlayer1 ? !data.player1_choice : !data.player2_choice;
    
    if (!canMakeMove) {
      showStatus("Вы уже сделали ход в этом раунде!", true);
      return;
    }

    const updateData = {};
    if (isPlayer1) {
      updateData.player1_choice = choice;
    } else {
      updateData.player2_choice = choice;
    }

    const { error: updateError } = await supabaseClient
      .from("games")
      .update(updateData)
      .eq("room_id", currentRoom);

    if (updateError) {
      throw new Error(`Ошибка отправки хода: ${updateError.message}`);
    }

  } catch (error) {
    console.error("Ошибка отправки хода:", error);
    showStatus(error.message, true);
    choicesMade = false;
    toggleChoiceButtons(true);
  }
}

// Определение победителя
function determineWinner(p1, p2) {
  if (p1 === p2) return "Ничья!";
  const rules = { камень: "ножницы", ножницы: "бумага", бумага: "камень" };
  const player1Wins = rules[p1] === p2;
  
  if (isPlayer1) {
    return player1Wins ? "Вы победили! 🎉" : "Вы проиграли! 😢";
  } else {
    return player1Wins ? "Вы проиграли! 😢" : "Вы победили! 🎉";
  }
}

// Сброс раунда
async function resetRound() {
  if (!currentRoom) return;

  try {
    await supabaseClient
      .from("games")
      .update({ 
        player1_choice: null, 
        player2_choice: null, 
        status: "ready" 
      })
      .eq("room_id", currentRoom);

    choicesMade = false;
    toggleChoiceButtons(true);
    showStatus("Новый раунд начинается...");
    
    setTimeout(() => {
      showStatus("Сделайте свой выбор!");
    }, 1000);

  } catch (error) {
    console.error("Ошибка сброса игры:", error);
    showStatus("Ошибка сброса раунда", true);
  }
}

// Подписка на обновления
function subscribeToUpdates() {
  // Закрываем предыдущие подключения
  if (channel) {
    supabaseClient.removeChannel(channel);
  }

  channel = supabaseClient
    .channel(`game-updates-${currentRoom}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `room_id=eq.${currentRoom}`
      },
      (payload) => {
        const { player1_choice, player2_choice, player_count, status } = payload.new;

        // Обновляем статус подключения игроков
        if (player_count === 2 && status === "ready") {
          showStatus("Оба игрока готовы! Сделайте свой выбор!");
          toggleChoiceButtons(true);
        } else if (player_count === 1) {
          showStatus("Ожидание второго игрока...");
          toggleChoiceButtons(false);
        }

        // Обрабатываем результат раунда
        if (player1_choice && player2_choice) {
          const result = determineWinner(player1_choice, player2_choice);
          showStatus(`${result} (Вы: ${isPlayer1 ? player1_choice : player2_choice}, Оппонент: ${isPlayer1 ? player2_choice : player1_choice})`);
          
          toggleChoiceButtons(false);
          
          // Автоматический сброс через 4 секунды
          setTimeout(() => {
            resetRound();
          }, 4000);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "games",
        filter: `room_id=eq.${currentRoom}`
      },
      () => {
        showStatus("Игра была завершена", true);
        cleanup();
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("Подключено к игре");
      } else if (status === "CHANNEL_ERROR") {
        showStatus("Ошибка подключения. Перезагрузите страницу.", true);
      }
    });

  return channel;
}

// Очистка ресурсов
function cleanup() {
  if (channel) {
    supabaseClient.removeChannel(channel);
    channel = null;
  }
  currentRoom = null;
  isPlayer1 = false;
  gameInProgress = false;
  choicesMade = false;
}

// Обработка закрытия страницы
window.addEventListener('beforeunload', () => {
  cleanup();
});

// Обработка потери фокуса страницы
document.addEventListener('visibilitychange', () => {
  if (document.hidden && currentRoom) {
    // Страница скрыта - можно приостановить некритичные операции
    console.log("Страница скрыта");
  } else if (!document.hidden && currentRoom) {
    // Страница видима - возобновляем операции
    console.log("Страница видима");
  }
});
