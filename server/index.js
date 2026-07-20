/**
 * PhiTogether 多人游戏后端服务器
 *
 * HTTP API:
 *  GET    /api/multi/requestRoom/:roomId   - 请求房间服务器地址
 *  POST   /api/multi/createRoom/:roomId    - 创建房间
 *  POST   /api/multi/joinRoom/:roomId      - 加入房间
 *  GET    /api/multi/searchRoom            - 搜索房间
 *  GET    /api/health                      - 健康检查
 *  POST   /errReport                       - 错误上报 (兼容前端 errHandler.js)
 *  GET    /t/o                             - 遥测 ping
 *
 * WebSocket: ws://host/roomId/playerId
 *   - 路径格式: /roomId/playerId
 *   - 连接后服务端发 { type: "alive" } 确认
 *   - 后续双发 JSON 消息
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import crypto from 'crypto';
import RoomManager from './roomManager.js';

// ==================== 配置 ====================
const PORT = parseInt(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
// wsConn 格式: "host:port" (不含协议，前端会自己加 ws://)
const EXTERNAL_HOST = process.env.EXTERNAL_HOST || `localhost:${PORT}`;
const SUPPORTED_VERSIONS = ['4.0.0'];

// ==================== 初始化 ====================
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 1024 * 1024 * 50 });
const roomManager = new RoomManager();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== HTTP API ====================

/**
 * 1. 请求房间服务器地址
 * GET /api/multi/requestRoom/:roomId?v=version
 *
 * 返回 { code, msg, server_addr }
 *   code=0  -> 房间存在，可加入
 *   code=-2 -> 房间不存在，可创建
 *   code=1  -> 错误
 */
app.get('/api/multi/requestRoom/:roomId', (req, res) => {
  const { roomId } = req.params;
  const version = req.query.v || '0.0.0';

  if (!SUPPORTED_VERSIONS.includes(version)) {
    return res.json({ code: 1, msg: 'updatePTApp', server_addr: '' });
  }

  const room = roomManager.getRoom(roomId);
  if (room) {
    if (room.closed) {
      return res.json({ code: 1, msg: 'roomClosedMsg', server_addr: '' });
    }
    return res.json({ code: 0, msg: 'roomAvailable', server_addr: EXTERNAL_HOST });
  }

  res.json({ code: -2, msg: 'canCreateRoom', server_addr: EXTERNAL_HOST });
});

/**
 * 2. 搜索房间列表
 * GET /api/multi/searchRoom?by=id&param1=xxx&param2=xxx
 */
app.get('/api/multi/searchRoom', (req, res) => {
  const by = req.query.by || 'none';
  const param1 = req.query.param1 || '';
  const param2 = req.query.param2 || '';
  res.json(roomManager.searchRooms(by, param1, param2));
});

/**
 * 3. 创建房间
 * POST /api/multi/createRoom/:roomId
 * Body: { access_token, compete_mode, public, description }
 *
 * 返回 { code, selfRoom, selfUser, wsConn }
 *   wsConn 格式: "host:port/roomId/playerId"
 *   前端会将此用于 WebSocket 连接路径
 */
app.post('/api/multi/createRoom/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { access_token, compete_mode, public: isPublic, description } = req.body;

  const userInfo = parseUserFromToken(access_token);
  if (!userInfo) {
    return res.json({ code: 1, msg: 'error' });
  }

  const result = roomManager.createRoom(
    roomId, userInfo,
    compete_mode || false,
    description || '',
    isPublic || false
  );

  if (result.code !== 0) {
    return res.json({ code: result.code, msg: result.msg });
  }

  const room = result.room;
  // wsConn 包含路径信息，用于 WebSocket 自动注册
  const wsConn = `${EXTERNAL_HOST}/${encodeURIComponent(roomId)}/${encodeURIComponent(userInfo.id)}`;

  console.log(`[ROOM] Created "${roomId}" by ${userInfo.name} (${userInfo.id})`);

  res.json({
    code: 0,
    selfRoom: room.getFullState(),
    selfUser: { ...userInfo, isOwner: true },
    wsConn,
  });
});

/**
 * 4. 加入房间
 * POST /api/multi/joinRoom/:roomId
 * Body: { access_token }
 */
app.post('/api/multi/joinRoom/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { access_token } = req.body;

  const userInfo = parseUserFromToken(access_token);
  if (!userInfo) {
    return res.json({ code: 1, msg: 'error' });
  }

  const result = roomManager.joinRoom(roomId, userInfo);
  if (result.code !== 0) {
    return res.json({ code: result.code, msg: result.msg });
  }

  const room = result.room;
  const wsConn = `${EXTERNAL_HOST}/${encodeURIComponent(roomId)}/${encodeURIComponent(userInfo.id)}`;

  console.log(`[ROOM] ${userInfo.name} (${userInfo.id}) joined "${roomId}"`);

  res.json({
    code: 0,
    selfRoom: room.getFullState(),
    selfUser: { ...userInfo, isOwner: userInfo.id === room.owner },
    wsConn,
  });
});

/**
 * 5. 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: roomManager.rooms.size,
    version: '4.0.0',
    uptime: process.uptime(),
  });
});

/**
 * 6. 错误上报 (兼容前端 errHandler.js)
 * POST /errReport
 * Body: FormData { page, file, msg, stack, ver, uid }
 */
app.post('/errReport', (req, res) => {
  const { page, file, msg, stack, ver, uid } = req.body;
  console.log(`[ERRREPORT] ver=${ver} uid=${uid} page=${page} msg=${msg}`);
  // 可持久化到文件/数据库，这里仅记录日志
  res.json({ code: 0 });
});

/**
 * 7. 遥测 ping (兼容前端 errHandler.js)
 * GET /t/o
 */
app.get('/t/o', (req, res) => {
  res.json({ ok: true });
});

// ==================== WebSocket ====================

wss.on('connection', (ws, req) => {
  // 从 URL 路径提取 roomId/playerId
  // 路径格式: /roomId/playerId
  const pathname = req.url || '/';
  const registered = roomManager.registerWSConnectionByPath(ws, pathname);

  if (!registered) {
    // 如果路径不合法，发 refused 后关闭
    console.log(`[WS] Rejected connection from ${pathname} (invalid path)`);
    ws.send(JSON.stringify({ type: 'refused' }));
    ws.close();
    return;
  }

  // 提取 info 用于日志
  const parts = pathname.replace(/^\/+/, '').split('/');
  const roomId = decodeURIComponent(parts[0]);
  const playerId = decodeURIComponent(parts[1]);
  console.log(`[WS] ${playerId} connected to room ${roomId}`);

  // 发送 alive 确认连接
  ws.send(JSON.stringify({ type: 'alive' }));

  // 心跳超时检测
  let heartbeatTimer = null;
  let heartbeatMissed = 0;

  heartbeatTimer = setInterval(() => {
    heartbeatMissed++;
    if (heartbeatMissed > 3) {
      clearInterval(heartbeatTimer);
      console.log(`[WS] ${playerId} heartbeat timeout`);
      try { ws.close(); } catch (e) { /* ignore */ }
    }
  }, 15000);

  ws.on('message', (data) => {
    try {
      const message = data.toString();
      // 重置心跳
      const parsed = JSON.parse(message);
      if (parsed.action === 'alive') {
        heartbeatMissed = 0;
      }
      roomManager.handleWSMessage(ws, message);
    } catch (e) {
      console.error(`[WS] Message error from ${playerId}:`, e.message);
    }
  });

  ws.on('close', () => {
    roomManager.unregisterWSConnection(ws);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    console.log(`[WS] ${playerId} disconnected from room ${roomId}`);
  });

  ws.on('error', () => {
    roomManager.unregisterWSConnection(ws);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  });
});

// ==================== 辅助函数 ====================

function parseUserFromToken(token) {
  if (!token || token === 'null' || token === 'undefined') {
    return { id: 'guest_' + crypto.randomUUID().slice(0, 8), name: 'Guest', avatar: '' };
  }

  try {
    // JWT: header.payload.signature
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const decoded = Buffer.from(parts[1], 'base64url').toString('utf8');
        const parsed = JSON.parse(decoded);
        return {
          id: parsed.sub || parsed.id || parsed.userId || 'user_' + crypto.randomUUID().slice(0, 8),
          name: parsed.name || parsed.username || parsed.preferred_username || 'Player',
          avatar: parsed.avatar || '',
        };
      }
    }

    // 纯 JSON
    try {
      const parsed = JSON.parse(token);
      return {
        id: parsed.sub || parsed.id || parsed.userId || 'user_' + crypto.randomUUID().slice(0, 8),
        name: parsed.name || parsed.username || 'Player',
        avatar: parsed.avatar || '',
      };
    } catch (e) {
      // base64 JSON
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      return {
        id: parsed.sub || parsed.id || 'user_' + crypto.randomUUID().slice(0, 8),
        name: parsed.name || parsed.username || 'Player',
        avatar: parsed.avatar || '',
      };
    }
  } catch (e) {
    // fallback: 直接当用户名
    const id = 'user_' + crypto.createHash('md5').update(token).digest('hex').slice(0, 8);
    return { id, name: token.length > 16 ? token.slice(0, 16) : token, avatar: '' };
  }
}

// ==================== 启动 ====================

server.listen(PORT, HOST, () => {
  console.log(`┌──────────────────────────────────────────────────┐`);
  console.log(`│  PhiTogether Multiplayer Server v4.0.0           │`);
  console.log(`├──────────────────────────────────────────────────┤`);
  console.log(`│  HTTP API:  http://${EXTERNAL_HOST}/api/multi         │`);
  console.log(`│  WebSocket: ws://${EXTERNAL_HOST}/{room}/{user}       │`);
  console.log(`│  Rooms:     ${roomManager.rooms.size} active              │`);
  console.log(`│  Cleanup:   every 60s, idle timeout 10min        │`);
  console.log(`└──────────────────────────────────────────────────┘`);
});
