import { Renderer } from "./renderer";
import { Stat } from "./components/Stat";
import { audio } from "@utils/js/aup";
import { Timer, FrameAnimater } from "@utils/js/common";
import { checkSupport } from "./utils/checkSupport";
import shared from "@utils/js/shared";

import { SpecialChartsProcessor, flag0 } from "./plugins/SpecialChartsProcessor";
import { Filter } from "./plugins/Filter";
import videoRecorder from "./plugins/video-recorder";
import { loadSkinFromBuffer, loadSkinFromDB } from "./components/ResourcePack/skin";
import { gauge } from "./plugins/gauge";

import { imgShader, imgSplit } from "./assetsProcessor/imgProcessor";
import { handleFile } from "./assetsProcessor/uploader";
import { loadResultResources } from "./utils/resources";

import { createCanvas } from "./utils/canvas";
import { adjustInfo } from "./utils/adjustInfo";

import ptdb from "@components/ptdb";
import { msgHandler } from "@utils/js/msgHandler";
import { Emitter } from "./utils/Emitter";
import { playBgm, playVideo } from "./utils/mediaPlayer";

import { judgeManager } from "./components/JudgeManager";
import { HitManager } from "./components/HitManager";
import { HitEvents } from "./components/HitManager/HitEvents";
import { HitWord } from "./components/HitManager/HitWord";
import { HitFeedback } from "./components/HitManager/HitFeedback";
import { LineImage } from "./components/LineImage";
import { loadLineData } from "./components/LoadLineData";
import { OperationHandler } from "./components/OperationHandler";

import { mainLoop } from "./renderer/Loop";
import { loadRes } from "@renderers/sim-phi/components/ResourcePack";

import { adjustSize } from "./utils/adjustSize";
import { tween } from "./utils/tween";

import { PlayController, PlayEvent } from "./utils/PlayController";

const $id = query => document.getElementById(query);
const $ = query => document.body.querySelector(query);
const $$ = query => document.body.querySelectorAll(query);

export const simphiPlayer = {
    async constructor() {
        shared.game = {
            ...shared.game,
            init: true,
            app: simphiPlayer.app,
            res: simphiPlayer.res,
            charts: simphiPlayer.chartData.charts,
            stat: simphiPlayer.stat,
            hitManager: simphiPlayer.hitManager,
            judgeManager,
            stage: simphiPlayer.stage,
            clearStat: simphiPlayer.clearStat,
            loadSkinFromBuffer,
            loadSkinFromDB,
            doFullScreen: simphiPlayer.stage.doFullScreen,
            adjustInfo,
            // qwqStop,
            // qwqPause: simphiPlayer.pause,
            frameAnimater: simphiPlayer.frameAnimater,
        };
        await shared.game.requestFullscreen();
        simphiPlayer.app.canvas.classList.add("fade");
        let loadedNum = 0;
        let errorNum = 0;
        if (await checkSupport()) return;
        const pth = "/src/respack/";
        let pack = "together-pack-1";

        shared.game.ptmain.playerLoaded();

        let ptSettings;
        try {
            ptSettings = await ptdb.gameConfig.get();
        } catch (e) {
            ptSettings = { resourcesType: "together-pack-1" };
        }

        if (ptSettings.resourcesType) {
            if (ptSettings.resourcesType === "pt-custom")
                loadRes(ptSettings["customResourceLink"], false, true);
            else if (ptSettings.resourcesType.startsWith("together-pack"))
                loadRes(`/src/respack/${ptSettings.resourcesType}`, false, true);
        }

        await Promise.all(
            Object.entries({
                JudgeLine: "JudgeLine.png",
                ProgressBar: "ProgressBar.png",
                Pause: "PauseNew.png",
                Rank: "Rank.png",
                FCV: "FCV.png",
                LevelOver0: "LevelOver0.ogg",
                LevelOver0_v2: "LevelOver0_v2.ogg",
                LevelOver1_v2: "LevelOver1_v2.ogg",
                LevelOver2_v2: "LevelOver2_v2.ogg",
                LevelOver3_v2: "LevelOver3_v2.ogg",
                Resume: "play.png",
                Retry: "replay.png",
                Back: "return.png",
                Loop: "loop.png",

                /* Default Respack Files, now replaced by `loadRes`.
        HitFXRaw: "clickRaw.png",
        Tap: "Tap.png",
        TapHL: "TapHL.png",
        Drag: "Drag.png",
        DragHL: "DragHL.png",
        Flick: "Flick.png",
        FlickHL: "FlickHL.png",
        HoldHead: "HoldHead.png",
        HoldHeadHL: "HoldHeadHL.png",
        Hold: "Hold.png",
        HoldHL: "HoldHL.png",
        HoldEnd: "HoldEnd.png",
        HitSong0: "HitSong0.ogg",
        HitSong1: "HitSong1.ogg",
        HitSong2: "HitSong2.ogg", */
            }).map(
                ([name, src], _i, arr) =>
                    new Promise(resolve => {
                        const xhr = new XMLHttpRequest();
                        const source = /* erc(src) ||  */ "/src/respack/shared/" + src;
                        xhr.open("get", (src = source), true);
                        xhr.responseType = "arraybuffer";
                        xhr.send();
                        xhr.onloadend = async () => {
                            if (!xhr.response || !xhr.response.byteLength) {
                                msgHandler.sendError(
                                    shared.game.ptmain.$t("simphi.loading.resLoadFailed1", [
                                        ++errorNum,
                                    ]),
                                    "",
                                    true
                                );
                            } else {
                                const a = new DataView(xhr.response, 0, 8);
                                const header1 = a.getUint32(0);
                                const header2 = a.getUint32(4);
                                if (header1 === 0x4f676753)
                                    simphiPlayer.res[name] = await audio.decode(xhr.response);
                                else if (header1 === 0x89504e47 && header2 === 0x0d0a1a0a)
                                    simphiPlayer.res[name] = await createImageBitmap(
                                        new Blob([xhr.response])
                                    );
                                else
                                    msgHandler.sendError(
                                        shared.game.ptmain.$t("simphi.loading.resLoadFailed1", [
                                            ++errorNum,
                                        ]),
                                        "",
                                        true
                                    );
                            }
                            resolve();
                        };
                    })
            )
        );
        if (errorNum)
            return msgHandler.sendError(
                shared.game.ptmain.$t("simphi.loading.resLoadFailed1", [errorNum])
            );
        simphiPlayer.res["NoImageBlack"] = await createImageBitmap(
            new ImageData(new Uint8ClampedArray(4).fill(0), 1, 1)
        );
        simphiPlayer.res["NoImageWhite"] = await createImageBitmap(
            new ImageData(new Uint8ClampedArray(4).fill(255), 1, 1)
        );
        simphiPlayer.res["JudgeLineMP"] = await imgShader(simphiPlayer.res["JudgeLine"], "#feffa9");
        simphiPlayer.res["JudgeLineFC"] = await imgShader(simphiPlayer.res["JudgeLine"], "#a2eeff");
        simphiPlayer.res["Ranks"] = await imgSplit(simphiPlayer.res["Rank"]);
        simphiPlayer.res["Rank"].close();
        simphiPlayer.res["mute"] = audio.mute(1);
        if (
            !(() => {
                const b = createCanvas(1, 1).getContext("2d");
                b.drawImage(simphiPlayer.res["JudgeLine"], 0, 0);
                return b.getImageData(0, 0, 1, 1).data[0];
            })()
        )
            return msgHandler.sendError(shared.game.i18n.t("simphi.loading.imgLoadingError"));
        
        // 加载结算界面所需的资源
        await loadResultResources();
        
        // if (ptSettings.resourcesType === "prpr-custom") await loadprprCustomRes();
        // msgHandler.sendError(shared.game.i18n.t("respack.unavailableNow"));  // disable custom respack for now
        shared.game.ptmain.simphiLoaded();
        $id("uploader").classList.remove("disabled");
        $id("select").classList.remove("disabled");
        simphiPlayer.emitter.dispatchEvent(new CustomEvent("change"));
        simphiPlayer.playController.ready();
    },

    plugins: { videoRecorder },

    modify: a => a,
    pressTime: 0,
    before: new Map(),
    now: new Map(),
    after: new Map(),
    end: new Map(),
    /** @type {(ctx:CanvasRenderingContext2D,time:number)=>void} */
    filter: null,
    filterOptions: {},
    "flag{qwq}": _ => {},

    handleFile,
    Filter: new Filter(),

    //qwq[water,demo,democlick]
    qwq: [null, false, null, null, 0, null],
    fucktemp2: null,
    resultPageData: false,

    res: {}, //存放资源
    customResourceMeta: {},

    qwqwq: false,

    /**@type {Map<ImageBitmap,LineImage>} */
    lineImages: new Map(),

    playController: new PlayController(),

    selectbg: $id("select-bg"),
    selectbgm: $id("select-bgm"),
    selectchart: $id("select-chart"),
    selectflip: $id("select-flip"),
    selectspeed: $id("select-speed"),
    showTransition: $id("showTransition"),

    chartInfo: {
        name: null,
        composer: null,
        illustrator: null,
        charter: null,
        difficultyString: "SP Lv.?",
    },
    updateChartInfo(chartInfo) {
        this.chartInfo = chartInfo;
    },

    stage: {
        resize(forced) {
            const ranking = forced || simphiPlayer.fucktemp2;
            simphiPlayer.app.stage.style.cssText = `;position:fixed;top:${forced ? 60 : 0}px;left:0;bottom:0;right:0;z-index:${ranking ? 0 : 1002};display:${location.hash.startsWith("#/playing") ? "block" : "none"};`;
        },
        async doFullScreen() {
            try {
                if (this.app.isFull) return;
                this.app.isFull = true;
                this.stage.resize();
            } catch (e) {
                this.stage.resize();
            }
        },
    },

    stat: new Stat(),
    app: new Renderer($id("stage")),

    status2: {
        text: "",
        list: [],
        reg(target, type, handler) {
            this.list[this.list.length] = { toString: () => handler(target) };
            target.addEventListener(type, this.update.bind(this));
        },
        update() {
            const arr = this.list.map(String).filter(Boolean);
            this.text = arr.length === 0 ? "" : `(${arr.join("+")})`;
        },
    },

    emitter: new Emitter("stop"),

    frameAnimater: new FrameAnimater(),
    timeInfo: {
        nowTime_ms: 0, //当前绝对时间(ms)
        curTime: 0, //最近一次暂停的音乐时间(s)
        curTime_ms: 0, //最近一次播放的绝对时间(ms)
        timeBgm: 0, //当前音乐时间(s)
        timeChart: 0, //当前谱面时间(s)
        duration: 0, //音乐时长(s)
    },
    animationInfo: {
        isInEnd: false, //开头过渡动画
        isOutStart: false, //结尾过渡动画
        isOutEnd: false, //临时变量
    },
    animationTimer: {
        in: new Timer(),
        out: new Timer(),
        end: new Timer(),
    },

    chartData: {
        levelText: "SP Lv.?",
        bgs: new Map(),
        bgsBlur: new Map(),
        bgms: new Map(),
        charts: new Map(),
        chartsMD5: new Map(),
        oriBuffers: new Map(),
        chartLineData: [], //line.csv
        chartInfoData: [], //info.csv
    },
    clearStat() {
        while (simphiPlayer.selectbg.options.length) simphiPlayer.selectbg.options.remove(0);
        while (simphiPlayer.selectchart.options.length) simphiPlayer.selectchart.options.remove(0);
        while (simphiPlayer.selectbgm.options.length) simphiPlayer.selectbgm.options.remove(0);
        simphiPlayer.chartData.bgs.clear();
        simphiPlayer.chartData.bgsBlur.clear();
        simphiPlayer.chartData.bgms.clear();
        simphiPlayer.chartData.oriBuffers.clear();
        simphiPlayer.chartData.charts.clear();
        simphiPlayer.chartData.chartsMD5.clear();
        simphiPlayer.chartData.chartLineData.length = 0;
        simphiPlayer.chartData.chartInfoData.length = 0;
    },

    tmps: {
        bgImage: null,
        bgVideo: null,
        bgMusic: _ => {},
        progress: 0,
        combo: "",
        combo2: "",
        showStat: false,
        statStatus: {
            pause: { show: true, offsetX: 0, offsetY: 0, alpha: 1 },
            combonumber: { show: true, offsetX: 0, offsetY: 0, alpha: 1 },
            combo: { show: true, offsetX: 0, offsetY: 0, alpha: 1 },
            score: { show: true, offsetX: 0, offsetY: 0, alpha: 1 },
            bar: { show: true, offsetX: 0, offsetY: 0, alpha: 1 }, // 血量
            name: { show: true, offsetX: 0, offsetY: 0, alpha: 1 },
            level: { show: true, offsetX: 0, offsetY: 0, alpha: 1 },
        },
        customForeDraw: null,
        customBackDraw: null,
        // canPause: true,
        get canPause() {
            return shared.game.ptmain.gameMode !== "multi";
        },
        hitFxRotate: false,
    },

    hitFeedbackList: new HitEvents({
        //存放点击特效
        updateCallback: i => ++i.time > 0,
        /**	@param {HitFeedback} i */
        iterateCallback: i => {
            simphiPlayer.app.ctxos.globalAlpha = 0.85;
            simphiPlayer.app.ctxos.setTransform(1, 0, 0, 1, i.offsetX, i.offsetY); //缩放
            simphiPlayer.app.ctxos.fillStyle = i.color;
            simphiPlayer.app.ctxos.beginPath();
            simphiPlayer.app.ctxos.arc(0, 0, simphiPlayer.app.lineScale * 0.5, 0, 2 * Math.PI);
            simphiPlayer.app.ctxos.fill();
        },
    }),
    hitImageList: new HitEvents({
        //存放点击特效
        updateCallback: i => simphiPlayer.timeInfo.nowTime_ms >= i.time + i.duration,
        /**	@param {HitImage} i */
        iterateCallback: i => {
            if (!simphiPlayer.emitter.eq("play") || simphiPlayer.app.pauseTime) return;
            const tick = (simphiPlayer.timeInfo.nowTime_ms - i.time) / i.duration;
            const effects = i.effects;
            simphiPlayer.app.ctxos.globalAlpha = 1;
            simphiPlayer.app.ctxos.setTransform(
                simphiPlayer.app.noteScaleRatio * 6,
                0,
                0,
                simphiPlayer.app.noteScaleRatio * 6,
                i.offsetX,
                i.offsetY
            ); //缩放
            simphiPlayer.app.ctxos.rotate(i.rotation);
            (effects[Math.floor(tick * effects.length)] || effects[effects.length - 1]).full(
                simphiPlayer.app.ctxos
            ); //停留约0.5秒
            simphiPlayer.app.ctxos.fillStyle = i.color;
            simphiPlayer.app.ctxos.globalAlpha = 1 - tick; //不透明度
            const r3 = 30 * (((0.2078 * tick - 1.6524) * tick + 1.6399) * tick + 0.4988); //方块大小
            if (r3 < 0) return;
            for (const j of i.direction) {
                const ds = j[0] * ((9 * tick) / (8 * tick + 1)); //打击点距离
                if (simphiPlayer.customResourceMeta["hitEvtDrawer"])
                    eval(
                        `{ const ctxos = simphiPlayer.app.ctxos; ${simphiPlayer.customResourceMeta["hitEvtDrawer"]} }`
                    );
                else {
                    simphiPlayer.app.ctxos.beginPath();
                    simphiPlayer.app.ctxos.arc(
                        ds * Math.cos(j[1]),
                        ds * Math.sin(j[1]),
                        (r3 / 3) * 2,
                        0,
                        2 * Math.PI
                    );
                    simphiPlayer.app.ctxos.fill();
                    simphiPlayer.app.ctxos.closePath();
                }
            }
        },
    }),
    hitWordList: new HitEvents({
        //存放点击特效
        updateCallback: i => simphiPlayer.timeInfo.nowTime_ms >= i.time + i.duration,
        /**	@param {HitWord} i */
        iterateCallback: i => {
            const tick = (simphiPlayer.timeInfo.nowTime_ms - i.time) / i.duration;
            simphiPlayer.app.ctxos.setTransform(1, 0, 0, 1, i.offsetX, i.offsetY); //缩放
            simphiPlayer.app.ctxos.font = `bold ${
                simphiPlayer.app.noteScaleRatio *
                (256 + 128 * (((0.2078 * tick - 1.6524) * tick + 1.6399) * tick + 0.4988))
            }px Saira`;
            simphiPlayer.app.ctxos.textAlign = "center";
            simphiPlayer.app.ctxos.fillStyle = i.color;
            simphiPlayer.app.ctxos.globalAlpha = 1 - tick; //不透明度
            simphiPlayer.app.ctxos.fillText(i.text, 0, -simphiPlayer.app.noteScaleRatio * 128);
        },
    }),
    hitManager: new HitManager(),

    atDraw3: function(statData) {
        const { app } = simphiPlayer;
        const { ctxos: ctx, canvasos: canvas } = app;
        
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        
        const bgImageBlur = simphiPlayer.background.getImageBlur();
        ctx.drawImage(bgImageBlur, ...adjustSize(bgImageBlur, canvas, 1));
        ctx.fillStyle = '#000';
        ctx.globalAlpha = app.brightness;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制褪色动画遮罩
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        const k = 3.7320508075688776; // tan75°
        ctx.setTransform(canvas.width - canvas.height / k, 0, -canvas.height / k, canvas.height, canvas.height / k, 0);
        ctx.fillRect(0, 0, 1, tween.easeOutCubic(clip((simphiPlayer.timeInfo.timeEnd.second - 0.13) * 0.94)));
        ctx.resetTransform();
        
        // 绘制结算界面黑条
        ctx.globalCompositeOperation = 'destination-over';
        const skew = (canvas.width - canvas.height / k) / (16 - 9 / k);
        ctx.setTransform(skew / 120, 0, 0, skew / 120, app.wlen - skew * 8, app.hlen - skew * 4.5);
        
        // 绘制黑条和装饰
        if (simphiPlayer.res.LevelOver4) ctx.drawImage(simphiPlayer.res.LevelOver4, 183, 42, 1184, 228);
        ctx.globalAlpha = clip((simphiPlayer.timeInfo.timeEnd.second - 0.27) / 0.83);
        if (simphiPlayer.res.LevelOver1) ctx.drawImage(simphiPlayer.res.LevelOver1, 102, 378);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        if (simphiPlayer.res.LevelOver5) {
            ctx.drawImage(simphiPlayer.res.LevelOver5, 700 * tween.easeOutCubic(clip(simphiPlayer.timeInfo.timeEnd.second * 1.25)) - 369, 91, 20, 80);
        }
        
        // 曲名和等级
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.font = '80px Custom,Noto Sans SC';
        const levelText = simphiPlayer.chartInfo.difficultyString;
        const chartName = simphiPlayer.chartInfo.name || 'Untitled';
        fillTextNode(ctx, chartName, 700 * tween.easeOutCubic(clip(simphiPlayer.timeInfo.timeEnd.second * 1.25)) - 320, 160, 80);
        ctx.font = '30px Custom,Noto Sans SC';
        const textWidth = fillTextNode(ctx, levelText, 700 * tween.easeOutCubic(clip(simphiPlayer.timeInfo.timeEnd.second * 1.25)) - 317, 212, 30);
        
        // Rank图标
        ctx.globalAlpha = clip((simphiPlayer.timeInfo.timeEnd.second - 1.87) * 3.75);
        const outerSize = 293 + clip((simphiPlayer.timeInfo.timeEnd.second - 1.87) * 3.75) * 100;
        const innerSize = 410 - clip((simphiPlayer.timeInfo.timeEnd.second - 1.87) * 2.14) * 164;
        if (simphiPlayer.res.LevelOver3) {
            ctx.drawImage(simphiPlayer.res.LevelOver3, 661 - outerSize / 2, 545 - outerSize / 2, outerSize, outerSize);
        }
        if (simphiPlayer.res.Ranks && simphiPlayer.res.Ranks[simphiPlayer.stat.rankStatus]) {
            ctx.drawImage(simphiPlayer.res.Ranks[simphiPlayer.stat.rankStatus], 661 - innerSize / 2, 545 - innerSize / 2, innerSize, innerSize);
        }
        
        // 各种数据
        ctx.globalAlpha = clip((simphiPlayer.timeInfo.timeEnd.second - 0.87) * 2.5);
        ctx.fillStyle = statData.newBestColor;
        ctx.fillText(statData.newBestStr, 898, 433);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(statData.scoreBest, 1180, 433);
        ctx.globalAlpha = clip((simphiPlayer.timeInfo.timeEnd.second - 1.87) * 2.5);
        ctx.textAlign = 'right';
        ctx.fillText(statData.scoreDelta, 1414, 433);
        ctx.globalAlpha = clip((simphiPlayer.timeInfo.timeEnd.second - 0.95) * 1.5);
        ctx.textAlign = 'left';
        ctx.fillText(simphiPlayer.stat.accStr, 352, 550);
        ctx.fillText(simphiPlayer.stat.maxcombo.toString(), 1528, 550);
        
        // 速度显示
        ctx.fillStyle = statData.textAboveColor;
        ctx.fillText(app.speed === 1 ? '' : statData.textAboveStr.replace('{SPEED}', app.speed.toFixed(2)), 383 + Math.min(textWidth, 750), 212);
        
        // 状态显示
        ctx.fillStyle = statData.textBelowColor;
        ctx.fillText(statData.textBelowStr, 1355, 595);
        
        // 分数显示
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '86px Custom,Noto Sans SC';
        ctx.globalAlpha = clip((simphiPlayer.timeInfo.timeEnd.second - 1.12) * 2.0);
        ctx.fillText(simphiPlayer.stat.scoreStr, 1075, 569);
        
        // 判定信息
        ctx.font = '26px Custom,Noto Sans SC';
        ctx.globalAlpha = clip((simphiPlayer.timeInfo.timeEnd.second - 0.87) * 2.5);
        ctx.fillText(simphiPlayer.stat.perfect.toString(), 891, 650);
        ctx.globalAlpha = clip((simphiPlayer.timeInfo.timeEnd.second - 1.07) * 2.5);
        ctx.fillText(simphiPlayer.stat.good.toString(), 1043, 650);
        ctx.globalAlpha = clip((simphiPlayer.timeInfo.timeEnd.second - 1.27) * 2.5);
        ctx.fillText(simphiPlayer.stat.bad.toString(), 1196, 650);
        
        // Reset canvas state
        ctx.resetTransform();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        const bgImage = simphiPlayer.background.getImage();
        ctx.drawImage(bgImage, ...adjustSize(bgImage, canvas, 1));
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
    },
};

shared.game.simphi = simphiPlayer.app;
shared.game.player = simphiPlayer;

simphiPlayer.now.set("gauge", gauge.calc);
shared.game.stage = simphiPlayer.stage;
self.addEventListener("resize", () => simphiPlayer.stage.resize());
//uploader

const operationHandler = new OperationHandler(simphiPlayer.app.canvas);

//hit end
//初始化
//初始化(踩坑：监听DOMContentLoaded似乎会阻塞页面导致长时间白屏)
window.addEventListener("load", simphiPlayer.constructor, { once: true });

simphiPlayer.frameAnimater.setCallback(mainLoop);
function onPageVisibilityChange() {
    if (document.visibilityState === "hidden")
        if (simphiPlayer.emitter.eq("play")) simphiPlayer.playController.pause();
        else {
            if (!audio._actx) return;
            audio._actx.suspend();
            shared.game.afterShow.push(() => {
                audio._actx.resume();
            });
        }
}
document.addEventListener("visibilitychange", onPageVisibilityChange);
document.addEventListener("pagehide", onPageVisibilityChange); //兼容Safari

simphiPlayer.stage.resize(); //qwq

//html交互(WIP)
$id("select-note-scale").addEventListener("change", evt =>
    simphiPlayer.app.setNoteScale(evt.target.value)
);
$id("select-background-dim").addEventListener(
    "change",
    evt => (simphiPlayer.app.brightness = Number(evt.target.value))
);
simphiPlayer.selectflip.addEventListener("change", evt => {
    simphiPlayer.app.mirrorView(evt.target.value);
});
simphiPlayer.selectspeed.addEventListener("change", evt => {
    const dict = { Slowest: -9, Slower: -4, "": 0, Faster: 3, Fastest: 5 };
    simphiPlayer.app.speed = 2 ** (dict[evt.target.value] / 12);
});
$id("select-volume").addEventListener("change", evt => {
    const volume = Number(evt.target.value);
    simphiPlayer.app.musicVolume = Math.min(1, 1 / volume);
    simphiPlayer.app.soundVolume = Math.min(1, volume);
    Promise.resolve()
        .then(simphiPlayer.playController.pause)
        .then(simphiPlayer.playController.resume);
});
// TODO
const lowRes = $id("lowRes");
const maxFrame = $id("maxFrame");
const isMaxFrame = $id("isMaxFrame");
const isForcedMaxFrame = $id("isForcedMaxFrame");
simphiPlayer.app.playMode = 0;
lowRes.addEventListener("change", evt => {
    simphiPlayer.app.setLowResFactor(
        evt.target.checked ? (window.devicePixelRatio < 2 ? 0.85 : 0.5) : 1
    );
});
simphiPlayer.selectbg.onchange = () => {
    //qwq
    simphiPlayer.app.bgImage = simphiPlayer.chartData.bgs.get(simphiPlayer.selectbg.value);
    simphiPlayer.app.bgImageBlur = simphiPlayer.chartData.bgsBlur.get(simphiPlayer.selectbg.value);
    simphiPlayer.stage.resize();
};
maxFrame.addEventListener("change", function () {
    if (this.value < 25) shared.game.ptmain.gameConfig.maxFrame = 25;
    if (this.value > 1000) shared.game.ptmain.gameConfig.maxFrame = 1000;
    simphiPlayer.frameAnimater.setFrameRate(
        shared.game.ptmain.gameConfig.maxFrame,
        shared.game.ptmain.gameConfig.isForcedMaxFrame
    );
});
isMaxFrame.addEventListener("change", function () {
    simphiPlayer.frameAnimater.setFrameRate(
        this.checked ? maxFrame.value : 0,
        shared.game.ptmain.gameConfig.isForcedMaxFrame
    );
});
isForcedMaxFrame.addEventListener("change", function () {
    simphiPlayer.frameAnimater.setFrameRate(isMaxFrame.checked ? maxFrame.value : 0, this.checked);
});
//play
simphiPlayer.emitter.addEventListener(
    "change",
    /** @this {Emitter} */ function () {
        simphiPlayer.app.canvas.classList.toggle("fade", this.eq("stop"));
        for (const i of $$(".disabled-when-playing"))
            i.classList.toggle("disabled", this.ne("stop"));
        if (this.eq("play"))
            simphiPlayer.app.playMode =
                shared.game.ptmain.gameConfig.autoplay  ||
                shared.game.ptmain.playConfig.mode === "preview"
                    ? 1
                    : 0;
    }
);
simphiPlayer.playController.addEventListener(PlayEvent.Stop, async function () {
    simphiPlayer.emitter.emit("stop");
    operationHandler.deactivate();
    audio.stop();
    simphiPlayer.frameAnimater.stop();
    //清除原有数据
    simphiPlayer.resultPageData = false;
    simphiPlayer.fucktemp2 = null;
    if (simphiPlayer.app.pauseNextTick)
        clearInterval(simphiPlayer.app.pauseNextTick),
            (simphiPlayer.app.pauseTime = 0),
            (simphiPlayer.app.pauseNextTick = null);
    simphiPlayer.hitFeedbackList.clear();
    simphiPlayer.hitImageList.clear();
    simphiPlayer.hitWordList.clear();
    simphiPlayer.animationTimer.in.reset();
    simphiPlayer.animationTimer.out.reset();
    simphiPlayer.animationTimer.end.reset();
    simphiPlayer.timeInfo.curTime = 0;
    simphiPlayer.timeInfo.curTime_ms = 0;
    simphiPlayer.timeInfo.duration = 0;
    for (const i of simphiPlayer.end.values()) await i();
});
simphiPlayer.playController.addEventListener(PlayEvent.Play, async function () {
    if (!simphiPlayer.selectchart.value)
        return msgHandler.sendError(shared.game.i18n.t("simphi.playErr.noChartSelected"));
    if (!simphiPlayer.selectbgm.value)
        return msgHandler.sendError(shared.game.i18n.t("simphi.playErr.noMusicSelected"));
    simphiPlayer.app.stage.style.display = "block";
    for (const i of simphiPlayer.before.values()) await i();
    audio.play(simphiPlayer.res["mute"], { loop: true, isOut: false }); //播放空音频(避免音画不同步)
    simphiPlayer.app.prerenderChart(
        simphiPlayer.modify(simphiPlayer.chartData.charts.get(simphiPlayer.selectchart.value))
    ); //fuckqwq
    const md5 = simphiPlayer.chartData.chartsMD5.get(simphiPlayer.selectchart.value);
    simphiPlayer.stat.level = Number(simphiPlayer.chartData.levelText.match(/\d+$/));
    simphiPlayer.stat.reset(simphiPlayer.app.chart.numOfNotes, md5, simphiPlayer.selectspeed.value);
    await loadLineData();
    simphiPlayer.app.bgImage =
        simphiPlayer.chartData.bgs.get(simphiPlayer.selectbg.value) ||
        simphiPlayer.res["NoImageWhite"];
    simphiPlayer.app.bgImageBlur =
        simphiPlayer.chartData.bgsBlur.get(simphiPlayer.selectbg.value) ||
        simphiPlayer.res["NoImageWhite"];
    const bgm = simphiPlayer.chartData.bgms.get(simphiPlayer.selectbgm.value);
    simphiPlayer.app.bgMusic = bgm.audio;
    simphiPlayer.app.bgVideo = bgm.video;
    simphiPlayer.timeInfo.duration = simphiPlayer.app.bgMusic.duration / simphiPlayer.app.speed;
    simphiPlayer.animationInfo.isInEnd = false;
    simphiPlayer.animationInfo.isOutStart = false;
    simphiPlayer.animationInfo.isOutEnd = false;
    simphiPlayer.timeInfo.timeBgm = 0;
    if (!simphiPlayer.showTransition.checked) simphiPlayer.animationTimer.in.addTime(3e3);
    simphiPlayer.stage.resize();
    simphiPlayer.frameAnimater.start();
    simphiPlayer.animationTimer.in.play();
    operationHandler.activate();
    simphiPlayer.emitter.emit("play");
});
simphiPlayer.playController.addEventListener(PlayEvent.Pause, async function () {
    if (
        /* simphiPlayer.btnPause.classList.contains("disabled") ||  */ !simphiPlayer.tmps
            .canPause ||
        simphiPlayer.resultPageData
    )
        return;
    if (simphiPlayer.app.bgVideo) simphiPlayer.app.bgVideo.pause();
    simphiPlayer.app.pauseBackgroundDimPara1 = null;
    simphiPlayer.animationTimer.in.pause();
    if (simphiPlayer.showTransition.checked && simphiPlayer.animationInfo.isOutStart)
        simphiPlayer.animationTimer.out.pause();
    simphiPlayer.timeInfo.curTime = simphiPlayer.timeInfo.timeBgm;
    audio.stop();
    simphiPlayer.emitter.emit("pause");
});
simphiPlayer.playController.addEventListener(PlayEvent.Resume, async function () {
    if (simphiPlayer.resultPageData) return;
    if (shared.game.ptmain.playConfig.mode === "preview") {
        clearInterval(simphiPlayer.app.pauseNextTick);
        if (simphiPlayer.app.bgVideo)
            await playVideo(
                simphiPlayer.app.bgVideo,
                simphiPlayer.timeInfo.timeBgm * simphiPlayer.app.speed
            );
        simphiPlayer.animationTimer.in.play();
        if (simphiPlayer.showTransition.checked && simphiPlayer.animationInfo.isOutStart)
            simphiPlayer.animationTimer.out.play();
        if (simphiPlayer.animationInfo.isInEnd && !simphiPlayer.animationInfo.isOutStart)
            playBgm(
                simphiPlayer.app.bgMusic,
                simphiPlayer.timeInfo.timeBgm * simphiPlayer.app.speed
            );
        simphiPlayer.emitter.emit("play");
        return;
    }
    simphiPlayer.app.pauseTime = 3;
    simphiPlayer.app.pauseBackgroundDimPara1 = performance.now();
    simphiPlayer.app.pauseNextTick = setInterval(async () => {
        simphiPlayer.app.pauseTime--;
        if (simphiPlayer.app.pauseTime <= 0) {
            simphiPlayer.app.pauseTime = 0;
            clearInterval(simphiPlayer.app.pauseNextTick);
            simphiPlayer.app.pauseNextTick = null;
            simphiPlayer.app.pauseBackgroundDimPara1 = Infinity;
            if (
                !shared.game.ptmain.gameConfig.reviewWhenResume ||
                simphiPlayer.timeInfo.curTime <= 3
            ) {
                if (simphiPlayer.app.bgVideo)
                    await playVideo(
                        simphiPlayer.app.bgVideo,
                        simphiPlayer.timeInfo.timeBgm * simphiPlayer.app.speed
                    );
                simphiPlayer.animationTimer.in.play();
                if (simphiPlayer.showTransition.checked && simphiPlayer.animationInfo.isOutStart)
                    simphiPlayer.animationTimer.out.play();
                if (simphiPlayer.animationInfo.isInEnd && !simphiPlayer.animationInfo.isOutStart)
                    playBgm(
                        simphiPlayer.app.bgMusic,
                        simphiPlayer.timeInfo.timeBgm * simphiPlayer.app.speed
                    );
                simphiPlayer.emitter.emit("play");
            }
        }
    }, 1000);
    if (shared.game.ptmain.gameConfig.reviewWhenResume && simphiPlayer.timeInfo.curTime > 3) {
        if (simphiPlayer.timeInfo.curTime > 3)
            simphiPlayer.timeInfo.timeBgm = simphiPlayer.timeInfo.curTime -= 3;
        if (simphiPlayer.app.bgVideo)
            await playVideo(
                simphiPlayer.app.bgVideo,
                simphiPlayer.timeInfo.timeBgm * simphiPlayer.app.speed
            );
        simphiPlayer.animationTimer.in.play();
        if (simphiPlayer.showTransition.checked && simphiPlayer.animationInfo.isOutStart)
            simphiPlayer.animationTimer.out.play();
        if (simphiPlayer.animationInfo.isInEnd && !simphiPlayer.animationInfo.isOutStart)
            playBgm(
                simphiPlayer.app.bgMusic,
                simphiPlayer.timeInfo.timeBgm * simphiPlayer.app.speed
            );
        simphiPlayer.emitter.emit("play");
    }
});
simphiPlayer.status2.reg(simphiPlayer.emitter, "change", _ =>
    simphiPlayer.qwqwq ? "Reversed" : ""
); //qwq
simphiPlayer.status2.reg(
    simphiPlayer.selectflip,
    "change",
    target => ["", "FlipX", "FlipY", "FlipX&Y"][target.value]
);
simphiPlayer.status2.reg(simphiPlayer.selectspeed, "change", target => target.value);
simphiPlayer.status2.reg(simphiPlayer.emitter, "change", (/** @type {Emitter} */ target) =>
    target.eq("pause") ? "Paused" : ""
);
export var hook = (self.hook = simphiPlayer);
simphiPlayer.before.set(flag0, SpecialChartsProcessor.before);

//plugin(filter)
const enableFilter = $id("enableFilter");
(function () {
    const input = $id("filterInput");
    input.addEventListener("change", async () => simphiPlayer.Filter.change(input.value));
    enableFilter.addEventListener("change", function () {
        if (!this.checked) simphiPlayer.Filter.disable();
        else input.dispatchEvent(new Event("change"));
    });
    enableFilter.dispatchEvent(new Event("change"));
})();

simphiPlayer.pauseHook = () =>
    simphiPlayer.emitter.eq("play") && simphiPlayer.playController.pause();
simphiPlayer.app.reloadRes = loadRes;

// --- 结算动画相关（从 sim-phi/src/index.ts 移植）
function clip(num) {
    if (num < 0) return 0;
    if (num > 1) return 1;
    return num;
}

function fillTextNode(text, x, y, size, maxWidth, ctx) {
    ctx.font = `${size}px Custom,Noto Sans SC`;
    const dx = ctx.measureText(text).width;
    if (dx > maxWidth) ctx.font = `${(size / dx) * maxWidth}px Custom,Noto Sans SC`;
    ctx.fillText(text, x, y);
    return dx;
}

function atDraw3(statData) {
    const ctxos = simphiPlayer.app.ctxos;
    const canvasos = simphiPlayer.app.canvasos;
    if (!ctxos || !canvasos) return;
    ctxos.resetTransform();
    ctxos.clearRect(0, 0, canvasos.width, canvasos.height);
    ctxos.globalAlpha = 1;
    const bgImageBlur = simphiPlayer.app.bgImageBlur || simphiPlayer.res['NoImageWhite'];
    try {
        ctxos.drawImage(bgImageBlur, ...adjustSize(bgImageBlur, canvasos, 1));
    } catch (e) {
        ctxos.fillStyle = '#000';
        ctxos.fillRect(0, 0, canvasos.width, canvasos.height);
    }
    ctxos.fillStyle = '#000';
    ctxos.globalAlpha = simphiPlayer.app.brightness || 1;
    ctxos.fillRect(0, 0, canvasos.width, canvasos.height);
    ctxos.globalCompositeOperation = 'destination-out';
    ctxos.globalAlpha = 1;
    const k = 3.7320508075688776;
    ctxos.setTransform(canvasos.width - canvasos.height / k, 0, -canvasos.height / k, canvasos.height, canvasos.height / k, 0);
    ctxos.fillRect(0, 0, 1, tween.easeOutCubic ? tween.easeOutCubic(clip((simphiPlayer.animationTimer.end.second - 0.13) * 0.94)) : clip((simphiPlayer.animationTimer.end.second - 0.13) * 0.94));
    ctxos.resetTransform();
    ctxos.globalCompositeOperation = 'destination-over';
    const skew = (canvasos.width - canvasos.height / k) / (16 - 9 / k);
    ctxos.setTransform(skew / 120, 0, 0, skew / 120, simphiPlayer.app.wlen - skew * 8, simphiPlayer.app.hlen - skew * 4.5);
    if (simphiPlayer.res.LevelOver4) ctxos.drawImage(simphiPlayer.res.LevelOver4, 183, 42, 1184, 228);
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 0.27) / 0.83);
    if (simphiPlayer.res.LevelOver1) ctxos.drawImage(simphiPlayer.res.LevelOver1, 102, 378);
    ctxos.globalCompositeOperation = 'source-over';
    ctxos.globalAlpha = 1;
    if (simphiPlayer.res.LevelOver5) ctxos.drawImage(simphiPlayer.res.LevelOver5, 700 * tween.easeOutCubic(clip(simphiPlayer.animationTimer.end.second * 1.25)) - 369, 91, 20, 80);
    ctxos.fillStyle = '#fff';
    ctxos.textAlign = 'left';
    const name = simphiPlayer.chartInfo && simphiPlayer.chartInfo.name ? simphiPlayer.chartInfo.name : (simphiPlayer.app.inputName ? simphiPlayer.app.inputName.value || simphiPlayer.app.inputName.placeholder : '');
    fillTextNode(name, 700 * tween.easeOutCubic(clip(simphiPlayer.animationTimer.end.second * 1.25)) - 320, 160, 80, 1500, ctxos);
    const levelText = simphiPlayer.chartInfo ? simphiPlayer.chartInfo.difficultyString || simphiPlayer.chartData.levelText : simphiPlayer.chartData.levelText;
    const textWidth = fillTextNode(levelText, 700 * tween.easeOutCubic(clip(simphiPlayer.animationTimer.end.second * 1.25)) - 317, 212, 30, 750, ctxos);
    ctxos.font = '30px Custom,Noto Sans SC';
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 1.87) * 3.75);
    const outerSize = 293 + clip((simphiPlayer.animationTimer.end.second - 1.87) * 3.75) * 100;
    const innerSize = 410 - clip((simphiPlayer.animationTimer.end.second - 1.87) * 2.14) * 164;
    if (simphiPlayer.res.LevelOver3) ctxos.drawImage(simphiPlayer.res.LevelOver3, 661 - outerSize / 2, 545 - outerSize / 2, outerSize, outerSize);
    if (simphiPlayer.res.Ranks) {
        const rankIdx = (simphiPlayer.stat && simphiPlayer.stat.rankStatus) ? simphiPlayer.stat.rankStatus : 0;
        const rankImg = simphiPlayer.res.Ranks[rankIdx] || simphiPlayer.res.Ranks[0];
        if (rankImg) ctxos.drawImage(rankImg, 661 - innerSize / 2, 545 - innerSize / 2, innerSize, innerSize);
    }
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 0.87) * 2.5);
    ctxos.fillStyle = statData.newBestColor || '#fff';
    ctxos.fillText(statData.newBestStr || '', 898, 433);
    ctxos.fillStyle = '#fff';
    ctxos.textAlign = 'center';
    ctxos.fillText(statData.scoreBest || '', 1180, 433);
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 1.87) * 2.5);
    ctxos.textAlign = 'right';
    ctxos.fillText(statData.scoreDelta || '', 1414, 433);
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 0.95) * 1.5);
    ctxos.textAlign = 'left';
    ctxos.fillText(simphiPlayer.stat.accStr || '', 352, 550);
    ctxos.fillText(String(simphiPlayer.stat.maxcombo || ''), 1528, 550);
    ctxos.fillStyle = statData.textAboveColor || '#fff';
    ctxos.fillText((simphiPlayer.app.speed === 1 ? '' : (statData.textAboveStr || '').replace('{SPEED}', (simphiPlayer.app.speed || 1).toFixed(2))) || '', 383 + Math.min(textWidth, 750), 212);
    ctxos.fillStyle = statData.textBelowColor || '#fff';
    ctxos.fillText(statData.textBelowStr || '', 1355, 595);
    ctxos.fillStyle = '#fff';
    ctxos.textAlign = 'center';
    ctxos.font = '86px Custom,Noto Sans SC';
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 1.12) * 2.0);
    ctxos.fillText(simphiPlayer.stat.scoreStr || '', 1075, 569);
    ctxos.font = '26px Custom,Noto Sans SC';
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 0.87) * 2.5);
    ctxos.fillText(String(simphiPlayer.stat.perfect || ''), 891, 650);
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 1.07) * 2.5);
    ctxos.fillText(String(simphiPlayer.stat.good || ''), 1043, 650);
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 1.27) * 2.5);
    ctxos.fillText(String(simphiPlayer.stat.noteRank ? simphiPlayer.stat.noteRank[6] : ''), 1196, 650);
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 1.47) * 2.5);
    ctxos.fillText(String(simphiPlayer.stat.noteRank ? simphiPlayer.stat.noteRank[2] : ''), 1349, 650);
    ctxos.font = '22px Custom,Noto Sans SC';
    const transition = clip((simphiPlayer.pressTime > 0 ? simphiPlayer.animationTimer.end.second - simphiPlayer.pressTime : 0.2 - simphiPlayer.animationTimer.end.second - simphiPlayer.pressTime) * 5.0);
    ctxos.globalAlpha = 0.8 * clip((simphiPlayer.animationTimer.end.second - 0.87) * 2.5) * transition;
    ctxos.fillStyle = '#696';
    ctxos.fill(new Path2D('M841,718s-10,0-10,10v80s0,10,10,10h100s10,0,10-10v-80s0-10-10-10h-40l-10-20-10,20h-40z'));
    ctxos.globalAlpha = 0.8 * clip((simphiPlayer.animationTimer.end.second - 1.07) * 2.5) * transition;
    ctxos.fillStyle = '#669';
    ctxos.fill(new Path2D('M993,718s-10,0-10,10v80s0,10,10,10h100s10,0,10-10v-80s0-10-10-10h-40l-10-20-10,20h-40z'));
    ctxos.fillStyle = '#fff';
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 0.97) * 2.5) * transition;
    ctxos.fillText(`Early: ${simphiPlayer.stat.noteRank ? simphiPlayer.stat.noteRank[5] : ''}`, 891, 759);
    ctxos.fillText(`Late: ${simphiPlayer.stat.noteRank ? simphiPlayer.stat.noteRank[1] : ''}`, 891, 792);
    ctxos.globalAlpha = clip((simphiPlayer.animationTimer.end.second - 1.17) * 2.5) * transition;
    ctxos.fillText(`Early: ${simphiPlayer.stat.noteRank ? simphiPlayer.stat.noteRank[7] : ''}`, 1043, 759);
    ctxos.fillText(`Late: ${simphiPlayer.stat.noteRank ? simphiPlayer.stat.noteRank[3] : ''}`, 1043, 792);
    ctxos.resetTransform();
    ctxos.globalCompositeOperation = 'destination-over';
    ctxos.globalAlpha = 1;
    ctxos.fillStyle = '#000';
    const bgImage = simphiPlayer.app.bgImage || simphiPlayer.res['NoImageWhite'];
    try { ctxos.drawImage(bgImage, ...adjustSize(bgImage, canvasos, 1)); } catch (e) { ctxos.fillRect(0,0,canvasos.width, canvasos.height); }
    ctxos.fillRect(0, 0, canvasos.width, canvasos.height);
    ctxos.globalCompositeOperation = 'source-over';
}

// Hook animationTimer.end to draw result when active
// expose atDraw3 so renderer can use it
simphiPlayer.atDraw3 = atDraw3;
