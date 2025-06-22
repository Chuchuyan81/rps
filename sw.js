/**
 * Service Worker для игры "Камень, Ножницы, Бумага"
 * Обеспечивает кэширование ресурсов и работу в офлайне
 */

const CACHE_NAME = 'rps-game-v1.0.1';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/script.js',
  '/style.css',
  '/manifest.json',
  '/debug.html',
  '/test-room-logic.html',
  '/favicon.ico',
  // Иконки
  '/icons/icon-16x16.png',
  '/icons/icon-32x32.png',
  '/icons/icon-48x48.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Внешние ресурсы
  'https://unpkg.com/@supabase/supabase-js@2'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Установка');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Кэширование ресурсов');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Все ресурсы закэшированы');
        // Принудительная активация нового SW
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Ошибка кэширования:', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Активация');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Удаляем старые кэши
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Удаляем старый кэш:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker активирован');
        // Принимаем контроль над всеми клиентами
        return self.clients.claim();
      })
  );
});

// Перехват сетевых запросов
self.addEventListener('fetch', (event) => {
  // Игнорируем запросы к Supabase API для real-time соединений
  if (event.request.url.includes('supabase.co')) {
    return; // Пропускаем кэширование для API
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Если ресурс есть в кэше, возвращаем его
        if (cachedResponse) {
          console.log('📦 Из кэша:', event.request.url);
          return cachedResponse;
        }
        
        // Если нет в кэше, загружаем из сети
        return fetch(event.request)
          .then((response) => {
            // Проверяем, что ответ валидный
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Клонируем ответ для кэша
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Если сеть недоступна, показываем офлайн страницу
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ Принудительное обновление SW');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME
    });
  }
});

// Фоновая синхронизация (если поддерживается)
self.addEventListener('sync', (event) => {
  console.log('🔄 Фоновая синхронизация:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Здесь можно добавить логику синхронизации данных
      console.log('📡 Выполняем фоновую синхронизацию')
    );
  }
});

// Push уведомления (для будущих функций)
self.addEventListener('push', (event) => {
  console.log('📱 Push уведомление получено');
  
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление от игры!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Играть',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Закрыть',
        icon: '/icons/icon-96x96.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Камень, Ножницы, Бумага', options)
  );
}); 