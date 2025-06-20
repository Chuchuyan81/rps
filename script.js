// Инициализация Supabase
const supabase = createClient("https://kdbbyqsdmucjvsatbiog.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYmJ5cXNkbXVjanZzYXRiaW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0MzQxNzcsImV4cCI6MjA2NjAxMDE3N30.v6wR9s1zCyYL-xN2Rohoi35LJ-f1uA1Y5KPPjQoXhLU");

let currentRoom = null;

// Создание комнаты
async function createRoom() {
  const room_id = Math.random().toString(36).substr(2, 5);
  const { error } = await supabase
    .from("games")
    .insert([{ room_id, status: "waiting" }]);
  if (!error) {
    alert(`Комната создана: ${room_id}`);
    currentRoom = room_id;
    subscribeToUpdates();
  }
}

// Присоединение к комнате
async function joinRoom() {
  const room_id = document.getElementById("room").value;
  const { data, error } = await supabase
    .from("games")
    .select()
    .eq("room_id", room_id)
    .single();
  if (data) {
    currentRoom = room_id;
    subscribeToUpdates();
  } else {
    alert("Комната не найдена!");
  }
}

// Отправка хода игрока
async function makeMove(choice) {
  if (!currentRoom) return;
  const { data } = await supabase
    .from("games")
    .select("player1_choice,player2_choice")
    .eq("room_id", currentRoom)
    .single();

  if (!data.player1_choice) {
    await supabase
      .from("games")
      .update({ player1_choice: choice, status: "active" })
      .eq("room_id", currentRoom);
  } else {
    await supabase
      .from("games")
      .update({ player2_choice: choice, status: "active" })
      .eq("room_id", currentRoom);
  }
}

// Определение победителя
function determineWinner(p1, p2) {
  if (p1 === p2) return "Ничья!";
  const rules = { камень: "ножницы", ножницы: "бумага", бумага: "камень" };
  return rules[p1] === p2 ? "Игрок 1 победил!" : "Игрок 2 победил!";
}

// Подписка на обновления игры
function subscribeToUpdates() {
  supabase
    .channel("games")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "games" },
      (payload) => {
        const { player1_choice, player2_choice } = payload.new;
        if (player1_choice && player2_choice) {
          document.getElementById("result").innerText = determineWinner(
            player1_choice,
            player2_choice
          );
          setTimeout(() => {
            supabase
              .from("games")
              .update({ player1_choice: null, player2_choice: null, status: "waiting" })
              .eq("room_id", currentRoom);
          }, 3000);
        }
      }
    )
    .subscribe();
}