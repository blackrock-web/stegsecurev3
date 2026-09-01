export type CostMapMode = 'cnn' | 'classical' | 'advanced' | 'neural' | 'heuristic';

export interface ZoningConfig {
  threshA: number; // percentile or threshold for Zone A (EMD) e.g. 0.35
  threshB: number; // percentile or threshold for Zone B (OPAP k_b) e.g. 0.65
  gamma: number;   // non-linear edge boost e.g. 0.7
  kbBits: number;  // bits per pixel in Zone B (e.g. 2)
  kcBits: number;  // bits per pixel in Zone C (e.g. 3)
  emdN: 2 | 3;     // EMD group size (2 or 3)
  adversarialStrength: number;
}

export interface CapacityInfo {
  width: number;
  height: number;
  channels: number;
  totalPixels: number;
  zoneABytes: number;
  zoneBBytes: number;
  zoneCBytes: number;
  maxBytes: number;
  maxCharsEstimated: number;
  bppMax: number;
  zoneDistribution: {
    zoneA: number; // percentage
    zoneB: number;
    zoneC: number;
  };
}

export interface MetricsResult {
  psnrDb: number;
  ssim: number;
  mse: number;
  totalBitsEmbedded: number;
  payloadBytes: number;
  bppEmbedded: number;
  capacityUtilizationPct: number;
  executionTimeMs: number;
  zoneBreakdown: {
    zoneABits: number;
    zoneBBits: number;
    zoneCBits: number;
  };
}

export interface SecurityReport {
  rsAnalysis: {
    regularCount: number;
    singularCount: number;
    estimatedEmbeddingRate: number; // 0.0 to 1.0
    status: 'clean' | 'suspicious' | 'detected';
  };
  chiSquare: {
    chi2Stat: number;
    pValue: number;
    suspectPairs: number;
    pStatus: 'clean' | 'suspicious' | 'anomalous';
  };
  samplePairAnalysis: {
    estimatedBitRate: number;
    confidence: number;
  };
  histogramShift: {
    earthMoverDist: number;
    klDivergence: number;
  };
  surrogateCnnScore: number; // 0.0 to 1.0 probability of steganography
  compositeRiskScore: number; // 0 to 100
  verdict: 'Undetected / Highly Secure' | 'Low Risk' | 'Moderate Risk' | 'High Risk / Compromised';
}

export interface VisualArtifacts {
  coverDataUrl: string;
  stegoDataUrl: string;
  costMapDataUrl: string;
  zoneMapDataUrl: string;
  residualDataUrl: string;
  gradientMapDataUrl?: string;
}

export interface EncodeResult {
  success: boolean;
  metrics: MetricsResult;
  securityReport: SecurityReport;
  visuals: VisualArtifacts;
  costMapMode: string;
  adversarialStrength: number;
  emdN: number;
  modelsUsed: {
    costmap: string;
    steganalyzer: string;
  };
  stegoFilename: string;
}

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  category: 'Proposed' | 'Baseline' | 'Ablation' | 'PriorArt';
  paperReference?: string;
}

export interface BenchmarkStrategyResult {
  strategyId: string;
  strategyName: string;
  category: string;
  psnrDb: number;
  ssim: number;
  mse: number;
  bpp: number;
  securityScore: number; // 0-100 (higher = more secure)
  executionMs: number;
  steganalysisDetectionRate: number; // 0.0 - 1.0 (lower = better)
  paretoRank?: number;
}

export interface BenchmarkRunResult {
  timestamp: string;
  imageDimensions: string;
  payloadSize: number;
  results: BenchmarkStrategyResult[];
  fastestStrategy: string;
  mostSecureStrategy: string;
  bestVisualQuality: string;
}

export interface PaperComparison {
  id: string;
  title: string;
  authors: string;
  year: number;
  venue: string;
  methodology: string;
  typicalPsnr: number;
  maxBpp: number;
  stegResistance: string;
  robustnessAgainstJpg: string;
  status: 'Integrated' | 'Simulated Stub' | 'Official Checkpoint Available';
}

export interface BatchItem {
  id: string;
  filename: string;
  filesize: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: {
    psnr: number;
    ssim: number;
    payloadBytes: number;
    stegoUrl: string;
  };
  error?: string;
}

export interface BenchmarkOperationRecord {
  id: string;
  timestamp: string;
  imageName: string;
  imageIndex: number;
  dataset: string;
  modelId: string;
  modelName: string;
  modelCategory: 'Proposed' | 'Baseline' | 'Ablation' | 'Paper';
  paperReference?: string;
  requiresCheckpoint: boolean;
  operation: 'embed_and_extract';
  startTime: number;
  endTime: number;
  durationMs: number;
  status: 'completed' | 'failed' | 'unavailable';
  error?: string;
  psnrDb?: number;
  ssim?: number;
  mse?: number;
  payloadSize: number; // bytes
  capacityBytes: number;
  bpp?: number;
  extractionSuccess?: boolean;
  securityScore?: number;
  detectionRate?: number;
  /**
   * Which cost-map engine actually produced this result: 'neural' means the
   * real trained LF-RINN ONNX model (src/backend_ts/costMapNeural.ts) ran on
   * the backend; 'heuristic-fallback' means the backend was unreachable (or
   * the ONNX session failed to load) and the browser-side Sobel/Laplacian
   * heuristic was used instead. Only set for 'Proposed' category models —
   * baselines/ablations are heuristic by design. Surfacing this prevents a
   * silent heuristic fallback from being mistaken for a neural-model result.
   */
  costMapEngine?: 'neural' | 'heuristic-fallback';
}

export interface BestResultSummary {
  bestPsnr?: {
    modelName: string;
    modelId: string;
    imageName: string;
    value: number;
  };
  bestSsim?: {
    modelName: string;
    modelId: string;
    imageName: string;
    value: number;
  };
  bestOverall?: {
    modelName: string;
    modelId: string;
    score: number;
    avgPsnr: number;
    avgSsim: number;
    avgSecurityScore: number;
    avgBpp: number;
    extractionSuccessRate: number;
  };
  insufficientData: boolean;
}

export interface BenchmarkSessionStats {
  totalImages: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
}

export interface SystemHealth {
  status: string;
  service: string;
  version: string;
  engine: 'python' | 'node-ts' | 'hybrid';
  torchAvailable: boolean;
  models: {
    costmapCnn: boolean;
    steganalyzerNet: boolean;
  };
}