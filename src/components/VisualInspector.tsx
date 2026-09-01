import React, { useState } from 'react';
import {
  Layers,
  Flame,
  Eye,
  Sliders,
  Maximize2,
  ZoomIn,
  Activity,
  Sparkles,
} from 'lucide-react';
import { VisualArtifacts } from '../types';

interface VisualInspectorProps {
  visuals: VisualArtifacts;
  dimensions?: { width: number; height: number };
}

export const VisualInspector: React.FC<VisualInspectorProps> = ({ visuals, dimensions }) => {
  const [activeLayer, setActiveLayer] = useState<'stego' | 'cover' | 'cost' | 'zones' | 'residual'>('stego');
  const [zoom, setZoom] = useState<number>(1);
  const [showSideBySide, setShowSideBySide] = useState<boolean>(false);

  const layers = [
    { id: 'stego', label: 'Stego Output', icon: Eye, desc: 'Watermark-free perceptual identical image' },
    { id: 'cover', label: 'Original Cover', icon: Eye, desc: 'Original unmodified source pixels' },
    { id: 'cost', label: 'CNN Cost Map', icon: Flame, desc: 'Texture & edge complexity heatmap' },
    { id: 'zones', label: 'Adaptive Zones (A/B/C)', icon: Layers, desc: 'Zone A (EMD Green), Zone B (OPAP Indigo), Zone C (Amber)' },
    { id: 'residual', label: 'Amplified Residuals (x25)', icon: Activity, desc: 'Pixel-level modifications amplified for analysis' },
  ];

  const getCurrentImageUrl = (): string | null => {
    let url: string | undefined;
    switch (activeLayer) {
      case 'cover':
        url = visuals.coverDataUrl;
        break;
      case 'cost':
        url = visuals.costMapDataUrl;
        break;
      case 'zones':
        url = visuals.zoneMapDataUrl;
        break;
      case 'residual':
        url = visuals.residualDataUrl;
        break;
      case 'stego':
      default:
        url = visuals.stegoDataUrl;
        break;
    }
    return url && url.trim().length > 0 ? url : null;
  };

  const currentImageUrl = getCurrentImageUrl();
  const coverUrl = visuals.coverDataUrl && visuals.coverDataUrl.trim().length > 0 ? visuals.coverDataUrl : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header with Layer Switcher */}
      <div className="bg-slate-50 p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {layers.map((layer) => {
            const Icon = layer.icon;
            const isSelected = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id as any)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{layer.label}</span>
              </button>
            );
          })}
        </div>

        {/* View Controls */}
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setShowSideBySide(!showSideBySide)}
            className={`px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
              showSideBySide
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {showSideBySide ? 'Single View' : 'Side-by-Side Split'}
          </button>

          <div className="flex items-center space-x-1 bg-white rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="px-2 py-1 hover:bg-slate-100 rounded text-slate-700 font-bold"
              title="Zoom out"
            >
              -
            </button>
            <span className="px-1 font-mono text-slate-600">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.25))}
              className="px-2 py-1 hover:bg-slate-100 rounded text-slate-700 font-bold"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Layer Description Banner */}
      <div className="bg-slate-50/70 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-800">Active Map:</span>
          <span>{layers.find((l) => l.id === activeLayer)?.desc}</span>
        </div>
        {dimensions && (
          <div className="font-mono text-slate-600">
            {dimensions.width} × {dimensions.height} px
          </div>
        )}
      </div>

      {/* Main Canvas / Image Area */}
      <div className="p-4 bg-slate-100/50 flex items-center justify-center min-h-[380px] overflow-auto">
        {showSideBySide ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <div className="flex flex-col items-center">
              <div className="text-xs font-medium text-slate-600 mb-1.5 flex items-center space-x-1">
                <span>Original Cover</span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs min-h-[200px] flex items-center justify-center p-2">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Cover"
                    className="max-h-[340px] object-contain rounded"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                  />
                ) : (
                  <span className="text-xs text-slate-400">Cover image not available</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-xs font-medium text-slate-600 mb-1.5 flex items-center space-x-1">
                <span>Stego / Active Map</span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs min-h-[200px] flex items-center justify-center p-2">
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt="Stego layer"
                    className="max-h-[340px] object-contain rounded"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                  />
                ) : (
                  <span className="text-xs text-slate-400">Layer not available</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs min-h-[260px] flex items-center justify-center p-2">
              {currentImageUrl ? (
                <img
                  src={currentImageUrl}
                  alt={activeLayer}
                  className="max-h-[420px] max-w-full object-contain rounded"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                />
              ) : (
                <span className="text-xs text-slate-400">Visual layer not available</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Color Legend (for Cost and Zones) */}
      {activeLayer === 'zones' && (
        <div className="bg-white p-3 border-t border-slate-200 flex items-center justify-around text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block shadow-xs"></span>
            <span className="text-slate-700 font-medium">Zone A (High Texture / EMD n=2,3)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded bg-indigo-500 inline-block shadow-xs"></span>
            <span className="text-slate-700 font-medium">Zone B (Medium / OPAP k_b)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block shadow-xs"></span>
            <span className="text-slate-700 font-medium">Zone C (Smooth / OPAP k_c)</span>
          </div>
        </div>
      )}

      {activeLayer === 'cost' && (
        <div className="bg-white p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700">
          <span>Low Distortion Risk (Edges / Texture)</span>
          <div className="w-48 h-3 rounded-full bg-gradient-to-r from-purple-900 via-red-600 to-yellow-400 shadow-inner"></div>
          <span>High Distortion Risk (Smooth Regions)</span>
        </div>
      )}
    </div>
  );
};
