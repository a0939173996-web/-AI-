/**
 * 本機假開發板（僅供協定／橋接驗證，不是 App 正式數據來源）
 * 模擬 TCP:4211 每秒推送韌體 JSON，並印出收到的夜燈指令。
 *
 * 用法：node tools/mock-device.mjs [port]
 */
import net from 'node:net';

const PORT = Number(process.argv[2] || 4211);
let tick = 0;

function buildStatus() {
  tick += 1;
  const phase = tick % 20;
  let sleep_motion_state = 'quiet';
  let breathing_rate_bpm = 14 + Math.sin(tick / 3) * 0.4;
  let signal_quality_index = 92;
  if (phase >= 14 && phase < 17) {
    sleep_motion_state = 'active';
    breathing_rate_bpm = 0;
    signal_quality_index = 35;
  } else if (phase >= 17) {
    sleep_motion_state = 'absent';
    breathing_rate_bpm = 0;
    signal_quality_index = 8;
  }
  return JSON.stringify({
    device_status: 'monitoring',
    signal_quality_index,
    sleep_motion_state,
    breathing_rate_bpm: Number(breathing_rate_bpm.toFixed(1)),
    light_mode: 'auto',
    brightness: -1,
    color: 'auto',
    rgb: [0, 0, 0],
  });
}

const clients = new Set();

const server = net.createServer((socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[mock-device] client connected ${remote}`);
  clients.add(socket);
  let buf = '';

  socket.write(`${buildStatus()}\n`);

  socket.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    while (true) {
      const i = buf.indexOf('\n');
      if (i < 0) break;
      const line = buf.slice(0, i).replace(/\r$/, '').trim();
      buf = buf.slice(i + 1);
      if (line) console.log(`[mock-device] light cmd <- ${line}`);
    }
  });

  socket.on('close', () => {
    clients.delete(socket);
    console.log(`[mock-device] client closed ${remote}`);
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
});

setInterval(() => {
  const line = `${buildStatus()}\n`;
  for (const socket of clients) {
    if (!socket.destroyed) socket.write(line);
  }
}, 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[mock-device] TCP listening on 0.0.0.0:${PORT} (Local-First test harness)`);
});
