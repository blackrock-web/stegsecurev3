import React, { useState, useRef } from 'react';
import {
  ScanSearch,
  Upload,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { SecurityReport } from '../types';
import { fileToImageData, evaluateSecurity } from '../lib/stegEngine';

export const SteganalysisScanner: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [activeBitPlane, setActiveBitPlane] = useState<number>(0);
  const [activeChannel, setActiveChannel] = useState<'r' | 'g' | 'b'>('r');
  const [bitPlaneUrl, setBitPlaneUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    const { imageData, dataUrl } = await fileToImageData(file);
    setPreviewUrl(dataUrl);
    setIsAnalyzing(true);

    setTimeout(() => {
      const secReport = evaluateSecurity(null, imageData);
      setReport(secReport);
      renderBitPlane(imageData, activeChannel, activeBitPlane);
      setIsAnalyzing(false);
    }, 400);
  };

  const renderBitPlane = (
    imageData: ImageData,
    channel: 'r' | 'g' | 'b',
    bitIndex: number
  ) => {
    const { width, height, data } = imageData;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(width, height);
    const d = imgData.data;

    const channelOffset = channel === 'r' ? 0 : channel === 'g' ? 1 : 2;

    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * 4 + channelOffset;
      const bit = (data[srcIdx] >> bitIndex) & 1;
      const val = bit === 1 ? 255 : 0;
      const dstIdx = i * 4;
      d[dstIdx] = val;
      d[dstIdx + 1] = val;
      d[dstIdx + 2] = val;
      d[dstIdx + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    setBitPlaneUrl(canvas.toDataURL('image/png'));
  };

  const handleBitPlaneChange = async (ch: 'r' | 'g' | 'b', bit: number) => {
    setActiveChannel(ch);
    setActiveBitPlane(bit);
    if (selectedFile) {
      const { imageData } = await fileToImageData(selectedFile);
      renderBitPlane(imageData, ch, bit);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <ScanSearch className="w-5 h-5 text-indigo-600" />
          <span>Steganalysis Deep Scanner & Bit-Plane Inspector</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Perform forensic steganalysis tests (RS analysis, Chi-Square PoV distributions, Sample Pair Analysis) and inspect raw bit-planes to detect concealed payloads.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Select Image for Forensic Analysis
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/60"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                accept="image/png,image/bmp,image/jpeg"
                className="hidden"
              />
              {previewUrl && previewUrl.trim().length > 0 ? (
                <div className="flex flex-col items-center">
                  <img
                    src={previewUrl}
                    alt="Scan target"
                    className="max-h-48 rounded-lg object-contain shadow-xs border border-slate-200"
                  />
                  <p className="text-xs text-slate-700 mt-2 font-mono truncate max-w-xs">
                    {selectedFile?.name}
                  </p>
                  <span className="text-xs text-indigo-600 font-medium mt-1">Click to replace</span>
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-700 font-medium">Upload any image file</p>
                  <p className="text-xs text-slate-500 mt-0.5">Supports PNG, BMP, JPG</p>
                </div>
              )}
            </div>
          </div>

          {/* Steganalysis Verdict Summary */}
          {report && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Steganalysis Summary
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    report.compositeRiskScore < 25
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : report.compositeRiskScore < 60
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {report.verdict}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">RS Embedding Est.</span>
                  <span className="text-slate-800 font-bold">{report.rsAnalysis.estimatedEmbeddingRate}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">Chi-Square (χ²)</span>
                  <span className="text-slate-800 font-bold">p={report.chiSquare.pValue}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">SPA Bitrate</span>
                  <span className="text-slate-800 font-bold">{report.samplePairAnalysis.estimatedBitRate}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">CNN Suspicion</span>
                  <span className="text-slate-800 font-bold">{(report.surrogateCnnScore * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Bit-Plane Slicer (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>Bit-Plane Forensic Visualizer</span>
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Plane 0 = Least Significant Bit (LSB). Random noise indicates high entropy stego embedding.
                </span>
              </div>

              {/* Channel Switcher */}
              <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                {(['r', 'g', 'b'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => handleBitPlaneChange(ch, activeBitPlane)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase transition-colors ${
                      activeChannel === ch
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Bit Selector 0 to 7 */}
            <div className="flex items-center justify-between space-x-1 overflow-x-auto pb-1">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((bit) => (
                <button
                  key={bit}
                  onClick={() => handleBitPlaneChange(activeChannel, bit)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-mono transition-all ${
                    activeBitPlane === bit
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  Bit {bit} {bit === 0 ? '(LSB)' : bit === 7 ? '(MSB)' : ''}
                </button>
              ))}
            </div>

            {/* Bit-Plane Visualizer Canvas */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center min-h-[300px]">
              {bitPlaneUrl && bitPlaneUrl.trim().length > 0 ? (
                <img
                  src={bitPlaneUrl}
                  alt={`Bit plane ${activeBitPlane}`}
                  className="max-h-[360px] object-contain rounded shadow-xs border border-slate-200"
                />
              ) : (
                <div className="text-center text-slate-400 text-xs">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p>Upload an image to visualize its raw binary bit-planes.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
