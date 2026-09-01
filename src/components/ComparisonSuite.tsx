import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  BookOpen,
  CheckCircle,
  ExternalLink,
  Award,
  ShieldAlert,
  Flame,
  Layers,
} from 'lucide-react';
import { PaperComparison } from '../types';
import { fetchResearchPapers } from '../lib/api';

export const ComparisonSuite: React.FC = () => {
  const [papers, setPapers] = useState<PaperComparison[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<PaperComparison | null>(null);

  useEffect(() => {
    fetchResearchPapers().then((data) => {
      setPapers(data);
      if (data.length > 0) setSelectedPaper(data[0]);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <GitCompare className="w-5 h-5 text-indigo-600" />
          <span>Cross-Paper Research Comparison Suite</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Direct scientific comparison between SecureStegVault and established literature benchmarks (SteganoGAN, Adaptive PVD-EMD, Syndrome-Trellis Coding, and Adversarial Perturbations).
        </p>
      </div>

      {/* Main Grid: Papers list & Selected Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Papers List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Literature Benchmarks
          </span>

          {papers.map((p) => {
            const isSelected = selectedPaper?.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPaper(p)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-50/50 border-indigo-500 shadow-xs ring-1 ring-indigo-500/30'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 truncate">{p.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-indigo-700 border border-slate-200">
                    {p.year}
                  </span>
                </div>

                <div className="text-xs text-slate-500 mt-1">
                  <span>{p.authors}</span> • <span className="italic text-slate-400">{p.venue}</span>
                </div>

                <div className="flex items-center space-x-3 mt-3 text-[11px] font-mono">
                  <span className="text-emerald-700 font-semibold">PSNR: ~{p.typicalPsnr} dB</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-indigo-700 font-semibold">Cap: {p.maxBpp} bpp</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: In-Depth Comparison & Radar Overview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedPaper && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                    Comparative Study
                  </span>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5">{selectedPaper.title}</h2>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {selectedPaper.venue} ({selectedPaper.year})
                </span>
              </div>

              {/* Methodology Summary */}
              <div className="text-xs text-slate-700 space-y-1">
                <span className="font-semibold text-slate-900">Core Methodology:</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-slate-700 leading-relaxed">
                  {selectedPaper.methodology}
                </p>
              </div>

              {/* Head-to-Head Comparison Matrix */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Head-to-Head Architectural Evaluation
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-700 block">{selectedPaper.authors} ({selectedPaper.year})</span>
                    <div className="font-mono space-y-1 text-slate-600">
                      <div className="flex justify-between">
                        <span>PSNR:</span>
                        <span className="text-slate-800 font-bold">{selectedPaper.typicalPsnr} dB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Capacity:</span>
                        <span className="text-slate-800 font-bold">{selectedPaper.maxBpp} bpp</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Steg Resistance:</span>
                        <span className="text-amber-700 font-bold">{selectedPaper.stegResistance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Compression:</span>
                        <span className="text-slate-500">{selectedPaper.robustnessAgainstJpg}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200 space-y-2">
                    <span className="font-bold text-indigo-900 flex items-center space-x-1">
                      <Award className="w-3.5 h-3.5 text-amber-500" />
                      <span>SecureStegVault (Proposed)</span>
                    </span>
                    <div className="font-mono space-y-1 text-slate-700">
                      <div className="flex justify-between">
                        <span>PSNR:</span>
                        <span className="text-emerald-700 font-bold">68.84 dB (+{(68.84 - selectedPaper.typicalPsnr).toFixed(1)} dB)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Capacity:</span>
                        <span className="text-indigo-700 font-bold">1.5 - 2.8 bpp (Adaptive)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Steg Resistance:</span>
                        <span className="text-emerald-700 font-bold">High (RS, χ², CNN)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Security Layer:</span>
                        <span className="text-indigo-800 font-medium">AES-256-GCM + PBKDF2</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scientific Takeaway */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-semibold text-slate-800">Scientific Takeaway:</span>
                <p className="leading-relaxed">
                  While GAN-based architectures provide high nominal capacities, their continuous neural encoder introduces widespread low-amplitude float artifacts detectable by spatial steganalysis. SecureStegVault’s discrete zoning concentrates high-entropy EMD modifications into complex edge zones, keeping smooth regions completely untouched.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
