// Инициализация Supabase
const supabase = createClient(
  "https://kdbbyqsdmucjvsatbiog.supabase.co", 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYmJ5cXNkbXVjanZzYXRiaW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0MzQxNzcsImV4cCI6MjA2NjAxMDE3N30.v6wR9s1zCyYL-xN2Rohoi35LJ-f1uA1Y5KPPjQoXhLU"
);

let currentRoom = null;
let isPlayer1 = false;

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

  if (actionButton.textContent === "Создать комнату") {
    await createRoom();
  } else {
    await joinRoom(room_id);
  }
}

// Создание комнаты
async function createRoom() {
  const room_id = Math.random().toString(36).substr(2, 5);
  document.getElementById("room").value = room_id;
  const { error } = await supabase.from("games").insert([{ room_id, status: "waiting", player1_choice: null, player2_choice: null }]);

  if (!error) {
    currentRoom = room_id;
    isPlayer1 = true;
    showGameUI();
    subscribeToUpdates();
  } else {
    alert("Не удалось создать комнату");
  }
}

// Присоединение к комнате
async function joinRoom(room_id) {
  const { data, error } = await supabase.from("games").select().eq("room_id", room_id).single();

  if (data) {
    currentRoom = room_id;
    isPlayer1 = false;
    showGameUI();
    subscribeToUpdates();
  } else {
    alert("Комната не найдена!");
  }
}

// Отображение кнопок выбора
function showGameUI() {
  document.getElementById("choices").style.display = "block";
  document.getElementById("room").disabled = true;
  document.getElementById("actionButton").style.display = "none";
}

// Отправка хода
async function makeMove(choice) {
  if (!currentRoom) return;

  const { data, error } = await supabase
    .from("games")
    .select("player1_choice,player2_choice")
    .eq("room_id", currentRoom)
    .single();

  if (error) {
    console.error("Ошибка загрузки данных:", error);
    return;
  }

  const updateData = {};
  if (isPlayer1 && !data.player1_choice && !data.player2_choice) {
    updateData.player1_choice = choice;
  } else if (!isPlayer1 && data.player1_choice && !data.player2_choice) {
    updateData.player2_choice = choice;
  }

  if (Object.keys(updateData).length > 0) {
    await supabase
      .from("games")
      .update(updateData)
      .eq("room_id", currentRoom);
  }
}

// Определение победителя
function determineWinner(p1, p2) {
  if (p1 === p2) return "Ничья!";
  const rules = { камень: "ножницы", ножницы: "бумага", бумага: "камень" };
  return rules[p1] === p2 ? "Игрок 1 победил!" : "Игрок 2 победил!";
}

// Подписка на обновления
function subscribeToUpdates() {
  supabase.removeAllChannels();

  supabase
    .channel("game-updates")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `room_id=eq.${currentRoom}`
      },
      (payload) => {
        const { player1_choice, player2_choice } = payload.new;

        if (player1_choice && player2_choice) {
          document.getElementById("result").innerText = determineWinner(player1_choice, player2_choice);

          setTimeout(async () => {
            await supabase
              .from("games")
              .update({ player1_choice: null, player2_choice: null, status: "waiting" })
              .eq("room_id", currentRoom);
            document.getElementById("result").innerText = "";
          }, 3000);
        }
      }
    )
    .subscribe();
}
