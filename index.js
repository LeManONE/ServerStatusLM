const TelegramBot = require('node-telegram-bot-api');
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');

const bot = new TelegramBot('YOUR_TELEGRAM_BOT_TOKEN', { polling: true });

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const systemInfo = getSystemInfo();
  
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔄 Обновить", callback_data: "refresh_status" },
          { text: "🔍 Подробнее", callback_data: "more_details" }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, systemInfo, options);
});

bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  if (callbackQuery.data === 'refresh_status') {
    const updatedInfo = getSystemInfo();
    bot.editMessageText(updatedInfo, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Обновить", callback_data: "refresh_status" },
            { text: "🔍 Подробнее", callback_data: "more_details" }
          ]
        ]
      }
    });
    bot.answerCallbackQuery(callbackQuery.id);
  } 
  else if (callbackQuery.data === 'more_details') {
    const detailedInfo = getDetailedSystemInfo();
    bot.editMessageText(detailedInfo, {
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
    bot.answerCallbackQuery(callbackQuery.id);
  }
  else if (callbackQuery.data === 'back_to_normal') {
    const normalInfo = getSystemInfo();
    bot.editMessageText(normalInfo, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Обновить", callback_data: "refresh_status" },
            { text: "🔍 Подробнее", callback_data: "more_details" }
          ]
        ]
      }
    });
    bot.answerCallbackQuery(callbackQuery.id);
  }
});

function getDetailedSystemInfo() {
  try {

    const cpus = os.cpus();
    let cpuCoresInfo = "⚡ Загрузка ядер CPU:\n";
    cpus.forEach((cpu, i) => {
      const coreUsage = ((1 - cpu.times.idle / (cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq)) * 100).toFixed(1);
      cpuCoresInfo += `Ядро ${i + 1}: ${coreUsage}%\n`;
    });

    const topProcesses = execSync('ps -eo %cpu,cmd --sort=-%cpu | head -n 6 | tail -n 5').toString();
    const processesInfo = "🔥 Топ-5 процессов:\n" + topProcesses;

    const disks = execSync('df -h | grep -v "tmpfs"').toString();
    const disksInfo = "💾 Диски:\n" + disks;

    const network = execSync('ss -s | head -n 2').toString();
    const networkInfo = "🌐 Сеть:\n" + network;

    return `${cpuCoresInfo}\n${processesInfo}\n${disksInfo}\n${networkInfo}`;
  } catch (error) {
    return `Ошибка: ${error.message}`;
  }
}

function getSystemInfo() {
  try {
    // 1. RAM (ОЗУ)
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
    const prettyName = osRelease.match(/PRETTY_NAME="(.+)"/)[1];
    osInfo += prettyName;
  } 
  else if (fs.existsSync('/etc/alpine-release')) {
    const alpineVersion = fs.readFileSync('/etc/alpine-release', 'utf8').trim();
    osInfo += `Alpine Linux ${alpineVersion}`;
  }
  else if (fs.existsSync('/etc/debian_version')) {
    const debianVersion = fs.readFileSync('/etc/debian_version', 'utf8').trim();
    osInfo += `Debian ${debianVersion}`;
  }
  else {
    osInfo += `${os.type()} ${os.release()} (дистрибутив не определен)`;
  }
} catch (error) {
  osInfo += "Ошибка определения ОС";
}

    const uptimeSeconds = os.uptime();
    const uptimeFormatted = `🔋 Uptime: ${formatUptime(uptimeSeconds)}`;

    const networkInterfaces = os.networkInterfaces();
    let networkInfo = "🌐 Сеть:\n";
    
    Object.keys(networkInterfaces).forEach(iface => {
      networkInterfaces[iface].forEach(details => {
        if (details.family === 'IPv4' && !details.internal) {
          networkInfo += `- ${iface}: ${details.address}\n`;
        }
      });
    });

    let publicIp = "Нет интернета";
    try {
      publicIp = execSync('curl -s ifconfig.me').toString().trim();
      networkInfo += `- Public IP: ${publicIp}\n`;
    } catch (e) {
      networkInfo += "- Public IP: недоступен\n";
    }

    return `SystemInfo LeMan v1.0.0:\n${ramInfo}\n${cpuInfo}\n${diskFormatted}\n${osInfo}\n${uptimeFormatted}\n\n${networkInfo}`;
  } catch (error) {
    return `Ошибка: ${error.message}`;
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

console.log('Бот запущен...');
