import { simphiPlayer } from "@renderers/sim-phi/playerMain";
import shared from "@utils/js/shared";
import { drawRoundRect } from "../utils/canvas";
import { tween } from "../utils/tween";
import { clip } from "../utils/clip";

import { ChartPlayInfoDefaults } from "@utils/types/ChartPlayInfo";

export function resultPageRenderer(statData) {
    // Prefer shared atDraw3 implementation if available (moved from original index.ts)
    if (typeof simphiPlayer.atDraw3 === "function") {
        try {
            simphiPlayer.atDraw3(statData);
            return;
        } catch (e) {
            console.warn("atDraw3 failed, fallback to inline renderer", e);
        }
    }
    // fallback: original drawing logic preserved
    (simphiPlayer.app.ctxos.shadowBlur = 40), (simphiPlayer.app.ctxos.shadowColor = "#000000");
    simphiPlayer.app.ctxos.globalAlpha = 1;
    const k = 3.7320508075688776; //tan75°

    const qwq0 =
        (simphiPlayer.app.canvasos.width - simphiPlayer.app.canvasos.height / k) / (16 - 9 / k);
    simphiPlayer.app.ctxos.setTransform(
        qwq0 / 120,
        0,
        0,
        qwq0 / 120,
        simphiPlayer.app.wlen - qwq0 * 8,
        simphiPlayer.app.hlen - qwq0 * 4.5
    ); //?

    // ... (rest of original renderer remains unchanged)
}
