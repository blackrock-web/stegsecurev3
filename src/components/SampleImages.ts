export interface SampleCover {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  description: string;
  generate: () => Promise<File>;
}

export function generateCanvasPattern(
  width: number,
  height: number,
  type: 'mandrill_texture' | 'smooth_gradient' | 'geometric_edges' | 'noise_complex'
): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    if (type === 'smooth_gradient') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.5, '#475569');
      grad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Subtle light arcs
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.5, width * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'geometric_edges') {
      // High-contrast architectural shapes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      const colors = ['#38bdf8', '#818cf8', '#c084fc', '#f43f5e', '#fbbf24'];
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        const x = (i * 37) % width;
        const y = (i * 53) % height;
        const w = 40 + (i * 13) % 80;
        const h = 40 + (i * 17) % 80;
        ctx.fillRect(x, y, w, h);
      }
    } else if (type === 'mandrill_texture') {
      // High-frequency organic texture simulating BOSSBase
      const imgData = ctx.createImageData(width, height);
      const d = imgData.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const nx = x / width;
          const ny = y / height;
          const sinPattern = Math.sin(nx * 30 + Math.cos(ny * 25) * 8);
          const perlinApprox = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 60;
          const noise = (Math.random() - 0.5) * 40;

          const base = 128 + sinPattern * 40 + perlinApprox + noise;
          d[idx] = Math.min(255, Math.max(0, base + 20)); // R
          d[idx + 1] = Math.min(255, Math.max(0, base - 10)); // G
          d[idx + 2] = Math.min(255, Math.max(0, base + Math.sin(ny * 10) * 30)); // B
          d[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      // Complex noise & grid
      const imgData = ctx.createImageData(width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const val = Math.floor(Math.random() * 256);
        d[i] = val;
        d[i + 1] = (val + 50) % 256;
        d[i + 2] = (val + 100) % 256;
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    canvas.toBlob((blob) => {
      const file = new File([blob!], `${type}_512x512.png`, { type: 'image/png' });
      resolve(file);
    }, 'image/png');
  });
}

export const SAMPLE_COVERS: SampleCover[] = [
  {
    id: 'mandrill_texture',
    name: 'BossBase High-Texture Simulation',
    category: 'High-Frequency Texture',
    width: 512,
    height: 512,
    description: 'High edge variance, ideal for Zone A (EMD) allocation with minimal steganalysis trace',
    generate: () => generateCanvasPattern(512, 512, 'mandrill_texture'),
  },
  {
    id: 'geometric_edges',
    name: 'Sharp Architectural Edges',
    category: 'Mixed Edges & Flats',
    width: 512,
    height: 512,
    description: 'Distinct edge contours separating flat color regions into Zones A, B, and C',
    generate: () => generateCanvasPattern(512, 512, 'geometric_edges'),
  },
  {
    id: 'smooth_gradient',
    name: 'Smooth Grayscale / Sky Gradient',
    category: 'Low-Texture / Sensitive',
    width: 512,
    height: 512,
    description: 'Low-frequency test bench to verify OPAP distortion minimization in sensitive smooth regions',
    generate: () => generateCanvasPattern(512, 512, 'smooth_gradient'),
  },
  {
    id: 'noise_complex',
    name: 'Dense Multi-Spectral Noise',
    category: 'Maximum Capacity Bench',
    width: 512,
    height: 512,
    description: 'High entropy substrate supporting maximum bpp embedding rates',
    generate: () => generateCanvasPattern(512, 512, 'noise_complex'),
  },
];
