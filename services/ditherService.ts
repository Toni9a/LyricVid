
export class DitherService {
  private static bayerMatrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  public static applyDitherToCanvas(canvas: HTMLCanvasElement, steps: number = 4) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const n = 4;
    const divisor = 16;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const threshold = (this.bayerMatrix[y % n][x % n] / divisor) * 255;

        for (let c = 0; c < 3; c++) {
          const val = data[i + c];
          const scaled = (val / 255) * (steps - 1);
          const fraction = scaled - Math.floor(scaled);
          const normThreshold = threshold / 255;
          
          data[i + c] = (fraction > normThreshold) 
            ? Math.min(255, Math.ceil(scaled) * (255 / (steps - 1))) 
            : Math.floor(scaled) * (255 / (steps - 1));
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
}
