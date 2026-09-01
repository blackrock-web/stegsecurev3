import React from 'react';
import {
  ShieldCheck,
  Cpu,
  Layers,
  BarChart3,
  GitCompare,
  FolderArchive,
  ScanSearch,
  BookOpen,
  Lock,
  Unlock,
  Sparkles,
} from 'lucide-react';
import { SystemHealth } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  systemHealth: SystemHealth | null;
  onOpenDocs: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  systemHealth,
  onOpenDocs,
}) => {
  const tabs = [
    { id: 'encode', label: 'Stego Studio (Hide)', icon: Lock },
    { id: 'decode', label: 'Extraction Vault (Reveal)', icon: Unlock },
    { id: 'steganalysis', label: 'Steganalysis Scanner', icon: ScanSearch },
    { id: 'benchmark', label: 'Benchmark & Ablations', icon: BarChart3 },
    { id: 'compare', label: 'Research Paper Comparison', icon: GitCompare },
    { id: 'batch', label: 'Batch Lab', icon: FolderArchive },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-900 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('encode')}>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">SecureStegVault</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono font-medium border border-indigo-200">
                  v3.2
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono hidden sm:block">
                CNN Adaptive EMD-OPAP Image Steganography
              </p>
            </div>
          </div>

          {/* Engine Status Badge */}
          <div className="hidden lg:flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-600">Engine:</span>
              <span className="font-medium text-emerald-700 capitalize">
                {systemHealth?.engine === 'python' ? 'Python CNN (FastAPI)' : 'TypeScript + WebCrypto'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              <span>AES-256-GCM + EMD(n=2/3) + OPAP</span>
            </div>
          </div>

          {/* Quickstart Docs Button */}
          <button
            onClick={onOpenDocs}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors border border-slate-200 text-xs font-medium"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Research & Docs</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
