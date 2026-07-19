export function fillTextNode(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number
) {
    ctx.font = `${size}px Custom`;
    ctx.fillText(text, x, y);
}
