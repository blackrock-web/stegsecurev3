import React, { useState, useRef } from 'react';
import {
  FolderArchive,
  Upload,
  Play,
  CheckCircle,
  Clock,
  Download,
  FileArchive,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { ZoningConfig } from '../types';
import { encodeStego } from '../lib/api';

interface RealBatchItem {
  id: string;
  file: File;
  filename: string;
  filesize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: {
    psnr: number;
    ssim: number;
    payloadBytes: number;
    stegoUrl: string;
  };
  error?: string;
}

export const BatchLab: React.FC = () => {
  const [items, setItems] = useState<RealBatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [secretText, setSecretText] = useState<string>('CONFIDENTIAL BATCH RUN: Adaptive EMD OPAP encoding verification.');
  const [passphrase, setPassphrase] = useState<string>('BatchSecure2026!');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config: ZoningConfig = {
    threshA: 0.35,
    threshB: 0.65,
    gamma: 0.7,
    kbBits: 2,
    kcBits: 3,
    emdN: 2,
    adversarialStrength: 0.0,
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: RealBatchItem[] = Array.from(files).map((f, i) => ({
      id: `batch-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      file: f,
      filename: f.name,
      filesize: f.size,
      status: 'pending',
      progress: 0,
    }));
    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRunBatch = async () => {
    if (items.length === 0 || isProcessing) return;
    setIsProcessing(true);

    for (let i = 0; i < items.length; i++) {
      const currentItem = items[i];
      if (currentItem.status === 'completed') continue;

      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'processing', progress: 30 } : item
        )
      );

      try {
        const response = await encodeStego(
          currentItem.file,
          secretText,
          passphrase,
          config
        );

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 'completed',
                  progress: 100,
                  result: {
                    psnr: response.metrics.psnrDb,
                    ssim: response.metrics.ssim,
                    payloadBytes: secretText.length + 38,
                    stegoUrl: response.visuals.stegoDataUrl,
                  },
                }
              : item
          )
        );
      } catch (err: any) {
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 'failed',
                  progress: 100,
                  error: err.message || 'Processing failed',
                }
              : item
          )
        );
      }
    }

    setIsProcessing(false);
  };

  const clearItems = () => {
    setItems([]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <FolderArchive className="w-5 h-5 text-indigo-600" />
            <span>Batch Processing Lab</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Queue and process image batches with actual execution of the SecureStegVault adaptive zoning and EMD/OPAP encoding engine.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {items.length > 0 && (
            <button
              onClick={clearItems}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors flex items-center space-x-1 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Clear Queue</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Add Batch Images</span>
          </button>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept="image/png,image/bmp,image/jpeg"
            className="hidden"
          />
        </div>
      </div>

      {/* Batch Form & Control */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Batch Secret Message
          </label>
          <input
            type="text"
            value={secretText}
            onChange={(e) => setSecretText(e.target.value)}
            disabled={isProcessing}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-indigo-500"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Passphrase
          </label>
          <input
            type="text"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            disabled={isProcessing}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-end shadow-xs">
          <button
            onClick={handleRunBatch}
            disabled={items.length === 0 || isProcessing}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing Queue Real-time...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Execute Batch Pipeline ({items.length} files)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Queue List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Job Queue ({items.length} items)
          </span>
          <span className="text-xs font-mono text-slate-500">
            {items.filter((i) => i.status === 'completed').length} completed
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <FileArchive className="w-10 h-10 mx-auto mb-2 opacity-30 text-indigo-400" />
            <p className="text-slate-700 text-sm font-medium">Batch queue is empty.</p>
            <p className="text-slate-500 mt-1">Upload multiple PNG/BMP/JPEG covers to execute real steganographic embedding.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs font-mono">
            {items.map((item) => (
              <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-3">
                  {item.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : item.status === 'processing' ? (
                    <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                  ) : item.status === 'failed' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold text-slate-800 block">{item.filename}</span>
                    <span className="text-[10px] text-slate-500">{(item.filesize / 1024).toFixed(1)} KB</span>
                    {item.error && (
                      <span className="text-[10px] text-rose-600 block mt-0.5">{item.error}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {item.result && (
                    <div className="flex items-center space-x-3">
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        PSNR: {item.result.psnr.toFixed(2)} dB
                      </span>
                      <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        SSIM: {item.result.ssim.toFixed(4)}
                      </span>
                      {item.result.stegoUrl && (
                        <a
                          href={item.result.stegoUrl}
                          download={`stego-${item.filename}`}
                          className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                          title="Download Stego Image"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      item.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item.status === 'processing'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : item.status === 'failed'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

