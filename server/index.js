/**
 * PhiTogether 多人游戏后端服务器 (Deno 原生版)
 *
 * 零 npm 依赖，直接 `deno run -A server/index.js`
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

import RoomManager from './roomManager.js';

// ==================== 配置 ====================
const PORT = parseInt(Deno.env.get('PORT') || '3000');
const HOST = Deno.env.get('HOST') || '0.0.0.0';
// wsConn 格式: "host:port" (不含协议，前端会自己加 ws://)
const EXTERNAL_HOST = Deno.env.get('EXTERNAL_HOST') || `localhost:${PORT}`;
const SUPPORTED_VERSIONS = ['4.0.0'];
const startTime = Date.now();

// ==================== 初始化 ====================
const roomManager = new RoomManager();

// ==================== CORS ====================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ==================== 辅助函数 ====================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
  });
}

/** base64url → UTF-8 字符串 */
function base64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

function parseUserFromToken(token) {
  if (!token || token === 'null' || token === 'undefined') {
    return { id: 'guest_' + crypto.randomUUID().slice(0, 8), name: 'Guest', avatar: '' };
  }

  try {
    // JWT: header.payload.signature
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const decoded = base64urlDecode(parts[1]);
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
    } catch (_) {
      // base64 JSON
      const decoded = atob(token);
      const parsed = JSON.parse(decoded);
      return {
        id: parsed.sub || parsed.id || 'user_' + crypto.randomUUID().slice(0, 8),
        name: parsed.name || parsed.username || 'Player',
        avatar: parsed.avatar || '',
      };
    }
  } catch (_) {
    // fallback: 随机 ID + 截取 token 作为名字
    const id = 'user_' + crypto.randomUUID().slice(0, 8);
    return { id, name: token.length > 16 ? token.slice(0, 16) : token, avatar: '' };
  }
}

async function getBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// ==================== 路由处理 ====================

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // ---- CORS 预检 ----
  if (method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // ---- WebSocket 升级 (路径格式: /roomId/playerId) ----
  const wsMatch = path.match(/^\/([^\/]+)\/([^\/]+)$/);
  if (wsMatch && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
    return handleWebSocket(request, wsMatch[1], wsMatch[2]);
  }

  // ---- HTTP API 路由 ----
  try {
    // GET /api/health
    if (path === '/api/health' && method === 'GET') {
      return jsonResponse({
        status: 'ok',
        rooms: roomManager.rooms.size,
        version: '4.0.0',
        uptime: (Date.now() - startTime) / 1000,
      });
    }

    // GET /t/o (遥测 ping)
    if (path === '/t/o' && method === 'GET') {
      return jsonResponse({ ok: true });
    }

    // POST /errReport (错误上报)
    if (path === '/errReport' && method === 'POST') {
      const body = await getBody(request);
      console.log(`[ERRREPORT] ver=${body.ver || ''} uid=${body.uid || ''} page=${body.page || ''} msg=${body.msg || ''}`);
      return jsonResponse({ code: 0 });
    }

    // GET /api/multi/requestRoom/:roomId
    const requestRoomMatch = path.match(/^\/api\/multi\/requestRoom\/(.+)$/);
    if (requestRoomMatch && method === 'GET') {
      const roomId = decodeURIComponent(requestRoomMatch[1]);
      const version = url.searchParams.get('v') || '0.0.0';

      if (!SUPPORTED_VERSIONS.includes(version)) {
        return jsonResponse({ code: 1, msg: 'updatePTApp', server_addr: '' });
      }

      const room = roomManager.getRoom(roomId);
      if (room) {
        if (room.closed) {
          return jsonResponse({ code: 1, msg: 'roomClosedMsg', server_addr: '' });
        }
        return jsonResponse({ code: 0, msg: 'roomAvailable', server_addr: EXTERNAL_HOST });
      }

      return jsonResponse({ code: -2, msg: 'canCreateRoom', server_addr: EXTERNAL_HOST });
    }

    // GET /api/multi/searchRoom
    if (path === '/api/multi/searchRoom' && method === 'GET') {
      const by = url.searchParams.get('by') || 'none';
      const param1 = url.searchParams.get('param1') || '';
      const param2 = url.searchParams.get('param2') || '';
      return jsonResponse(roomManager.searchRooms(by, param1, param2));
    }

    // POST /api/multi/createRoom/:roomId
    const createRoomMatch = path.match(/^\/api\/multi\/createRoom\/(.+)$/);
    if (createRoomMatch && method === 'POST') {
      const roomId = decodeURIComponent(createRoomMatch[1]);
      const body = await getBody(request);
      const { access_token, compete_mode, public: isPublic, description } = body;

      const userInfo = parseUserFromToken(access_token);
      if (!userInfo) {
        return jsonResponse({ code: 1, msg: 'error' });
      }

      const result = roomManager.createRoom(
        roomId, userInfo,
        compete_mode || false,
        description || '',
        isPublic || false,
      );

      if (result.code !== 0) {
        return jsonResponse({ code: result.code, msg: result.msg });
      }

      const room = result.room;
      const wsConn = `${EXTERNAL_HOST}/${encodeURIComponent(roomId)}/${encodeURIComponent(userInfo.id)}`;

      console.log(`[ROOM] Created "${roomId}" by ${userInfo.name} (${userInfo.id})`);

      return jsonResponse({
        code: 0,
        selfRoom: room.getFullState(),
        selfUser: { ...userInfo, isOwner: true },
        wsConn,
      });
    }

    // POST /api/multi/joinRoom/:roomId
    const joinRoomMatch = path.match(/^\/api\/multi\/joinRoom\/(.+)$/);
    if (joinRoomMatch && method === 'POST') {
      const roomId = decodeURIComponent(joinRoomMatch[1]);
      const body = await getBody(request);
      const { access_token } = body;

      const userInfo = parseUserFromToken(access_token);
      if (!userInfo) {
        return jsonResponse({ code: 1, msg: 'error' });
      }

      const result = roomManager.joinRoom(roomId, userInfo);
      if (result.code !== 0) {
        return jsonResponse({ code: result.code, msg: result.msg });
      }

      const room = result.room;
      const wsConn = `${EXTERNAL_HOST}/${encodeURIComponent(roomId)}/${encodeURIComponent(userInfo.id)}`;

      console.log(`[ROOM] ${userInfo.name} (${userInfo.id}) joined "${roomId}"`);

      return jsonResponse({
        code: 0,
        selfRoom: room.getFullState(),
        selfUser: { ...userInfo, isOwner: userInfo.id === room.owner },
        wsConn,
      });
    }

    // ---- 404 ----
    return textResponse('Not Found', 404);
  } catch (err) {
    console.error('[HTTP] Error:', err.message);
    return jsonResponse({ code: 1, msg: 'internalError' }, 500);
  }
}

// ==================== WebSocket 处理 ====================

function handleWebSocket(request, roomId, playerId) {
  roomId = decodeURIComponent(roomId);
  playerId = decodeURIComponent(playerId);

  let socket;
  let response;

  try {
    const upgrade = Deno.upgradeWebSocket(request);
    socket = upgrade.socket;
    response = upgrade.response;
  } catch (e) {
    console.log(`[WS] Upgrade failed for ${playerId} in ${roomId}: ${e.message}`);
    return new Response('WebSocket upgrade failed', { status: 400 });
  }

  // 注册 WS 连接到房间
  const registered = roomManager.registerWSConnectionByPath(socket, `/${roomId}/${playerId}`);

  if (!registered) {
    console.log(`[WS] Rejected connection from /${roomId}/${playerId} (room or player not found)`);
    socket.send(JSON.stringify({ type: 'refused' }));
    socket.close();
    return response;
  }

  console.log(`[WS] ${playerId} connected to room ${roomId}`);

  // 发送 alive 确认连接
  socket.send(JSON.stringify({ type: 'alive' }));

  // 心跳超时检测
  let heartbeatTimer = null;
  let heartbeatMissed = 0;

  heartbeatTimer = setInterval(() => {
    heartbeatMissed++;
    if (heartbeatMissed > 3) {
      clearInterval(heartbeatTimer);
      console.log(`[WS] ${playerId} heartbeat timeout`);
      try { socket.close(); } catch (_) { /* ignore */ }
    }
  }, 15000);

  // ---- 标准 WebSocket 事件 ----

  socket.addEventListener('message', (event) => {
    try {
      // event.data 是 string (JSON 文本)
      const message = typeof event.data === 'string'
        ? event.data
        : new TextDecoder().decode(event.data);

      // 重置心跳
      const parsed = JSON.parse(message);
      if (parsed.action === 'alive') {
        heartbeatMissed = 0;
      }
      roomManager.handleWSMessage(socket, message);
    } catch (e) {
      console.error(`[WS] Message error from ${playerId}:`, e.message);
    }
  });

  socket.addEventListener('close', () => {
    roomManager.unregisterWSConnection(socket);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    console.log(`[WS] ${playerId} disconnected from room ${roomId}`);
  });

  socket.addEventListener('error', () => {
    roomManager.unregisterWSConnection(socket);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  });

  return response;
}

// ==================== 启动 ====================

if (import.meta.main) {
  console.log(`┌──────────────────────────────────────────────────┐`);
  console.log(`│  PhiTogether Multiplayer Server v4.0.0 (Deno)    │`);
  console.log(`├──────────────────────────────────────────────────┤`);
  console.log(`│  HTTP API:  http://${EXTERNAL_HOST}/api/multi         │`);
  console.log(`│  WebSocket: ws://${EXTERNAL_HOST}/{room}/{user}       │`);
  console.log(`│  Rooms:     ${roomManager.rooms.size} active              │`);
  console.log(`│  Cleanup:   every 60s, idle timeout 10min        │`);
  console.log(`│  Runtime:   Deno ${Deno.version.deno}                       │`);
  console.log(`└──────────────────────────────────────────────────┘`);

  Deno.serve({ port: PORT, hostname: HOST }, handleRequest);
}

// 供 Deno Deploy 使用 (export default { fetch })
export default { fetch: handleRequest };
