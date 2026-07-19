<script>
import shared from "@utils/js/shared";
import { partyMgr } from "@utils/js/partyMgr";
import { PhiZoneAPI as phizoneApi } from "@community/phizone";
import ploading from "@utils/js/ploading.js";
export default {
    name: "startPage",
    data() {
        return {
            ver: spec.thisVersion,
            verClicked: 0,
            fromIntro: false,
            menuVisible: false,
            // 3D mouse tracking
            mouseX: 0,
            mouseY: 0,
            _targetMX: 0,
            _targetMY: 0,
            _mouseRaf: null,
            hoveredBtn: -1,
        };
    },
    computed: {
        pzResUrlGlobal() {
            "res.phizone.cn";
        },
        loginInfo() {
            return shared.game.ptmain.gameConfig.account.userBasicInfo;
        },
        loginStatus() {
            return !shared.game.ptmain.noAccountMode;
        },
        isPTFun() {
            return (
                [80, 443, 1443, "1443"].includes(location.port) ||
                location.host.endsWith("phi.focalors.ltd")
            );
        },
        isPTApp() {
            return window.spec.isPhiTogetherApp;
        },
        userColor() {
            return shared.game.ptmain.userColor;
        },
        mpMaintainanceStatus() {
            return JSON.parse(import.meta.env.VITE_MP_MAINTAINANCE);
        },
        lastLogin() {
            return shared.game.ptmain.gameConfig.account.userBasicInfo
                ? new Date(
                    shared.game.ptmain.gameConfig.account.userBasicInfo.dateLastLoggedIn
                ).format("Y-m-d H:i:s")
                : "";
        },
        isAprFl() {
            return partyMgr.list.aprfool2024.activate;
        },
        mobile() {
            return !window.spec.isDesktop;
        },
        cardStyle() {
            if (this.mobile) return {};
            const tx = this.mouseX * -8;
            const ty = this.mouseY * -8;
            return {
                transform: `perspective(1000px) translate(${tx}px, ${ty}px)`,
                transition: 'transform 0.08s ease-out',
            };
        },
        cardGlowStyle() {
            if (this.mobile) return {};
            const x = 50 + this.mouseX * 35;
            const y = 50 + this.mouseY * 35;
            return {
                background: `radial-gradient(circle at ${x}% ${y}%, rgba(75, 137, 220, 0.2), rgba(138, 85, 199, 0.12), transparent 70%)`,
            };
        },
        bgSphere1() {
            return { transform: `translate(${this.mouseX * -50}px, ${this.mouseY * -50}px)` };
        },
        bgSphere2() {
            return { transform: `translate(${this.mouseX * 40}px, ${this.mouseY * 40}px)` };
        },
        bgSphere3() {
            return { transform: `translate(${this.mouseX * -20}px, ${this.mouseY * -20}px)` };
        },
        leftPanelStyle() {
            if (this.mobile) return {};
            const tx = this.mouseX * 20;
            const ty = this.mouseY * 20;
            return {
                transform: `perspective(1200px) rotateY(20deg) scale(1.2) translateZ(40px) translate(${tx}px, ${ty}px)`,
                transition: 'transform 0.1s ease-out',
                transformOrigin: 'right center',
            };
        },
        rightPanelStyle() {
            if (this.mobile) return {};
            const tx = this.mouseX * 20;
            const ty = this.mouseY * 20;
            return {
                transform: `perspective(1200px) rotateY(-20deg) scale(1.2) translateZ(40px) translate(${tx}px, ${ty}px)`,
                transition: 'transform 0.1s ease-out',
                transformOrigin: 'left center',
            };
        },

    },
    methods: {
        forcedFullscreen() {
            shared.game.requestFullscreen(true);
        },
        toB20() {
            shared.game.ptmain.$router.push({
                path: "/playerB20",
                query: { id: this.loginInfo.id },
            });
        },
        async versionNumber() {
            if (!spec.isPhiTogetherApp && (!this.loginStatus || !this.loginInfo.isPTDeveloper))
                this.to("/aboutpage");
            this.verClicked++;
            if (this.verClicked == 7) {
                const url = await shared.game.msgHandler.prompt(
                    this.$t("startPage.redirectToCustomURL")
                );
                if (url) {
                    window.location.href = url;
                }
                this.verClicked = 0;
            }
        },
        to(page) {
            if (page == "/replayPage") {
                shared.game.msgHandler.warning(this.$t("replayPage.toBeOptimized"));
            }
            this.$router.push(page);
        },
        logIn() {
            this.to("/login");
        },
        async logOut() {
            if (!(await shared.game.msgHandler.confirm(this.$t("startPage.logoutConfirm"))))
                return;
            shared.game.ptmain.gameConfig.account = {
                tokenInfo: null,
                userBasicInfo: null,
                defaultConfigID: null,
            };
            shared.game.ptmain.noAccountMode = true;
            // shared.game.ptmain.refreshUserInfoBar();
            shared.game.msgHandler.success(this.$t("startPage.logoutSuccessfully"));
        },
        checkIfCantPlay() {
            const isCantPlay = !shared.game.ptmain.canplay;
            if (isCantPlay)
                shared.game.msgHandler.sendMessage(
                    this.$t("startPage.antiAddictionIssue"),
                    "error"
                );
            return isCantPlay;
        },
        async singleGame() {
            if (this.checkIfCantPlay()) return;
            shared.game.ptmain.gameMode = "single";
            if (!navigator.onLine) {
                await shared.game.msgHandler.warning(this.$t("startPage.offlineNotice"));
                this.to({ path: "/chartSelect", query: { offline: 1 } });
                return;
            }
            if (shared.game.ptmain.noAccountMode) {
                if (this.loginInfo) {
                    if (
                        await shared.game.msgHandler.confirm(this.$t("startPage.askForRelogin"))
                    ) {
                        if (!this.loginInfo) this.to({ path: "/login" });
                        else this.reLogin();
                        return;
                    }
                } else
                    shared.game.msgHandler.sendMessage(
                        this.$t("startPage.askForLogin"),
                        "error"
                    );
            }
            this.to({ path: "/chartSelect" });
        },
        async multiGame() {
            if (this.checkIfCantPlay()) return;
            if (!shared.game.ptmain.gameConfig.mpServerURL) {
                shared.game.msgHandler.failure(this.$t("startPage.mpMaintainanceNotice"));
                return;
            }
            if (!navigator.onLine) {
                shared.game.msgHandler.failure(this.$t("startPage.offlineMPNotice"));
                return;
            }
            if (shared.game.ptmain.noAccountMode) {
                shared.game.msgHandler.failure(this.$t("startPage.noaccountmodeMPNotice"));
                if (!this.loginInfo) this.to({ path: "/login" });
                else this.reLogin();
                return;
            }
            try {
                ploading.l(this.$t("startPage.loadingUserConfig"), "multiGetJudg");
                const current = await phizoneApi.getSpecConfiguration(
                    shared.game.ptmain.gameConfig.account.tokenInfo.access_token,
                    shared.game.ptmain.gameConfig.account.defaultConfigID
                );
                ploading.r("multiGetJudg");
                if (current.goodJudgment != 160 || current.perfectJudgment != 80) {
                    shared.game.msgHandler.failure(this.$t("startPage.judgeRangeMPNotice"));
                    return;
                }
                if (shared.game.ptmain.gameConfig.fullScreenJudge) {
                    shared.game.msgHandler.failure(
                        this.$t("startPage.fullscreenjudgeMPNotice")
                    );
                    return;
                }
            } catch {
                ploading.r("multiGetJudg");
                shared.game.msgHandler.sendMessage(
                    this.$t("startPage.errLoadingUserConfig"),
                    "error"
                );
                return;
            }
            if (localStorage.lastMultiInfo) {
                if (await shared.game.msgHandler.confirm(this.$t("startPage.restoreMP"))) {
                    const lastMultiInfo = JSON.parse(localStorage.lastMultiInfo);
                    try {
                        ploading.l(this.$t("startPage.recoverMP"), "recoverMulti");
                        const resp = await fetch(
                            `${shared.game.ptmain.gameConfig.mpServerURL}/api/multi/requestRoom/${lastMultiInfo.room.id}?v=${spec.thisVersion}`
                        );
                        const result = await resp.json();
                        if (result.code === -2) {
                            ploading.r("recoverMulti");
                            await shared.game.msgHandler.warning(
                                this.$t("startPage.recoverMPFailed")
                            );
                            localStorage.removeItem("lastMultiInfo");
                            return;
                        } else {
                            shared.game.multiInstance.recoverMulti(lastMultiInfo);
                        }
                    } catch {
                        ploading.r("recoverMulti");
                        shared.game.msgHandler.warning(
                            this.$t("startPage.recoverMPNetProblem")
                        );
                    }
                    return;
                } else {
                    localStorage.removeItem("lastMultiInfo");
                }
            }
            this.to({ path: "/multiIndex" });
        },
        reLogin() {
            shared.game.ptmain.pzRefreshLogin();
        },

        // ── 3D Mouse Tracking ──
        onMouseMove(e) {
            if (this.mobile) return;
            const rect = this.$el.getBoundingClientRect();
            this._targetMX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            this._targetMY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
            if (!this._mouseRaf) {
                this._mouseRaf = requestAnimationFrame(this._tickMouse);
            }
        },
        onMouseLeave() {
            this._targetMX = 0;
            this._targetMY = 0;
            if (!this._mouseRaf) {
                this._mouseRaf = requestAnimationFrame(this._tickMouse);
            }
        },
        _tickMouse() {
            this.mouseX += (this._targetMX - this.mouseX) * 0.08;
            this.mouseY += (this._targetMY - this.mouseY) * 0.08;
            if (
                Math.abs(this.mouseX - this._targetMX) > 0.001 ||
                Math.abs(this.mouseY - this._targetMY) > 0.001
            ) {
                this._mouseRaf = requestAnimationFrame(this._tickMouse);
            } else {
                this.mouseX = this._targetMX;
                this.mouseY = this._targetMY;
                this._mouseRaf = null;
            }
        },

        // ── Entrance Animation ──
        animateMenuEntrance() {
            this.menuVisible = true;
            const buttons = document.querySelectorAll('#startPage .startBtn');
            buttons.forEach((btn, i) => {
                btn.style.opacity = '0';
                btn.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    btn.style.opacity = '1';
                    btn.style.transform = 'translateY(0)';
                }, i * 150 + 200);
            });
        },
        async activated() {
            if (this.fromIntro) {
                this.animateMenuEntrance();
            }
        },
        async mounted() {
            if (this.$route.query.fromIntro) {
                this.fromIntro = true;
                this.animateMenuEntrance();
            }
        },
        beforeUnmount() {
            if (this._mouseRaf) {
                cancelAnimationFrame(this._mouseRaf);
                this._mouseRaf = null;
            }
        },
    },
};
</script>

<template>
    <div id="startPage" class="routerRealPage" @mousemove="onMouseMove" @mouseleave="onMouseLeave" :style="{ perspective: mobile ? 'none' : '1000px' }">
        <!-- 3D Background Spheres (absolutely positioned, no layout impact) -->
        <div class="pt-bg-sphere pt-bg-s1" :style="bgSphere1"></div>
        <div class="pt-bg-sphere pt-bg-s2" :style="bgSphere2"></div>
        <div class="pt-bg-sphere pt-bg-s3" :style="bgSphere3"></div>
        <div id="flexCol" class="pt-panel-gap" :style="leftPanelStyle">
            <div class="startPageRow">
                <div id="playerCard" class="blur" :style="cardStyle">
                    <!-- Dynamic spotlight that follows mouse -->
                    <div class="pt-card-glow" :style="cardGlowStyle"></div>
                    <div v-if="loginInfo" style="margin-bottom: 20px">
                        <div id="playerCardActions">
                            <span @click="toB20()" v-if="loginStatus">
                                {{ $t("startPage.viewB20") }}
                            </span>
                            <span @click="reLogin()" v-else>{{ $t("startPage.retryLogin") }}</span>
                            &nbsp;&nbsp;
                            <span @click="logIn()">{{ $t("startPage.switch") }}</span>
                            &nbsp;&nbsp;
                            <span @click="logOut()">{{ $t("startPage.logout") }}</span>
                        </div>
                        <div id="playerCardUsrAvatarParent" style="padding-top: 10px">
                            <div v-if="loginInfo && loginInfo.avatar" id="playerCardUsrAvatar"
                                :style="{ 'border-color': userColor }">
                                <img :src="loginInfo.avatar.replace('res.phi.zone', pzResUrlGlobal)" />
                            </div>
                        </div>
                        <div id="playerCardUsrName">{{ loginInfo.userName }}&nbsp;&nbsp;</div>
                        <br />
                        <div id="playerCardUsrInfo">
                            PhiZone
                            <b style="color: green">{{ loginInfo.role.toUpperCase() }}</b>
                            <div v-if="loginInfo.isPTDeveloper">
                                PhiTogether
                                <b style="color: DeepSkyBlue">DEVELOPER</b>
                            </div>
                            <div v-if="!loginStatus">
                                <b style="color: DarkOrange">OFFLINE</b>
                            </div>
                            <br v-else />
                            <br v-if="!loginInfo.isPTDeveloper" />
                            <br />
                            ID
                            <b>{{ loginInfo.id }}</b>
                            &nbsp; EXP
                            <b>{{ loginInfo.experience.toFixed(0) }}</b>
                            <br />
                            RKS
                            <b>{{ loginInfo.rks.toFixed(3) }}</b>
                            <br />
                            <br />
                            LAST LOGIN
                            <br />
                            <b>{{ lastLogin }}</b>
                        </div>
                        <br />
                    </div>
                    <div v-else @click="logIn()" style="margin-bottom: 20px">
                        <div id="playerCardActions">
                            <span @click="logIn()">{{ $t("startPage.login") }}</span>
                            &nbsp;&nbsp;
                        </div>
                        <div id="playerCardUsrAvatarParent">
                            <div id="playerCardUsrAvatar" :style="{ 'border-color': userColor }">
                                <img />
                            </div>
                        </div>
                        <div id="playerCardUsrName">
                            {{ $t("startPage.unLogined") }}&nbsp;&nbsp;
                        </div>
                        <br />
                        <div id="playerCardUsrInfo">
                            PhiZone
                            <b style="color: green">GUEST</b>
                            <br />
                            <br />
                            <br />
                            ID
                            <b>--</b>
                            &nbsp; EXP
                            <b>---</b>
                            <br />
                            RKS
                            <b>--.---</b>
                            <br />
                            <br />
                            LAST LOGIN
                            <br />
                            <b>----.--.-- --:--:--</b>
                        </div>
                        <br />
                    </div>
                </div>
            </div>
        </div>
        <br />
        <div id="flexCol2" style="margin-top: -14vh" :style="rightPanelStyle">
            <div class="startPageRow">
                <br />
                <input class="blur startBtn btn-smooth pt-btn" type="button" :value="$t('startPage.singleGame')"
                    @click="singleGame()" :style="{ transitionDelay: fromIntro ? '200ms' : '0ms' }" />
            </div>
            <div class="startPageRow">
                <input class="blur startBtn btn-smooth pt-btn" :class="{ forbidden: mpMaintainanceStatus }" type="button"
                    :value="isAprFl ? '上车' : $t('startPage.multiGame')" @click="multiGame()" :style="{ transitionDelay: fromIntro ? '350ms' : '0ms' }" />
            </div>
            <div class="startPageRow startPageRow2">
                <input class="blur startBtn btn-smooth pt-btn" type="button" :value="$t('startPage.caches')"
                    @click="to('/cacheManage')" :style="{ transitionDelay: fromIntro ? '500ms' : '0ms' }" />
                <input class="blur startBtn btn-smooth pt-btn" type="button" :value="$t('startPage.replay')"
                    @click="to('/replayPage')" :style="{ transitionDelay: fromIntro ? '650ms' : '0ms' }" />
            </div>
            <br />
            <div class="startPageRow">
                <input class="blur startBtn btn-smooth pt-btn" type="button" :value="$t('startPage.gameSettings')"
                    @click="to('/settings')" :style="{ transitionDelay: fromIntro ? '800ms' : '0ms' }" />
            </div>
            <br />
        </div>
        <footer style="z-index: 1688">
            <!-- <div style="padding-bottom: 5px;">语言 / Language: <select v-model="localeValue" @change="switchLocale">
                <option value="zh_CN">简体中文</option>
                <option value="zh_TW">正體中文</option>
                <option value="en_US">English</option>
            </select></div> -->
            <a @click="to('/aboutPage')">
                <b>{{ $t("startPage.about") }}</b>
            </a>
            &nbsp;|&nbsp;
            <a href="https://status.phitogether.focalors.ltd" target="_blank">
                <b>{{ $t("startPage.serviceStatus") }}</b>
            </a>
            &nbsp;|&nbsp;
            <a @click="to('/changelogs')">
                <b>{{ $t("startPage.updateLogs") }}</b>
            </a>
            &nbsp;|&nbsp;
            <a @click="to('/settings')"><b>语言 / Language</b></a>
            <span v-if="!isPTApp">
                &nbsp;|&nbsp;
                <a @click="forcedFullscreen">
                    <b>{{ $t("startPage.forcedFullscreen") }}</b>
                </a>
            </span>
            <br />
            <span @click="versionNumber()">
                PhiTogether {{ ver }} - &copy; 2023-2024 Team PhiTogether
            </span>
        </footer>
    </div>
</template>

<style>
div#playerCardActions {
    text-align: right;
    padding-top: 0.5em;
    margin-bottom: -1.6em;
    font-size: 0.9em;
    margin-right: 1.1em;
    color: midnightblue;
}

/*
div#versionInfo {
    font-size: 1em;
    color: rgb(100, 100, 100);
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translate(-50%, 0);
    width: 100%;
}
*/

#startPage {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    align-content: center;
    position: fixed;
    top: 7.5vh;
}

.startPageRow {
    width: 100%;
    left: 5%;
    right: 5%;
}

.startPageRow input[type="button"] {
    font-size: 1.6em;
    margin: 6px;
    width: 240px;
    max-width: 100%;
    -webkit-appearance: none;
    appearance: none;
    box-shadow: 0px 0px 20px #00000033;
}

.startPageRow2 {
    display: inline-flex;
}

.startPageRow2 input[type="button"] {
    width: 50%;
}

.startBtn {
    color: white;
}

.startBtn.forbidden {
    background-color: #6e6e6e70;
}

#playerCard {
    text-align: center;
    z-index: 1;
    width: 300px;
    max-width: 100%;
    height: auto;
    margin: auto;
    background-color: #ffffff3a;
    border-radius: 20px;
    box-shadow:
        #002a8328 0px 0px 20px 5px,
        inset #002a8328 0px 0px 50px 8px;
}

#playerCardUsrName {
    text-align: center;
    margin-left: 10px;
    color: rgb(45, 86, 149);
    font-size: 1.5em;
    display: -webkit-inline-box;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-line-clamp: 1;
}

#playerCardUsrAvatarParent {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    margin-top: 20px;
}

#playerCardUsrAvatar {
    height: 64px;
    width: 64px;
    border-radius: 100%;
    border: 3px solid white;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}

#playerCardUsrAvatar img {
    height: 64px;
}

#playerCardUsrInfo {
    color: rgba(0, 0, 0, 0.35);
    font-size: 1em;
    line-height: 0.85em;
}

#flexCol {
    margin-top: -10vh;
    margin-left: 1vw;
    margin-right: 5vw;
}

@media screen and (orientation: landscape) {
    #flexCol {
        max-width: 45vw;
    }

    #flexCol2 {
        max-width: 35vw;
    }

    /* #flexCol2 {
        margin-top: -75px;
    } */
}

@media screen and (min-width: 752px) {
    #flexCol {
        max-width: 45vw;
    }

    #flexCol2 {
        max-width: 35vw;
    }

    /* #flexCol2 {
        margin-top: -75px;
    } */
}

@media screen and (max-width: 751px) {
    #startPage {
        margin-top: 8vh;
    }
}

#startPage {
    margin-top: 10vh;
}

footer {
    line-height: 1.25rem;
}

/* ══════════════════════════════════════════════
   ADD-ON: 3D Background Spheres
   ══════════════════════════════════════════════ */
.pt-bg-sphere {
    position: fixed;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
    will-change: transform;
}

.pt-bg-s1 {
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(75, 137, 220, 0.12), transparent 70%);
    top: -200px;
    right: -200px;
}

.pt-bg-s2 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(138, 85, 199, 0.10), transparent 70%);
    bottom: -150px;
    left: -150px;
}

.pt-bg-s3 {
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(194, 123, 198, 0.08), transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

/* ══════════════════════════════════════════════
   ADD-ON: Button Enhancements
   ══════════════════════════════════════════════ */
.pt-btn {
    transition: opacity 0.5s ease-out, transform 0.5s ease-out, box-shadow 0.3s ease-out, background-color 0.3s ease-out !important;
    position: relative;
    z-index: 1;
}

.pt-btn:not(.forbidden):hover {
    box-shadow:
        0 0 20px rgba(75, 137, 220, 0.2),
        0 0 40px rgba(138, 85, 199, 0.1),
        0px 0px 20px #00000033 !important;
    background-color: rgba(255, 255, 255, 0.12) !important;
    transform: translateY(-2px) scale(1.02);
}

.pt-btn:not(.forbidden):active {
    transform: translateY(0px) scale(0.98);
}

/* ══════════════════════════════════════════════
   ADD-ON: Card Dynamic Glow
   ══════════════════════════════════════════════ */
.pt-card-glow {
    position: absolute;
    inset: 0;
    border-radius: 20px;
    pointer-events: none;
    z-index: 0;
    transition: background 0.15s ease-out;
}

/* ══════════════════════════════════════════════
   ADD-ON: Increase Sphere Blur for Softness
   ══════════════════════════════════════════════ */
.pt-bg-s1 {
    filter: blur(100px);
}

.pt-bg-s2 {
    filter: blur(90px);
}

.pt-bg-s3 {
    filter: blur(70px);
}

/* ══════════════════════════════════════════════
   ADD-ON: Panel Spacing
   ══════════════════════════════════════════════ */
.pt-panel-gap {
    margin-right: 4vw !important;
}
</style>
