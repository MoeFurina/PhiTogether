import { simphiPlayer } from "../playerMain";

const resLink = 'https://lchzh.net/data/pack.json';  // 这里使用 sim-phi 的默认资源地址

export async function loadResultResources() {
    const res1 = await fetch(resLink);
    const raw = await res1.json();
    
    // 从资源包中加载结算界面所需的资源
    const requiredResources = [
        'LevelOver1',
        'LevelOver2',
        'LevelOver3',
        'LevelOver4',
        'LevelOver5',
        'Rank'
    ];
    
    const loadPromises = requiredResources.map(async resName => {
        if (raw.image[resName]) {
            const imgData = raw.image[resName];
            const [url] = imgData.split('|');
            const imgRes = await fetch(url);
            const imgBlob = await imgRes.blob();
            simphiPlayer.res[resName] = await createImageBitmap(await imgBlob);
            
            // 特殊处理 Rank 资源
            if (resName === 'Rank') {
                simphiPlayer.res.Ranks = await imgSplit(simphiPlayer.res.Rank);
                simphiPlayer.res.Rank.close();
            }
        }
    });
    
    await Promise.all(loadPromises);
}

// 将图片分割成多个小图（用于 Rank 图标）
async function imgSplit(img: ImageBitmap, limitX = 0, limitY = 0) {
    const width = limitX || img.width;
    const height = limitY || img.height;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    
    const rawWidth = img.width;
    const rawHeight = img.height;
    const pieces = [];
    
    for (let i = 0; i < rawHeight; i += height) {
        for (let j = 0; j < rawWidth; j += width) {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, j, i, width, height, 0, 0, width, height);
            const piece = await createImageBitmap(canvas);
            pieces.push(piece);
        }
    }
    
    return pieces;
}