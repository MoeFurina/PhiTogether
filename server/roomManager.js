/**
 * RoomManager - PhiTogether 多人游戏房间管理器
 *
 * 完全适配前端 multiplayer.vue / multiIndex.vue 的协议
 *
 * 事件日志格式 (evt 数组):
 *   { msg: "i18nKey\u200Bparam1\u200Bparam2", time: timestamp }
 *
 * WebSocket 事件格式:
 *   { type: "eventType", extraInfo: ..., msg: "i18nKey\u200B..." }
 */

import crypto from 'crypto';

const MAX_PLAYERS = 20;
const MAX_EVENTS = 200;

// 房间闲置超时 (ms)
const ROOM_IDLE_TIMEOUT = 10 * 60 * 1000;     // 10 分钟无活跃玩家则关闭
const ROOM_CLEANUP_INTERVAL = 60 * 1000;       // 每分钟扫描一次
const CLOSED_ROOM_RETENTION = 5 * 60 * 1000;   // 关闭后保留 5 分钟再删除

class Room {
  constructor(id, ownerInfo, competeMode, description, isPublic) {
    this.id = id;
    this.stage = 0;
    this.owner = ownerInfo.id;
    this.compete_mode = !!competeMode;
    this.description = description || '';
    this.public = !!isPublic;
    this.playerNumber = 1;
    this.playRound = 0;
    this.playRounds = [];
    this.closed = false;
    this.createdAt = Date.now();
    this.closedAt = 0;
    this.lastActivity = Date.now();
    this.evt = [];

    this.players = {
      [ownerInfo.id]: {
        id: ownerInfo.id,
        name: ownerInfo.name,
        avatar: ownerInfo.avatar || '',
        online: true,
        exited: false,
        isOwner: true,
        scoreAvg: 0,
        accAvg: 0,
        playRecord: [],
      },
    };

    this.wsConnections = {};
    this.currentChart = null;
    this.loadedPlayers = new Set();
    this.scoreUploadedPlayers = new Set();
    this.jitsData = {};

    this._addLogMsg('roomCreatedMsg', ownerInfo.name, id);
  }

  /** 更新活跃时间 */
  touch() { this.lastActivity = Date.now(); }

  /** 检查房间是否超时闲置 */
  isIdle() {
    if (this.closed) return false; // 由另一个定时器清理
    if (this.stage > 0) return false; // 游戏中不清理
    const onlineCount = Object.values(this.players).filter(p => p.online).length;
    if (onlineCount > 0) return false;
    return (Date.now() - this.lastActivity) > ROOM_IDLE_TIMEOUT;
  }

  /** 检查已关闭房间是否可删除 */
  canDelete() {
    return this.closed && (Date.now() - this.closedAt) > CLOSED_ROOM_RETENTION;
  }

  // ---- 事件日志 ----

  _addLogMsg(i18nKey, ...params) {
    this.evt.unshift({ msg: i18nKey + '\u200B' + params.join('\u200B'), time: Date.now() });
    if (this.evt.length > MAX_EVENTS) this.evt.length = MAX_EVENTS;
  }

  // ---- 消息收发 ----

  broadcast(message, excludePlayerId = null) {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    for (const [pid, ws] of Object.entries(this.wsConnections)) {
      if (pid === excludePlayerId) continue;
      if (ws.readyState === 1) {
        try { ws.send(data); } catch (e) { /* ignore */ }
      }
    }
  }

  sendTo(playerId, message) {
    const ws = this.wsConnections[playerId];
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(typeof message === 'string' ? message : JSON.stringify(message)); return true; }
    catch (e) { return false; }
  }

  /**
   * 广播事件 (WebSocket + 日志)
   * @param {string} type - 事件类型
   * @param {*} extraInfo - 数据
   * @param {string|null} i18nKey - i18n 键 (null=不写日志)
   * @param {array} i18nParams - 参数
   */
  broadcastEvent(type, extraInfo, i18nKey = null, i18nParams = []) {
    const msg = { type, extraInfo };
    if (i18nKey) {
      const msgStr = i18nKey + '\u200B' + i18nParams.join('\u200B');
      msg.msg = msgStr;
      this._addLogRaw(msgStr);
    }
    this.broadcast(msg);
  }

  /** 添加纯 msg 日志 */
  _addLogRaw(msg) {
    this.evt.unshift({ msg, time: Date.now() });
    if (this.evt.length > MAX_EVENTS) this.evt.length = MAX_EVENTS;
  }

  // ---- 房间信息 ----

  getSummary() {
    const playerIds = Object.keys(this.players);
    const onlinePlayers = playerIds.filter(pid => this.players[pid].online);
    let totalAcc = 0, validCount = 0;
    for (const pid of playerIds) {
      const p = this.players[pid];
      if (p.playRecord.length > 0) { totalAcc += p.accAvg; validCount++; }
    }
    return {
      id: this.id,
      stage: this.stage,
      player_number: onlinePlayers.length,
      max_players: MAX_PLAYERS,
      description: this.description,
      owner_info: this.players[this.owner]?.name || 'unknown',
      avg_rks: validCount > 0 ? (totalAcc / validCount) * 100 : 0,
    };
  }

  getFullState() {
    return {
      id: this.id,
      stage: this.stage,
      owner: this.owner,
      compete_mode: this.compete_mode,
      description: this.description,
      public: this.public,
      playerNumber: this.playerNumber,
      playRound: this.playRound,
      playRounds: this.playRounds,
      players: this.players,
      evt: this.evt,
      closed: this.closed,
    };
  }

  // ---- 玩家管理 ----

  hasPlayer(playerId) { return !!this.players[playerId]; }

  addPlayer(playerInfo) {
    if (this.playerNumber >= MAX_PLAYERS) return false;
    if (this.players[playerInfo.id]) return false;
    if (this.stage !== 0) return false;

    this.players[playerInfo.id] = {
      id: playerInfo.id, name: playerInfo.name,
      avatar: playerInfo.avatar || '',
      online: true, exited: false, isOwner: false,
      scoreAvg: 0, accAvg: 0, playRecord: [],
    };
    this.playerNumber++;
    this.broadcastEvent('join', { id: playerInfo.id, name: playerInfo.name, avatar: playerInfo.avatar || '' },
      'roomJoinMsg', [playerInfo.name]);
    return true;
  }

  removePlayer(playerId, isExit = true) {
    const player = this.players[playerId];
    if (!player) return;
    const pName = player.name;

    if (this.stage === 0) {
      delete this.players[playerId];
      this.playerNumber = Math.max(0, this.playerNumber - 1);
    } else {
      player.exited = true;
      player.online = false;
    }

    this.broadcastEvent('exit', { id: playerId, type: isExit ? 1 : 0 }, 'exitMsg', [pName]);
    this._cleanupWS(playerId);

    if (playerId === this.owner) this._transferOwnershipInternal();

    const activePlayers = Object.values(this.players).filter(p => !p.exited);
    if (activePlayers.length === 0) this.close();
  }

  _cleanupWS(playerId) {
    const ws = this.wsConnections[playerId];
    if (ws) {
      try { ws.close(); } catch (e) { /* ignore */ }
      delete this.wsConnections[playerId];
    }
  }

  _transferOwnershipInternal() {
    const candidates = Object.entries(this.players)
      .filter(([pid, p]) => p.online && !p.exited && pid !== this.owner);
    if (candidates.length === 0) { this.close(); return; }
    const newOwnerId = candidates[0][0];
    this._doTransferOwnership(newOwnerId);
  }

  transferOwnership(newOwnerId) {
    if (!this.players[newOwnerId]) return;
    if (!this.players[newOwnerId].online || this.players[newOwnerId].exited) return;
    // 竞赛模式下不能转让 (前端已限制，服务端也强制)
    if (this.compete_mode) return;
    this._doTransferOwnership(newOwnerId);
  }

  _doTransferOwnership(newOwnerId) {
    this.players[this.owner].isOwner = false;
    this.owner = newOwnerId;
    this.players[newOwnerId].isOwner = true;
    this.broadcastEvent('ownerChanged', newOwnerId, 'ownerChangedMsg', [this.players[newOwnerId].name]);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.closedAt = Date.now();
    this.stage = 4;
    this._addLogMsg('roomClosedMsg');
    this.broadcast({
      type: 'close',
      extraInfo: { stage: this.stage, evt: [...this.evt] },
      msg: 'roomClosedMsg',
    });
    for (const ws of Object.values(this.wsConnections)) {
      try { ws.close(); } catch (e) { /* ignore */ }
    }
    this.wsConnections = {};
  }

  setOnline(playerId, online) {
    if (!this.players[playerId]) return;
    this.players[playerId].online = online;
    if (online) this.touch();
  }
}


// ============================
// RoomManager (主管理器)
// ============================
class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.wsToRoom = new Map();
    this._cleanupTimer = null;
    this._startCleanup();
  }

  /** 启动自动清理定时器 */
  _startCleanup() {
    this._cleanupTimer = setInterval(() => {
      this._cleanup();
    }, ROOM_CLEANUP_INTERVAL);
  }

  /** 停止清理 */
  stopCleanup() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  /** 清理过期房间 */
  _cleanup() {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      // 已关闭房间过保留期则删除
      if (room.canDelete()) {
        console.log(`[CLEANUP] Deleting closed room "${id}"`);
        this.rooms.delete(id);
        continue;
      }
      // 闲置超时且无活跃玩家的房间自动关闭
      if (room.isIdle()) {
        console.log(`[CLEANUP] Closing idle room "${id}"`);
        room.close();
      }
    }
  }

  createRoom(roomId, ownerInfo, competeMode = false, description = '', isPublic = false) {
    if (this.rooms.has(roomId)) return { code: 1, msg: 'roomIDOccupied' };
    const room = new Room(roomId, ownerInfo, competeMode, description, isPublic);
    this.rooms.set(roomId, room);
    return { code: 0, room };
  }

  getRoom(roomId) { return this.rooms.get(roomId) || null; }

  searchRooms(by = 'none', param1 = '', param2 = '') {
    let list = Array.from(this.rooms.values()).filter(r => !r.closed && r.stage === 0);
    switch (by) {
      case 'id':
        if (param1) list = list.filter(r => r.id.includes(param1));
        break;
      case 'rks': {
        const minRks = parseFloat(param1) || 0;
        const maxRks = parseFloat(param2) || 100;
        list = list.filter(r => {
          const s = r.getSummary();
          return s.avg_rks >= minRks * 100 && s.avg_rks <= maxRks * 100;
        });
        break;
      }
      case 'playerNumber': {
        const min = parseInt(param1) || 0;
        const max = parseInt(param2) || MAX_PLAYERS;
        list = list.filter(r => {
          const online = Object.values(r.players).filter(p => p.online).length;
          return online >= min && online <= max;
        });
        break;
      }
    }
    return list.map(r => r.getSummary());
  }

  joinRoom(roomId, playerInfo) {
    const room = this.rooms.get(roomId);
    if (!room) return { code: 1, msg: 'roomDoesntExist' };
    if (room.closed) return { code: 1, msg: 'roomClosedMsg' };
    if (room.stage !== 0) return { code: 1, msg: 'competetionStarted' };
    if (room.playerNumber >= MAX_PLAYERS) return { code: 1, msg: 'roomFull' };
    if (room.hasPlayer(playerInfo.id)) return { code: 1, msg: 'alreadyJoin' };
    room.addPlayer(playerInfo);
    return { code: 0, room };
  }

  /** 通过 WS URL 路径注册连接 */
  registerWSConnectionByPath(ws, pathname) {
    // 路径格式: /roomId/playerId 或 /roomId/playerId/token
    const parts = pathname.replace(/^\/+/, '').split('/');
    if (parts.length < 2) return false;

    const roomId = decodeURIComponent(parts[0]);
    const playerId = decodeURIComponent(parts[1]);

    const room = this.rooms.get(roomId);
    if (!room || !room.hasPlayer(playerId)) return false;

    this._registerWS(ws, roomId, playerId);
    return true;
  }

  /** 注册 WS 连接到房间 */
  _registerWS(ws, roomId, playerId) {
    // 如果同一 playerId 已有旧连接，先断开
    const room = this.rooms.get(roomId);
    if (room && room.wsConnections[playerId]) {
      try { room.wsConnections[playerId].close(); } catch (e) { /* ignore */ }
    }

    this.wsToRoom.set(ws, { roomId, playerId });
    if (room) {
      room.wsConnections[playerId] = ws;
      room.setOnline(playerId, true);
      const p = room.players[playerId];
      if (p) {
        room.broadcastEvent('reOnline', playerId, 'reOnlineMsg', [p.name], playerId);
      }
    }
  }

  /** 移除 WS 连接 */
  unregisterWSConnection(ws) {
    const info = this.wsToRoom.get(ws);
    if (info) {
      const { roomId, playerId } = info;
      const room = this.rooms.get(roomId);
      if (room) {
        const p = room.players[playerId];
        if (p) {
          p.online = false;
          room.broadcastEvent('offline', playerId, 'offlineMsg', [p.name], playerId);
        }
        delete room.wsConnections[playerId];
      }
      this.wsToRoom.delete(ws);
    }
  }

  /** 处理 WebSocket 消息 */
  handleWSMessage(ws, message) {
    const info = this.wsToRoom.get(ws);
    if (!info) return false;
    const { roomId, playerId } = info;
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.touch();

    let parsed;
    try { parsed = JSON.parse(message); } catch (e) { return false; }

    const { action, data } = parsed;
    if (!action) return false;

    switch (action) {
      case 'alive':           this._onAlive(room, playerId, ws); break;
      case 'getRoomInfo':     this._onGetRoomInfo(room, ws); break;
      case 'lockRoom':        this._onLock(room, playerId, ws); break;
      case 'syncChartInfo':   this._onSyncChart(room, playerId, data, ws); break;
      case 'loadChartFinish': this._onLoadChartFinish(room, playerId, ws); break;
      case 'startGamePlay':   this._onStartGame(room, playerId, ws); break;
      case 'JITS':            this._onJITS(room, playerId, data, ws); break;
      case 'uploadScoreInfo': this._onUploadScore(room, playerId, data, ws); break;
      case 'kickPlayer':      this._onKick(room, playerId, data, ws); break;
      case 'transferOwnerShip': this._onTransferOwner(room, playerId, data, ws); break;
      case 'userMsg':         this._onUserMsg(room, playerId, data, ws); break;
      case 'nextTrack':       this._onNextTrack(room, playerId, ws); break;
      case 'getPlayBackFile': this._onGetPlayBack(room, playerId, data, ws); break;
    }
    return true;
  }

  // ==================== 消息处理 ====================

  _onAlive(room, playerId, ws) {
    ws.send(JSON.stringify({ type: 'alive' }));
  }

  _onGetRoomInfo(room, ws) {
    ws.send(JSON.stringify({ type: 'roomInfo', data: room.getFullState() }));
  }

  _onLock(room, playerId, ws) {
    if (playerId !== room.owner) return;
    room.stage = 1;
    room.broadcastEvent('lock', null, 'roomLockMsg');
    ws.send(JSON.stringify({ type: 'success', data: 'lockRoom' }));
  }

  _onSyncChart(room, playerId, data, ws) {
    if (playerId !== room.owner) return;
    // stage 必须为 1 (已锁定选谱阶段) 才能同步谱面
    if (room.stage !== 1) return;

    room.currentChart = data;
    room.loadedPlayers.clear();
    room.scoreUploadedPlayers.clear();
    room.jitsData = {};
    room.stage = 5;
    // 非竞赛模式：房主自己已加载 (竞赛模式下房主不打，不占加载名额)
    if (!room.compete_mode) {
      room.loadedPlayers.add(playerId);
    }

    const sd = data.songData || {};
    const cd = data.chartData || {};
    room.broadcastEvent('loadChart', {
      songData: data.songData,
      chartData: data.chartData,
      speedInfo: data.speedInfo,
    }, 'chartSelectedMsg', [sd.name || '', cd.level || '', cd.difficulty || '', cd.charter || '']);

    ws.send(JSON.stringify({ type: 'success', data: 'syncChartInfo' }));
  }

  _onLoadChartFinish(room, playerId, ws) {
    const player = room.players[playerId];
    if (!player) return;

    room.loadedPlayers.add(playerId);
    const loadedCount = room.loadedPlayers.size;
    // 竞赛模式下房主不打，不计入总人数
    const totalPlayers = Object.values(room.players)
      .filter(p => !p.exited && !(room.compete_mode && p.id === room.owner)).length;

    room.broadcast({
      type: 'sbScoreUploaded',
      extraInfo: { id: playerId, name: player.name, n: loadedCount, total: totalPlayers },
      msg: 'sbChartLoadedMsg\u200B' + player.name + '\u200B' + loadedCount + '\u200B' + totalPlayers,
    });
    room._addLogMsg('sbChartLoadedMsg', player.name, loadedCount, totalPlayers);

    if (loadedCount >= totalPlayers) {
      room.stage = 2;
      room.broadcastEvent('allLoadFinish', { n: loadedCount }, 'allLoadFinishMsg');
    }
    ws.send(JSON.stringify({ type: 'success', data: 'loadChartFinish' }));
  }

  _onStartGame(room, playerId, ws) {
    if (playerId !== room.owner) return;
    if (room.stage !== 2) return; // 必须在所有玩家加载完成后才能开始
    room.stage = 3;
    room.broadcastEvent('gameStart', null, 'gameStartMsg');
  }

  _onJITS(room, playerId, data, ws) {
    if (!data || !room.players[playerId]) return;
    const player = room.players[playerId];
    const entry = {
      id: playerId, name: player.name,
      score: data.score || 0, acc: data.acc || 0,
      first: data.first || false,
    };
    room.jitsData[playerId] = entry;

    if (data.first) {
      ws.send(JSON.stringify({ type: 'allJITS', extraInfo: { ...room.jitsData } }));
    }
    room.broadcast({
      type: 'JITS',
      extraInfo: { id: playerId, name: player.name, score: data.score, acc: data.acc },
    }, playerId);
  }

  _onUploadScore(room, playerId, data, ws) {
    if (!data || !room.players[playerId]) return;

    // ---- 防止同一轮次重复上传 ----
    if (room.scoreUploadedPlayers.has(playerId)) {
      // 已上传过，忽略重复提交
      ws.send(JSON.stringify({ type: 'success', data: 'uploadScoreInfo' }));
      return;
    }

    // ---- compete_mode: 房主不上传分数 ----
    if (room.compete_mode && playerId === room.owner) {
      ws.send(JSON.stringify({ type: 'success', data: 'uploadScoreInfo' }));
      return;
    }

    const player = room.players[playerId];
    const record = {
      id: playerId, name: player.name,
      scoreNum: data.scoreNum || 0, scoreStr: data.scoreStr || '0000000',
      accNum: data.accNum || 0, accStr: data.accStr || '0.00%',
      all: data.all || 0, bad: data.bad || 0, good: data.good || 0,
      great: data.great || 0, perfect: data.perfect || 0,
      maxcombo: data.maxcombo || 0,
      extra: data.extra || '',
      playbackFile: data.playbackFile || '',
    };

    player.playRecord.push(record);

    let totalScore = 0, totalAcc = 0;
    for (const r of player.playRecord) { totalScore += r.scoreNum; totalAcc += r.accNum; }
    player.scoreAvg = player.playRecord.length > 0 ? totalScore / player.playRecord.length : 0;
    player.accAvg = player.playRecord.length > 0 ? totalAcc / player.playRecord.length : 0;

    room.scoreUploadedPlayers.add(playerId);
    const uploadedCount = room.scoreUploadedPlayers.size;
    // 竞赛模式下房主不打，不计入总人数
    const totalPlayers = Object.values(room.players)
      .filter(p => !p.exited && !(room.compete_mode && p.id === room.owner)).length;

    const updateInfo = {
      id: playerId, name: player.name,
      scoreNum: record.scoreNum, scoreStr: record.scoreStr,
      accNum: record.accNum, accStr: record.accStr,
      scoreAvg: player.scoreAvg, accAvg: player.accAvg,
      playRecord: player.playRecord,
      online: player.online, exited: player.exited, isOwner: player.isOwner,
    };

    room.broadcast({
      type: 'sbScoreUploaded',
      extraInfo: updateInfo,
      msg: 'sbScoreUploadedMsg\u200B' + player.name + '\u200B' + uploadedCount + '\u200B' + totalPlayers,
    });
    room._addLogMsg('sbScoreUploadedMsg', player.name, uploadedCount, totalPlayers);

    ws.send(JSON.stringify({ type: 'success', data: 'uploadScoreInfo' }));

    if (uploadedCount >= totalPlayers) {
      this._finalizeRound(room);
    }
  }

  /** 所有人上传完成，结束本轮 */
  _finalizeRound(room) {
    const roundScores = {};
    for (const [pid, p] of Object.entries(room.players)) {
      if (p.playRecord.length > 0) {
        const last = p.playRecord[p.playRecord.length - 1];
        roundScores[pid] = {
          id: pid, name: p.name,
          scoreNum: last.scoreNum, scoreStr: last.scoreStr,
          accNum: last.accNum, accStr: last.accStr,
          extra: last.extra,
        };
      }
    }

    const roundData = {
      n: room.playRound,
      finished: true,
      scores: roundScores,
      chartInfo: room.currentChart ? {
        songData: room.currentChart.songData,
        chartData: room.currentChart.chartData,
        speedInfo: room.currentChart.speedInfo,
      } : null,
    };

    room.playRounds.push(roundData);
    room.stage = 4;
    room.broadcastEvent('allScoreUploaded', roundData, 'allScoreUploadedMsg');
  }

  _onKick(room, playerId, targetId, ws) {
    if (playerId !== room.owner) return;
    if (targetId === playerId) { room.removePlayer(targetId, true); return; }
    if (!room.hasPlayer(targetId)) return;
    room.removePlayer(targetId, true);
  }

  _onTransferOwner(room, playerId, targetId, ws) {
    if (playerId !== room.owner) return;
    if (!room.hasPlayer(targetId) || targetId === playerId) return;
    room.transferOwnership(targetId);
  }

  _onUserMsg(room, playerId, content, ws) {
    if (!content || typeof content !== 'string') return;
    const player = room.players[playerId];
    if (!player) return;
    room.broadcastEvent('userMsg', { id: playerId, name: player.name, content },
      'userMsg', [player.name, content]);
    ws.send(JSON.stringify({ type: 'success', data: 'userMsg' }));
  }

  _onNextTrack(room, playerId, ws) {
    if (playerId !== room.owner) return;
    room.stage = 1;
    room.playRound++;
    room.loadedPlayers.clear();
    room.scoreUploadedPlayers.clear();
    room.currentChart = null;
    room.jitsData = {};
    room.broadcastEvent('nextTrack', null, 'nextTrackMsg');
  }

  async _onGetPlayBack(room, playerId, data, ws) {
    if (!data || typeof data.round !== 'number' || typeof data.player !== 'string') {
      ws.send(JSON.stringify({ type: 'playBackFile', data: '' }));
      return;
    }
    const { round, player: targetPid } = data;
    const p = room.players[targetPid];
    if (!p || p.playRecord.length === 0) {
      ws.send(JSON.stringify({ type: 'playBackFile', data: '' }));
      return;
    }
    // round 是倒序: 0 = 最新一轮
    const idx = p.playRecord.length - 1 - round;
    if (idx < 0 || idx >= p.playRecord.length) {
      ws.send(JSON.stringify({ type: 'playBackFile', data: '' }));
      return;
    }
    const playbackFile = p.playRecord[idx].playbackFile;
    if (!playbackFile) {
      ws.send(JSON.stringify({ type: 'playBackFile', data: '' }));
      return;
    }
    // playbackFile 已经是 btoa(json) + md5(json) 格式，直接透传
    // 前端会自己验证 MD5 并解析 JSON
    ws.send(JSON.stringify({ type: 'playBackFile', data: playbackFile }));
  }
}

export default RoomManager;
