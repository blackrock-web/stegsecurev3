import React from 'react';
import { X, BookOpen, Shield, Cpu, Flame, Layers, Lock, Award } from 'lucide-react';

interface QuickstartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickstartModal: React.FC<QuickstartModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl text-slate-700">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">SecureStegVault v3.2 — Research Reference</h2>
              <p className="text-xs text-slate-500">CNN Adaptive EMD-OPAP Image Steganography Architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs leading-relaxed">
          {/* Overview */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>1. Research Objective & Scientific Architecture</span>
            </h3>
            <p className="text-slate-600">
              SecureStegVault establishes an adaptive, distortion-optimized steganography pipeline designed to hide encrypted payloads into uncompressed cover images (PNG/BMP) while remaining virtually undetectable against modern classical and deep-learning steganalysers.
            </p>
          </div>

          {/* Pipeline Phases */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="font-bold text-indigo-700 flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>Phase 1: CNN Cost Mapping</span>
              </span>
              <p className="text-slate-600">
                Multi-scale convolutional feature extraction maps local gradient variations and edge entropy. High-texture pixels are assigned lowest embedding cost.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="font-bold text-emerald-700 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Phase 2: Adaptive Percentile Zoning</span>
              </span>
              <p className="text-slate-600">
                Cost maps are partitioned into <strong>Zone A</strong> (High-texture edges → EMD), <strong>Zone B</strong> (Mid-frequency → OPAP k_b), and <strong>Zone C</strong> (Smooth flats → OPAP k_c).
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="font-bold text-purple-700 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-purple-600" />
                <span>Phase 3: AES-256-GCM Encryption</span>
              </span>
              <p className="text-slate-600">
                Payloads are cryptographically shielded using authenticated AES-GCM with PBKDF2 (10,000 iterations), preventing brute-force and ciphertext tampering.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="font-bold text-amber-700 flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-600" />
                <span>Phase 4: EMD & OPAP Minimum Distortion</span>
              </span>
              <p className="text-slate-600">
                Zhang & Wang EMD embeds base-5/7 digits by altering at most 1 pixel by ±1, while Chan & Cheng OPAP bounds k-bit error within 2^(k-1).
              </p>
            </div>
          </div>

          {/* Steganalysis Defenses */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>2. Evaluated Steganalysis Resistances</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li><strong>RS Steganalysis:</strong> Maintains parity between Regular ($R$) and Singular ($S$) groups by minimizing spatial continuity disruptions.</li>
              <li><strong>Chi-Square ($\chi^2$):</strong> Avoids PoV (Pairs of Values) flattening inherent to simple LSB replacement.</li>
              <li><strong>Sample Pair Analysis (SPA):</strong> Bounded modifications prevent telltale multi-sample transition shifts.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
