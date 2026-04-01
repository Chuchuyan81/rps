/**
 * Service Worker для игры "Камень, Ножницы, Бумага"
 * Обновлен для соответствия стандартам PWA 2024-2025
 * Поддерживает расширенные возможности кэширования, Background Sync, Push уведомления
 */

const CACHE_NAME = 'rps-game-v2.0.3';
const STATIC_CACHE = 'rps-static-v2.0.3';
const DYNAMIC_CACHE = 'rps-dynamic-v2.0.3';
const IMAGE_CACHE = 'rps-images-v2.0.3';

/** Каталог приложения: корень сайта или подпуть (например /rps/ на GitHub Pages) */
const BASE_PATH = new URL('./', self.location.href).pathname;

const STATIC_URLS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'script.js',
  BASE_PATH + 'style.css',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'icons/icon-192x192.png',
  BASE_PATH + 'icons/icon-512x512.png'
];

const DYNAMIC_URLS = [
  // Supabase и внешние ресурсы
  'https://unpkg.com/@supabase/supabase-js@2'
];

// Стратегии кэширования
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  CACHE_ONLY: 'cache-only',
  NETWORK_ONLY: 'network-only'
};

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker v2.0.3: Установка');
  
  event.waitUntil(
    Promise.all([
      // Предварительное кэширование статических ресурсов
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 Кэширование статических ресурсов');
        // Используем map для кэширования каждого файла по отдельности, чтобы один сбой не ломал всё
        return Promise.allSettled(
          STATIC_URLS.map(url => 
            cache.add(url).catch(error => console.error(`❌ Не удалось закэшировать ${url}:`, error))
          )
        );
      }),
      
      // Предварительное кэширование динамических ресурсов
      caches.open(DYNAMIC_CACHE).then(cache => {
        console.log('🌐 Кэширование динамических ресурсов');
        return Promise.allSettled(
          DYNAMIC_URLS.map(url => 
            cache.add(url).catch(error => console.error(`❌ Не удалось закэшировать ${url}:`, error))
          )
        );
      })
    ])
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
  console.log('🚀 Service Worker v2.0.3: Активация');
  
  event.waitUntil(
    Promise.all([
      // Очистка старых кэшей
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IMAGE_CACHE) {
              console.log('🗑️ Удаляем старый кэш:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Принимаем контроль над всеми клиентами
      self.clients.claim()
    ])
    .then(() => {
      console.log('✅ Service Worker v2.0.3 активирован');
    })
  );
});

// Расширенная обработка сетевых запросов
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Игнорируем POST запросы и некоторые специфические URL
  if (request.method !== 'GET' || 
      url.pathname.startsWith('/api/') ||
      url.hostname.includes('supabase.co')) {
    return;
  }
  
  // Определяем стратегию кэширования
  let strategy = getStrategyForRequest(request);
  
  event.respondWith(
    handleRequest(request, strategy)
  );
});

/**
 * Определяет стратегию кэширования для запроса
 */
function getStrategyForRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Статические ресурсы - cache first
  // Проверяем как полное совпадение, так и окончание пути
  if (STATIC_URLS.includes(path) || 
      ['index.html', 'script.js', 'style.css', 'manifest.json'].some(f => path.endsWith('/' + f) || path === f)) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // Изображения - stale while revalidate
  if (request.destination === 'image') {
    return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
  }
  
  // API запросы - network first
  if (url.pathname.startsWith('/api/')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // Остальные ресурсы - stale while revalidate
  return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
}

/**
 * Обрабатывает запрос согласно выбранной стратегии
 */
async function handleRequest(request, strategy) {
  try {
    switch (strategy) {
      case CACHE_STRATEGIES.CACHE_FIRST:
        return await cacheFirst(request);
      case CACHE_STRATEGIES.NETWORK_FIRST:
        return await networkFirst(request);
      case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
        return await staleWhileRevalidate(request);
      default:
        return await staleWhileRevalidate(request);
    }
  } catch (error) {
    console.error('❌ Ошибка обработки запроса:', error);
    return await handleOffline(request);
  }
}

/**
 * Стратегия Cache First
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('📦 Из кэша:', request.url);
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

/**
 * Стратегия Network First
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🌐 Сеть недоступна, пробуем кэш:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Оптимизированная стратегия Stale While Revalidate
 * Сначала возвращает кэш (если есть), затем обновляет его в фоне.
 * Исправлена проблема с двойными запросами и обработкой ошибок сети.
 */
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  // Если есть в кэше — отдаем его сразу и пытаемся обновить в фоне
  if (cachedResponse) {
    // Асинхронно обновляем кэш
    const updateCacheTask = async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(
            request.destination === 'image' ? IMAGE_CACHE : DYNAMIC_CACHE
          );
          await cache.put(request, networkResponse.clone());
        }
      } catch (error) {
        // Ошибка в фоне не критична, если мы уже отдали кэш
        if (navigator.onLine) {
          console.log('🔄 Фоновое обновление не удалось (кэш сохранен):', request.url);
        }
      }
    };
    
    // Запускаем обновление, но не ждем его завершения перед возвратом ответа
    updateCacheTask();
    
    console.log('📦 Возврат из кэша (SWR):', request.url);
    return cachedResponse;
  }
  
  // Если в кэше нет — делаем единственный сетевой запрос
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(
        request.destination === 'image' ? IMAGE_CACHE : DYNAMIC_CACHE
      );
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Сетевой запрос не удался:', request.url, error);
    return await handleOffline(request);
  }
}

/**
 * Обработка офлайн режима
 */
async function handleOffline(request) {
  // Для навигационных запросов показываем основную страницу
  if (request.mode === 'navigate') {
    const cachedResponse =
      (await caches.match(BASE_PATH + 'index.html')) ||
      (await caches.match(BASE_PATH));
    if (cachedResponse) {
      return cachedResponse;
    }
  }
  
  // Для изображений показываем placeholder
  if (request.destination === 'image') {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" fill="#999">Офлайн</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
  
  // Для остальных запросов возвращаем ошибку
  throw new Error('Контент недоступен офлайн');
}

// Background Sync для отложенных действий
self.addEventListener('sync', (event) => {
  console.log('🔄 Background Sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      handleBackgroundSync()
    );
  }
  
  if (event.tag === 'game-moves-sync') {
    event.waitUntil(
      syncGameMoves()
    );
  }
});

/**
 * Обработка фоновой синхронизации
 */
async function handleBackgroundSync() {
  try {
    console.log('📡 Выполняем фоновую синхронизацию');
    
    // Проверяем IndexedDB на отложенные действия
    const db = await openDB();
    const pendingActions = await getPendingActions(db);
    
    for (const action of pendingActions) {
      try {
        await processPendingAction(action);
        await removePendingAction(db, action.id);
      } catch (error) {
        console.error('❌ Ошибка обработки отложенного действия:', error);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка фоновой синхронизации:', error);
  }
}

/**
 * Синхронизация игровых ходов
 */
async function syncGameMoves() {
  try {
    console.log('🎮 Синхронизируем игровые ходы');
    
    // Логика синхронизации игровых данных
    // Здесь можно добавить отправку отложенных ходов в игре
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации игровых ходов:', error);
  }
}

// Push уведомления
self.addEventListener('push', (event) => {
  console.log('📱 Push уведомление получено');
  
  const scopeBase = self.registration.scope.replace(/\/?$/, '/');
  const icon = (name) => new URL(name, scopeBase).href;

  let notificationData = {
    title: 'Камень, Ножницы, Бумага',
    body: 'Новое уведомление от игры!',
    icon: icon('icons/icon-192x192.png'),
    badge: icon('icons/icon-72x72.png'),
    tag: 'rps-notification',
    renotify: true,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Открыть игру',
        icon: icon('icons/icon-96x96.png')
      },
      {
        action: 'close',
        title: 'Закрыть',
        icon: icon('icons/icon-96x96.png')
      }
    ],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'rps-notification'
    }
  };
  
  // Парсим данные от сервера если есть
  if (event.data) {
    try {
      const serverData = event.data.json();
      notificationData = { ...notificationData, ...serverData };
    } catch (error) {
      console.error('❌ Ошибка парсинга push данных:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Клик по уведомлению:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    const openUrl = self.registration.scope.replace(/\/?$/, '/');
    event.waitUntil(clients.openWindow(openUrl));
  }
});

// Веб-шаринг (Web Share Target API)
self.addEventListener('message', (event) => {
  console.log('📨 Сообщение от клиента:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ Принудительное обновление SW');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      timestamp: Date.now()
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      clearAllCaches()
    );
  }
});

/**
 * Очистка всех кэшей
 */
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('🧹 Все кэши очищены');
  } catch (error) {
    console.error('❌ Ошибка очистки кэшей:', error);
  }
}

// Utility функции для работы с IndexedDB
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rps-offline-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id' });
      }
    };
  });
}

async function getPendingActions(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingActions'], 'readonly');
    const store = transaction.objectStore('pendingActions');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function processPendingAction(action) {
  // Обработка отложенного действия
  console.log('⚡ Обрабатываем отложенное действие:', action);
}

async function removePendingAction(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingActions'], 'readwrite');
    const store = transaction.objectStore('pendingActions');
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
} 