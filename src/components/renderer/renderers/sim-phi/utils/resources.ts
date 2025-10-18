import { simphiPlayer } from "../playerMain";
import { msgHandler } from "@utils/js/msgHandler";
import shared from "@utils/js/shared";
import { createCanvas } from "../utils/canvas";
import { imgSplit2 } from "../assetsProcessor/imgProcessor";

// 直接使用本地资源路径，避免 CORS 问题
const localResourcePath = '/src/respack/shared/';

export async function loadResultResources() {
    try {
        msgHandler.sendMessage("加载结算界面资源中...");
        
        // 从本地加载结算界面所需的资源
        const requiredResources = [
            { name: 'LevelOver1', file: 'LevelOver1.png' },
            { name: 'LevelOver2', file: 'LevelOver3.png' },
            { name: 'LevelOver3', file: 'LevelOver3.png' },
            { name: 'LevelOver4', file: 'LevelOver4.png' },
            { name: 'LevelOver5', file: 'LevelOver5.png' },
            { name: 'Rank', file: 'Rank.png' }
        ];
        
        const loadPromises = requiredResources.map(async resource => {
            try {
                const xhr = new XMLHttpRequest();
                const source = localResourcePath + resource.file;
                xhr.open("get", source, true);
                xhr.responseType = "arraybuffer";
                
                const loadPromise = new Promise((resolve, reject) => {
                    xhr.onload = async () => {
                        if (xhr.status === 200 && xhr.response) {
                            try {
                                const blob = new Blob([xhr.response]);
                                simphiPlayer.res[resource.name] = await createImageBitmap(blob);
                                
                                // 特殊处理 Rank 资源
                                if (resource.name === 'Rank') {
                                    // 直接存储原始Rank图片，不进行分割
                                    simphiPlayer.res.Ranks = await imgSplit2(simphiPlayer.res.Rank, rankWidth, simphiPlayer.res.Rank.height);
                                }
                                resolve();
                            } catch (e) {
                                console.error(`Error processing ${resource.name}:`, e);
                                reject(e);
                            }
                        } else {
                            reject(new Error(`Failed to load ${resource.name}: ${xhr.status}`));
                        }
                    };
                    xhr.onerror = () => reject(new Error(`Network error loading ${resource.name}`));
                });
                
                xhr.send();
                return loadPromise;
            } catch (e) {
                console.error(`Failed to load resource: ${resource.name}`, e);
                // 创建一个空白图像作为替代
                if (!simphiPlayer.res[resource.name]) {
                    const canvas = createCanvas(100, 100);
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#000';
                        ctx.fillRect(0, 0, 100, 100);
                        simphiPlayer.res[resource.name] = await createImageBitmap(canvas);
                    }
                }
            }
        });
        
        await Promise.all(loadPromises);
        console.log("结算界面资源加载完成");
    } catch (e) {
        console.error("加载结算界面资源失败", e);
        // 确保即使加载失败，也不会导致整个应用崩溃
    }
}

