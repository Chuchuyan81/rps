/**
 * Пример конфигурации для продакшена
 * Скопируйте этот файл в config.js и настройте ваши значения
 * НЕ добавляйте config.js в систему контроля версий!
 */

// Настройки Supabase
window.SUPABASE_URL = 'https://your-project-id.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key-here';

// Настройки безопасности
window.SECURITY_CONFIG = {
  // Rate limiting настройки
  rateLimits: {
    createRoom: { maxAttempts: 3, timeWindow: 60000 }, // 3 в минуту
    joinRoom: { maxAttempts: 5, timeWindow: 60000 },   // 5 в минуту
    makeMove: { maxAttempts: 10, timeWindow: 60000 }   // 10 в минуту
  },
  
  // Включить дополнительное логирование
  enableSecurityLogging: true,
  
  // Максимальное время жизни комнаты (в миллисекундах)
  maxRoomLifetime: 3600000, // 1 час
  
  // Максимальное количество попыток создания уникального ID
  maxIdGenerationAttempts: 10,
  
  // Включить проверку целостности состояния
  enableStateValidation: true
};

// Настройки для разработки (не используйте в продакшене!)
window.DEV_CONFIG = {
  enableDebugMode: false,
  allowTestAccounts: false,
  skipRateLimit: false
};

console.log('🔧 Конфигурация загружена'); 