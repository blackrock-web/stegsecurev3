import React, { useState, useRef } from 'react';
import {
  Unlock,
  KeyRound,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Copy,
  RefreshCw,
  Sliders,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { ZoningConfig } from '../types';
import { decodeStego } from '../lib/api';

export const DecodeStudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState<string>('VaultKey_2026_SecureGCM!');
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Zoning configuration for decoding
  const [config, setConfig] = useState<ZoningConfig>({
    threshA: 0.35,
    threshB: 0.65,
    gamma: 0.7,
    kbBits: 2,
    kcBits: 3,
    emdN: 2,
    adversarialStrength: 0.0,
  });

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDecryptedText(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDecryptedText(null);
      setError(null);
    }
  };

  const handleDecode = async () => {
    if (!selectedFile) {
      setError('Please upload a Stego image to extract from.');
      return;
    }
    if (!passphrase) {
      setError('Please enter the AES-256-GCM passphrase.');
      return;
    }

    setIsDecoding(true);
    setError(null);
    setDecryptedText(null);

    try {
      const text = await decodeStego(selectedFile, passphrase, config);
      setDecryptedText(text);
    } catch (err: any) {
      setError(
        err.message ||
          'Extraction failed: Incorrect passphrase, corrupted image, or non-matching zoning parameters.'
      );
    } finally {
      setIsDecoding(false);
    }
  };

  const handleCopy = () => {
    if (decryptedText) {
      navigator.clipboard.writeText(decryptedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <Unlock className="w-5 h-5 text-emerald-600" />
          <span>Extraction Vault: Authenticated Payload Recovery</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Recovers hidden steganography streams, executes reverse EMD digit unmapping and OPAP extraction, and verifies AES-256-GCM integrity tags.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Image Upload & Parameters */}
        <div className="space-y-4">
          {/* Stego Image Upload */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Upload Stego Image (PNG / BMP)
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-50/60"
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
                    alt="Stego preview"
                    className="max-h-40 rounded-lg object-contain shadow-xs border border-slate-200"
                  />
                  <p className="text-xs text-slate-700 mt-2 font-mono truncate max-w-xs">
                    {selectedFile?.name}
                  </p>
                  <span className="text-xs text-emerald-600 font-medium mt-1">Click to change file</span>
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-700 font-medium">Select or drop stego image</p>
                  <p className="text-xs text-slate-500">Lossless PNG recommended</p>
                </div>
              )}
            </div>
          </div>

          {/* Passphrase Input */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center space-x-1.5">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>AES-256-GCM Passphrase</span>
              </label>
              <input
                type="text"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter exact passphrase used during encoding..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-emerald-500 font-mono"
              />
            </div>

            {/* EMD Selector */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-600">EMD Group Size:</span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, emdN: 2 })}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    config.emdN === 2
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  n=2 (Base-5)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, emdN: 3 })}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    config.emdN === 3
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  n=3 (Base-7)
                </button>
              </div>
            </div>

            <button
              onClick={handleDecode}
              disabled={isDecoding || !selectedFile}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed mt-2"
            >
              {isDecoding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Extracting & Verifying GCM Tag...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Extract & Decrypt Payload</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Decrypted Output & Verification */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Decrypted Payload Result</span>
                </h2>
                {decryptedText && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Copy className="w-3 h-3 text-indigo-600" />
                    <span>{copied ? 'Copied!' : 'Copy Plaintext'}</span>
                  </button>
                )}
              </div>

              {decryptedText ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Authentication Verified! 128-bit GCM MAC check succeeded. Payload is intact and uncorrupted.
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed shadow-inner">
                    {decryptedText}
                  </div>
                </div>
              ) : error ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-rose-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Extraction Error</span>
                  </div>
                  <p>{error}</p>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p>Upload a stego image and enter the passphrase to decrypt hidden payload.</p>
                </div>
              )}
            </div>

            {/* Cryptographic Proof Specifications */}
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono space-y-1">
              <div className="flex justify-between">
                <span>Cipher:</span>
                <span className="text-slate-700 font-medium">AES-256-GCM (Authenticated)</span>
              </div>
              <div className="flex justify-between">
                <span>Key Derivation:</span>
                <span className="text-slate-700 font-medium">PBKDF2-HMAC-SHA256 (10,000 iter)</span>
              </div>
              <div className="flex justify-between">
                <span>Allocation Schema:</span>
                <span className="text-slate-700 font-medium">Zhang-Wang EMD + Chan-Cheng OPAP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
