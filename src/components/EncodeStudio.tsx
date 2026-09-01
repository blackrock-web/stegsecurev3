import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Lock,
  KeyRound,
  Sliders,
  ShieldCheck,
  Zap,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BarChart,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { ZoningConfig, CapacityInfo, EncodeResult } from '../types';
import { checkCapacity, encodeStego } from '../lib/api';
import { SAMPLE_COVERS, SampleCover } from './SampleImages';
import { VisualInspector } from './VisualInspector';

export const EncodeStudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [secretText, setSecretText] = useState<string>(
    'TOP SECRET DISPATCH: Autonomous CNN feature cost mapping with EMD(n=2) and OPAP optimal adjustments active.'
  );
  const [passphrase, setPassphrase] = useState<string>('VaultKey_2026_SecureGCM!');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Zoning configuration
  const [config, setConfig] = useState<ZoningConfig>({
    threshA: 0.35,
    threshB: 0.65,
    gamma: 0.7,
    kbBits: 2,
    kcBits: 3,
    emdN: 2,
    adversarialStrength: 0.0,
  });

  const [capacity, setCapacity] = useState<CapacityInfo | null>(null);
  const [isCalculatingCap, setIsCalculatingCap] = useState<boolean>(false);
  const [isEncoding, setIsEncoding] = useState<boolean>(false);
  const [encodeResult, setEncodeResult] = useState<EncodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto load first sample cover on mount if none selected
  useEffect(() => {
    if (!selectedFile) {
      loadSampleCover(SAMPLE_COVERS[0]);
    }
  }, []);

  // Update capacity whenever image or zoning parameters change
  useEffect(() => {
    let active = true;
    if (selectedFile) {
      setIsCalculatingCap(true);
      setError(null);
      checkCapacity(selectedFile, config)
        .then((cap) => {
          if (active) {
            setCapacity(cap);
            setIsCalculatingCap(false);
          }
        })
        .catch((err) => {
          if (active) {
            console.error('Capacity error:', err);
            setIsCalculatingCap(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [selectedFile, config.threshA, config.threshB, config.gamma, config.emdN, config.kbBits, config.kcBits]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setEncodeResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setEncodeResult(null);
    }
  };

  const loadSampleCover = async (sample: SampleCover) => {
    try {
      const file = await sample.generate();
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setEncodeResult(null);
    } catch (err) {
      console.error('Failed to generate sample cover:', err);
    }
  };

  const handleEncode = async () => {
    if (!selectedFile) {
      setError('Please select or upload a cover image first.');
      return;
    }
    if (!secretText.trim()) {
      setError('Please enter a secret message to hide.');
      return;
    }
    if (!passphrase) {
      setError('Please enter an encryption passphrase.');
      return;
    }

    setIsEncoding(true);
    setError(null);

    try {
      const result = await encodeStego(selectedFile, secretText, passphrase, config);
      setEncodeResult(result);
    } catch (err: any) {
      setError(err.message || 'Encoding failed. Check image capacity or parameters.');
    } finally {
      setIsEncoding(false);
    }
  };

  const handleDownloadStego = () => {
    if (!encodeResult) return;
    const a = document.createElement('a');
    a.href = encodeResult.visuals.stegoDataUrl;
    a.download = `stego_${selectedFile?.name.replace(/\.[^/.]+$/, '') || 'secured'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportJson = () => {
    if (!encodeResult) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(encodeResult, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `stego_experiment_report_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const payloadEstimatedBytes = secretText.length + 38; // payload + crypto headers
  const capacityUsedPct = capacity?.maxBytes
    ? Math.min(100, (payloadEstimatedBytes / capacity.maxBytes) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Lock className="w-5 h-5 text-indigo-600" />
            <span>Steganography Studio: Adaptive EMD-OPAP Embedding</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Conceals AES-256-GCM ciphertexts inside high-texture regions via CNN cost ranking and minimum-distortion EMD+OPAP.
          </p>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex items-center space-x-2 overflow-x-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">Sample Covers:</span>
          {SAMPLE_COVERS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => loadSampleCover(sample)}
              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 rounded-lg whitespace-nowrap transition-colors"
            >
              {sample.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Form Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Upload & Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Cover Image Upload Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span>1. Cover Image (Lossless PNG / BMP)</span>
              </label>
              {selectedFile && (
                <span className="text-xs font-mono text-emerald-700 font-semibold">
                  {capacity?.width} × {capacity?.height} px
                </span>
              )}
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/60 relative group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/bmp"
                className="hidden"
              />
              {previewUrl && previewUrl.trim().length > 0 ? (
                <div className="flex flex-col items-center">
                  <img
                    src={previewUrl}
                    alt="Cover preview"
                    className="max-h-40 rounded-lg object-contain shadow-xs border border-slate-200"
                  />
                  <p className="text-xs text-slate-600 mt-2 font-mono truncate max-w-xs">
                    {selectedFile?.name} ({(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 0)} KB)
                  </p>
                  <span className="text-xs text-indigo-600 group-hover:underline mt-1 font-medium">
                    Click or drop to replace
                  </span>
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center">
                  <Upload className="w-8 h-8 text-slate-400 mb-2 group-hover:text-indigo-600 transition-colors" />
                  <p className="text-xs text-slate-700 font-medium">Drag & drop PNG cover image here</p>
                  <p className="text-xs text-slate-500 mt-0.5">or click to browse filesystem</p>
                </div>
              )}
            </div>
          </div>

          {/* Secret Message & Passphrase */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>2. Secret Payload</span>
                </label>
                <span className="text-xs text-slate-500 font-mono">
                  {secretText.length} chars (~{payloadEstimatedBytes}B)
                </span>
              </div>
              <textarea
                value={secretText}
                onChange={(e) => setSecretText(e.target.value)}
                rows={3}
                placeholder="Enter private message, credentials, or plaintext to encrypt & conceal..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>3. AES-256-GCM Passphrase</span>
                </label>
                <span className="text-xs text-emerald-700 font-mono">PBKDF2 10k iter</span>
              </div>
              <input
                type="text"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Secret key for authenticated encryption..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Adaptive Zoning & Hyperparameters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span>4. Zoning & Cost Parameters</span>
              </span>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {showAdvanced ? 'Hide Advanced' : 'Configure Sliders'}
              </button>
            </div>

            {/* EMD Group Size Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfig({ ...config, emdN: 2 })}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  config.emdN === 2
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                EMD n=2 (Base-5)
                <span className="block text-[10px] opacity-80">2 pixels = 1 digit (5 values)</span>
              </button>
              <button
                type="button"
                onClick={() => setConfig({ ...config, emdN: 3 })}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  config.emdN === 3
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                EMD n=3 (Base-7)
                <span className="block text-[10px] opacity-80">3 pixels = 1 digit (7 values)</span>
              </button>
            </div>

            {showAdvanced && (
              <div className="pt-2 space-y-3 border-t border-slate-100 text-xs">
                <div>
                  <div className="flex justify-between text-slate-700 mb-1">
                    <span>Threshold A (Zone A / EMD High Texture):</span>
                    <span className="font-mono text-emerald-700 font-semibold">{(config.threshA * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.5"
                    step="0.05"
                    value={config.threshA}
                    onChange={(e) => setConfig({ ...config, threshA: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-700 mb-1">
                    <span>Threshold B (Zone B / OPAP Mid Texture):</span>
                    <span className="font-mono text-indigo-700 font-semibold">{(config.threshB * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="0.9"
                    step="0.05"
                    value={config.threshB}
                    onChange={(e) => setConfig({ ...config, threshB: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-700 mb-1">
                    <span>Gamma (Edge Contrast Boost):</span>
                    <span className="font-mono text-purple-700 font-semibold">{config.gamma.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="1.5"
                    step="0.1"
                    value={config.gamma}
                    onChange={(e) => setConfig({ ...config, gamma: parseFloat(e.target.value) })}
                    className="w-full accent-purple-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 block mb-1">Zone B OPAP bits (k_b):</label>
                    <select
                      value={config.kbBits}
                      onChange={(e) => setConfig({ ...config, kbBits: parseInt(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-700"
                    >
                      <option value={1}>1 bit</option>
                      <option value={2}>2 bits (Standard)</option>
                      <option value={3}>3 bits</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">Zone C OPAP bits (k_c):</label>
                    <select
                      value={config.kcBits}
                      onChange={(e) => setConfig({ ...config, kcBits: parseInt(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-700"
                    >
                      <option value={1}>1 bit</option>
                      <option value={2}>2 bits</option>
                      <option value={3}>3 bits (Standard)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button & Error */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleEncode}
            disabled={isEncoding || !selectedFile || isCalculatingCap}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isEncoding ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Running Multi-Zone EMD-OPAP Pipeline...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Encode & Secure Stego Image</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Capacity Breakdown & Visual Inspection Dashboard (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Real-Time Capacity & Zone Allocation Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <BarChart className="w-4 h-4 text-emerald-600" />
                <span>Capacity & Zone Allocation</span>
              </h2>
              {isCalculatingCap ? (
                <span className="text-xs text-slate-500 flex items-center space-x-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Calculating...</span>
                </span>
              ) : (
                <span className="text-xs font-mono text-slate-600">
                  Max Payload: <strong className="text-emerald-700">{capacity?.maxBytes.toLocaleString()} B</strong> (~{capacity?.maxCharsEstimated.toLocaleString()} chars)
                </span>
              )}
            </div>

            {/* Capacity Utilization Bar */}
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Payload Utilization:</span>
                <span className="font-mono text-indigo-700 font-semibold">{capacityUsedPct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-300 ${
                    capacityUsedPct > 90 ? 'bg-rose-500' : capacityUsedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, capacityUsedPct))}%` }}
                ></div>
              </div>
            </div>

            {/* Zone Percentages Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-emerald-200">
                <span className="text-emerald-700 font-semibold block text-[11px]">Zone A (EMD)</span>
                <span className="text-slate-900 font-bold text-sm">{capacity?.zoneDistribution.zoneA}%</span>
                <span className="text-slate-500 block text-[10px]">{capacity?.zoneABytes} B</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-indigo-200">
                <span className="text-indigo-700 font-semibold block text-[11px]">Zone B (OPAP {config.kbBits}b)</span>
                <span className="text-slate-900 font-bold text-sm">{capacity?.zoneDistribution.zoneB}%</span>
                <span className="text-slate-500 block text-[10px]">{capacity?.zoneBBytes} B</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-amber-200">
                <span className="text-amber-700 font-semibold block text-[11px]">Zone C (OPAP {config.kcBits}b)</span>
                <span className="text-slate-900 font-bold text-sm">{capacity?.zoneDistribution.zoneC}%</span>
                <span className="text-slate-500 block text-[10px]">{capacity?.zoneCBytes} B</span>
              </div>
            </div>
          </div>

          {/* Encode Results Display */}
          {encodeResult && (
            <div className="space-y-4">
              {/* Quality & Security Metrics Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs">
                  <span className="text-[11px] text-slate-500 block">PSNR Quality</span>
                  <span className="text-lg font-bold text-emerald-700 font-mono">
                    {encodeResult.metrics.psnrDb} dB
                  </span>
                  <span className="text-[10px] text-slate-400 block">(&gt;50dB is invisible)</span>
                </div>

                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs">
                  <span className="text-[11px] text-slate-500 block">SSIM Structural</span>
                  <span className="text-lg font-bold text-indigo-700 font-mono">
                    {encodeResult.metrics.ssim}
                  </span>
                  <span className="text-[10px] text-slate-400 block">(1.0 = identical)</span>
                </div>

                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs">
                  <span className="text-[11px] text-slate-500 block">Embedded Payload</span>
                  <span className="text-lg font-bold text-purple-700 font-mono">
                    {encodeResult.metrics.payloadBytes} B
                  </span>
                  <span className="text-[10px] text-slate-400 block">({encodeResult.metrics.bppEmbedded} bpp)</span>
                </div>

                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs">
                  <span className="text-[11px] text-slate-500 block">Security Verdict</span>
                  <span className="text-sm font-bold text-emerald-700 block truncate">
                    {encodeResult.securityReport.verdict}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Risk: {encodeResult.securityReport.compositeRiskScore}/100</span>
                </div>
              </div>

              {/* Steganalysis Security Checks */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-2 shadow-xs">
                <h3 className="font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Steganalysis & Classical Resistance Report</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono pt-1">
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">RS Steganalysis</span>
                    <span className="text-emerald-700 font-bold">
                      Est. {encodeResult.securityReport.rsAnalysis.estimatedEmbeddingRate}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Status: {encodeResult.securityReport.rsAnalysis.status}</span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Chi-Square ($\chi^2$)</span>
                    <span className="text-indigo-700 font-bold">
                      p={encodeResult.securityReport.chiSquare.pValue}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Status: {encodeResult.securityReport.chiSquare.pStatus}</span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Surrogate CNN Score</span>
                    <span className="text-purple-700 font-bold">
                      {(encodeResult.securityReport.surrogateCnnScore * 100).toFixed(1)}% prob
                    </span>
                    <span className="text-[10px] text-slate-400 block">Model: SteganalyzerNet</span>
                  </div>
                </div>
              </div>

              {/* Visual Multi-Layer Inspector */}
              <VisualInspector
                visuals={encodeResult.visuals}
                dimensions={capacity ? { width: capacity.width, height: capacity.height } : undefined}
              />

              {/* Action Buttons: Download PNG & Export JSON */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleDownloadStego}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Lossless Stego PNG</span>
                </button>

                <button
                  onClick={handleExportJson}
                  className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-xl border border-slate-300 transition-colors flex items-center space-x-1.5"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Export Experiment JSON</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
