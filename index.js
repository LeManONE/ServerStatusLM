const TelegramBot = require('node-telegram-bot-api');
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Конфигурация
const config = {
  ADMIN_IDS: [941521444], // Ваш chat.id
  LOG_FILE: 'bot_usage.log',
  HIGH_LOAD_THRESHOLD: 80, // Порог уведомлений о нагрузке (%)
  CHECK_INTERVAL: 150000 // 2.5 минут
};

const bot = new TelegramBot('7663683978:AAG55ri9OYfH7Ya6m_uCcAVfzN6KC6UADys', { polling: true });

// Логирование
function logAction(userId, action) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] UserID: ${userId} - Action: ${action}\n`;
  fs.appendFileSync(config.LOG_FILE, logEntry, 'utf8');
}

// Уведомления о нагрузке
let lastNotificationTime = 0;
function checkLoad() {
  const cpuUsage = parseFloat(os.loadavg()[0] * 100).toFixed(1);
  const memUsage = ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1);

  if (cpuUsage > config.HIGH_LOAD_THRESHOLD || memUsage > config.HIGH_LOAD_THRESHOLD) {
    const now = Date.now();
    if (now - lastNotificationTime > 3600000) {
      const message = `⚠️ Внимание! Высокая нагрузка:\nCPU: ${cpuUsage}%\nRAM: ${memUsage}%`;
      config.ADMIN_IDS.forEach(id => bot.sendMessage(id, message));
      lastNotificationTime = now;
    }
  }
}
setInterval(checkLoad, config.CHECK_INTERVAL);

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  logAction(msg.chat.id, '/status command');
  
  const systemInfo = getSystemInfo();
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔄 Обновить", callback_data: "refresh_status" },
          { text: "🔍 Подробнее", callback_data: "more_details" }
        ],
        [
          { text: "💻 Железо", callback_data: "hardware_info" },
          { text: "🔄 Перезагрузка", callback_data: "system_restart" }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, systemInfo, options);
});

bot.onText(/\/restart/, (msg) => {
  if (!config.ADMIN_IDS.includes(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '❌ Доступ запрещен');
    return;
  }
  logAction(msg.chat.id, '/restart command');
  bot.sendMessage(msg.chat.id, '🔄 Сервер будет перезагружен через 10 секунд...');
  setTimeout(() => execSync('sudo /sbin/shutdown -r now'), 10000);
});

bot.onText(/\/poweroff/, (msg) => {
  if (!config.ADMIN_IDS.includes(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, '❌ Доступ запрещен');
    return;
  }
  logAction(msg.chat.id, '/poweroff command');
  bot.sendMessage(msg.chat.id, '⏻ Сервер будет выключен через 10 секунд...');
  setTimeout(() => execSync('sudo /sbin/shutdown now'), 10000);
});

bot.onText(/\/hardware/, (msg) => {
  const chatId = msg.chat.id;
  logAction(msg.chat.id, '/hardware command');
  try {
    bot.sendMessage(chatId, getHardwareInfo());
  } catch (error) {
    bot.sendMessage(chatId, `Ошибка: ${error.message}`);
  }
});

bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;

  switch(callbackQuery.data) {
    case 'refresh_status':
      const updatedInfo = getSystemInfo();
      bot.editMessageText(updatedInfo, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Обновить", callback_data: "refresh_status" },
              { text: "🔍 Подробнее", callback_data: "more_details" }
            ],
            [
              { text: "💻 Железо", callback_data: "hardware_info" },
              { text: "🔄 Перезагрузка", callback_data: "system_restart" }
            ]
          ]
        }
      });
      break;

    case 'more_details':
      bot.editMessageText(getDetailedSystemInfo(), {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Обновить", callback_data: "refresh_status" },
              { text: "🔙 Назад", callback_data: "back_to_normal" }
            ]
          ]
        }
      });
      break;

    case 'back_to_normal':
      bot.editMessageText(getSystemInfo(), {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Обновить", callback_data: "refresh_status" },
              { text: "🔍 Подробнее", callback_data: "more_details" }
            ],
            [
              { text: "💻 Железо", callback_data: "hardware_info" },
              { text: "🔄 Перезагрузка", callback_data: "system_restart" }
            ]
          ]
        }
      });
      break;

    case 'hardware_info':
      try {
        bot.editMessageText(getHardwareInfo(), {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Назад", callback_data: "back_to_normal" }]
            ]
          }
        });
      } catch (error) {
        bot.answerCallbackQuery(callbackQuery.id, { text: `Ошибка: ${error.message}` });
      }
      break;

    case 'system_restart':
      if (!config.ADMIN_IDS.includes(userId)) {
        bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Доступ запрещен", show_alert: true });
        return;
      }
      bot.sendMessage(chatId, "⚠️ Вы уверены, что хотите перезагрузить сервер?", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Да", callback_data: "confirm_restart" },
              { text: "❌ Нет", callback_data: "cancel_restart" }
            ]
          ]
        }
      });
      break;

    case 'confirm_restart':
      logAction(userId, 'Confirmed restart');
      bot.editMessageText("🔄 Сервер будет перезагружен через 10 секунд...", {
        chat_id: chatId,
        message_id: messageId
      });
      setTimeout(() => execSync('sudo /sbin/shutdown -r now'), 10000);
      break;

    case 'cancel_restart':
      bot.deleteMessage(chatId, messageId);
      bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Перезагрузка отменена" });
      break;
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

function getSystemInfo() {
  try {
    const totalMem = (os.totalmem() / 1024 ** 3).toFixed(1);
    const freeMem = (os.freemem() / 1024 ** 3).toFixed(1);
    const ramInfo = `💽 ОЗУ: ${freeMem}/${totalMem} GB`;

    const cpuUsage = (os.loadavg()[0] * 100).toFixed(1);
    const cpuCores = os.cpus().length;
    const cpuInfo = `🚀 CPU: ${cpuUsage}% (ядер: ${cpuCores})`;

    const diskInfo = execSync('df -h / | awk \'NR==2{print $3 "/" $2}\'').toString().trim();
    const diskFormatted = `💾 Диск: ${diskInfo}`;

    let osInfo = "🐧 Система: ";
    try {
      if (fs.existsSync('/etc/os-release')) {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        osInfo += osRelease.match(/PRETTY_NAME="(.+)"/)[1];
      } else {
        osInfo += `${os.type()} ${os.release()}`;
      }
    } catch (e) {
      osInfo += "Не определено";
    }

    const uptime = formatUptime(os.uptime());
    const networkInfo = getNetworkInfo();

    return `🖥️ SystemInfo LeMan v1.1\n${ramInfo}\n${cpuInfo}\n${diskFormatted}\n${osInfo}\n⏱️ Uptime: ${uptime}\n\n${networkInfo}`;
  } catch (error) {
    return `❌ Ошибка: ${error.message}`;
  }
}

function getDetailedSystemInfo() {
  try {
    let tempInfo = "";
    if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
      const temp = parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000;
      tempInfo = `🌡️ Температура CPU: ${temp}°C\n\n`;
    }

    const cpuCoresInfo = os.cpus().map((cpu, i) => 
      `Ядро ${i+1}: ${((1 - cpu.times.idle / (cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq)) * 100).toFixed(1)}%`
    ).join('\n');

    const processes = execSync('ps -eo %cpu,cmd --sort=-%cpu | head -n 6 | tail -n 5').toString();
    const disks = execSync('df -h | grep -v "tmpfs"').toString();
    const network = execSync('ss -s | head -n 2').toString();

    return `${tempInfo}⚡ CPU ядра:\n${cpuCoresInfo}\n\n🔥 Процессы:\n${processes}\n\n💾 Диски:\n${disks}\n\n🌐 Сеть:\n${network}`;
  } catch (error) {
    return `❌ Ошибка: ${error.message}`;
  }
}

function getHardwareInfo() {
  try {
    const cpu = os.cpus()[0];
    let cpuTemp = "N/A";
    if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
      cpuTemp = `${parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000}°C`;
    }

    let gpuInfo = "N/A";
    try {
      gpuInfo = execSync('lspci | grep -i vga').toString().split(':')[2].trim();
    } catch (e) {}

    return `🖥️ Информация о железе:\n\n` +
           `🔹 CPU: ${cpu.model}\n` +
           `🧩 Ядер: ${os.cpus().length}\n` +
           `🌡️ Температура: ${cpuTemp}\n\n` +
           `🎮 GPU: ${gpuInfo}\n\n` +
           `💽 ОЗУ: ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB\n` +
           `💿 Диск: ${execSync('lsblk -o MODEL,SIZE -n -d').toString().trim()}`;
  } catch (error) {
    throw error;
  }
}

function getNetworkInfo() {
  let info = "🌐 Сеть:\n";
  const ifaces = os.networkInterfaces();
  
  Object.entries(ifaces).forEach(([name, addrs]) => {
    addrs.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) {
        info += `- ${name}: ${addr.address}\n`;
      }
    });
  });

  try {
    info += `- Public IP: ${execSync('curl -s ifconfig.me').toString().trim()}`;
  } catch (e) {
    info += "- Public IP: недоступен";
  }

  return info;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

console.log('✅ Бот запущен и готов к работе');
console.log('LeMan v2.0.0');