/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, ErrorInfo, ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { 
  Upload, 
  LayoutDashboard, 
  Map, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  FileSpreadsheet,
  RefreshCw,
  LogOut,
  LogIn,
  Scissors,
  Box,
  ChevronRight,
  Info,
  Search,
  Filter,
  Award,
  Coins,
  Flame,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { CDPhysicalMap } from './components/CDPhysicalMap';
import CortesDashboard from './components/CortesDashboard';
import AvariaDashboard from './components/AvariaDashboard';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4 text-center">
          <div className="max-w-md w-full p-8 bg-rose-500/10 border border-rose-500/20 rounded-3xl">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Ops! Algo deu errado.</h2>
            <p className="text-emerald-100/60 mb-6 text-sm">
              Ocorreu um erro inesperado. Tente recarregar a página ou entre em contato com o suporte.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-xl font-semibold transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Types ---

interface StreetData {
  id: number;
  name: string;
  plan: number;
  counted: number;
  pending: number;
  status: number;
  errors: number;
  surplus: number;
  shortage: number;
  finalized: number;
  pickingPlan?: number;
  pickingCounted?: number;
  pickingPending?: number;
  pickingStatus?: number;
  pulmaoPlan?: number;
  pulmaoCounted?: number;
  pulmaoPending?: number;
  pulmaoStatus?: number;
}

interface DailyHistory {
  date: string;
  dayName: string;
  count: number;
}

interface WeeklyHistory {
  weekRange: string;
  count: number;
}

interface CollaboratorCount {
  name: string;
  count: number;
}

interface OccupancyMetric {
  area: string;
  structure: number;
  addresses: number;
  occupied: number;
  definitivo: number;
  operacional: number;
  disponivel: number;
  percentage: number;
  isCategory: boolean;
  subcategories?: OccupancyMetric[];
}

interface OccupancyData {
  totalStructure: number;
  totalAddresses: number;
  totalOccupied: number;
  totalDefinitivo: number;
  totalOperacional: number;
  totalDisponivel: number;
  globalPercentage: number;
  areas: OccupancyMetric[];
  setoresLayout?: SetoresLayoutItem[];
}

interface InventarioGTSKU {
  sku: string;
  description: string;
  address: string;
  expirationDate: string;
  shelfLifeAL: string | number;
  daysRemaining: number | null;
  category: 'PRÉ FEFO' | 'FEFO' | 'PRÉ PERDA' | 'PERDA' | 'NORMAL';
  valueBR: number;
}

interface InventarioGTData {
  items: InventarioGTSKU[];
  uniqueSKUCount: number;
  preFefoCount: number;
  fefoCount: number;
  prePerdaCount: number;
  perdaCount: number;
}

interface CortesItem {
  sku: string;
  description: string;
  date: string;
  dateObj?: string | null;
  quantity: number;
  value: number;
  reason: string;
  pedido?: string | null;
}

interface AvariaItem {
  date: string;
  dateObj?: string | null;
  sku: string;
  description: string;
  quantity: number;
  conversionFactor: string;
  unitPrice: number;
  totalPrice: number;
}

interface SetoresLayoutItem {
  rua: number;
  predio: number;
  andar: number;
  setor: string;
}

interface DashboardMetrics {
  totalPositions: number;
  totalCounted: number;
  totalPending: number;
  accuracy: number;
  finalAccuracy: number;
  totalErrors: number;
  surplus: number;
  shortage: number;
  finalizedDivergences: number;
  generalStatus: number;
  streets: StreetData[];
  pickingPositions?: number;
  pickingCounted?: number;
  pickingPending?: number;
  pulmaoPositions?: number;
  pulmaoCounted?: number;
  pulmaoPending?: number;
  dailyCount?: number;
  monthlyCount?: number;
  weeklyGoal?: number;
  dailyGoal?: number;
  weeklyGoalCalculated?: number;
  dailyHistory?: DailyHistory[];
  weeklyHistory?: WeeklyHistory[];
  collaboratorCounts?: CollaboratorCount[];
  occupancyData?: OccupancyData;
  inventarioGT?: InventarioGTData;
  setoresLayout?: SetoresLayoutItem[];
  cortes?: CortesItem[];
  cortesWMS?: CortesItem[];
  avaria?: AvariaItem[];
  updatedAt?: string;
  updatedBy?: string;
}

// --- Components ---

const MetricCard = ({ title, value, icon: Icon, color, subtitle, theme }: { 
  title: string; 
  value: string | number; 
  icon: any; 
  color: string;
  subtitle?: string;
  theme?: any;
}) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className={cn(
      "p-6 rounded-2xl border shadow-sm flex flex-col justify-between transition-all duration-300 backdrop-blur-md",
      theme ? `${theme.contentBg} ${theme.contentBorder} ${theme.contentShadow}` : "bg-white/95 border-slate-100"
    )}
  >
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-xl shadow-lg", color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {subtitle && (
        <span className={cn("text-xs font-black uppercase tracking-wider", theme ? theme.contentText : "text-slate-400")}>
          {subtitle}
        </span>
      )}
    </div>
    <div>
      <h3 className={cn("text-[10px] font-black mb-1 uppercase tracking-[0.2em]", theme ? theme.contentText : "text-slate-400 opacity-60")}>{title}</h3>
      <p className={cn("text-3xl font-black font-mono tracking-tighter", theme ? theme.contentTitle : "text-slate-900")}>{value}</p>
    </div>
  </motion.div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <DashboardApp />
    </ErrorBoundary>
  );
}

type Module = 'ANALISE DE CORTE' | 'MAPA DE OCUPAÇÃO' | 'INVENTARIO CÍCLICO' | 'INVENTARIO GERAL GIROTRADE' | 'AVARIA';

const getTheme = (module: Module) => {
  switch (module) {
    case 'AVARIA':
      return {
        primary: 'amber',
        bg: 'bg-slate-50',
        realBg: '#f8fafc',
        sidebarBg: 'bg-white',
        contentBg: 'bg-amber-600/95 backdrop-blur-xl',
        border: 'border-amber-700',
        contentBorder: 'border-amber-900 border-4 shadow-[0_0_20px_rgba(245,158,11,0.4)]',
        active: 'bg-amber-800 text-white shadow-amber-500/30',
        hover: 'hover:bg-amber-50',
        text: 'text-slate-600',
        contentText: 'text-amber-50',
        contentTitle: 'text-white',
        icon: 'text-amber-200',
        wave1: 'rgba(255,255,255,0.1)',
        wave2: 'rgba(255,255,255,0.05)',
        shadow: 'shadow-amber-200/50',
        contentShadow: 'shadow-2xl shadow-amber-900/20',
        accent: 'text-amber-400',
        logo: '#f59e0b',
        logoTop: '#ffffff',
        headerTitle: 'text-amber-900',
        headerText: 'text-amber-700/90'
      };
    case 'MAPA DE OCUPAÇÃO':
      return {
        primary: 'zinc',
        bg: 'bg-slate-50', 
        realBg: '#f8fafc',
        sidebarBg: 'bg-white', 
        contentBg: 'bg-[#313135]/95 backdrop-blur-xl',
        border: 'border-zinc-200',
        contentBorder: 'border-black border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]', 
        active: 'bg-zinc-900 text-white shadow-2xl',
        hover: 'hover:bg-zinc-100',
        text: 'text-zinc-500',
        contentText: 'text-zinc-100', 
        contentTitle: 'text-white', 
        icon: 'text-zinc-400', 
        wave1: 'rgba(255,255,255,0.05)',
        wave2: 'rgba(0,0,0,0.01)',
        shadow: 'shadow-black/10',
        contentShadow: 'shadow-[0_0_30px_rgba(0,0,0,0.4)]',
        accent: 'text-white',
        logo: '#000000', 
        logoTop: '#ffffff', 
        headerTitle: 'text-white',
        headerText: 'text-zinc-400'
      };
    case 'INVENTARIO GERAL GIROTRADE':
      return {
        primary: 'blue',
        bg: 'bg-slate-50',
        realBg: '#f8fafc',
        sidebarBg: 'bg-white',
        contentBg: 'bg-blue-600/95 backdrop-blur-xl',
        border: 'border-blue-700',
        contentBorder: 'border-blue-900 border-4 shadow-[0_0_20px_rgba(59,130,246,0.4)]',
        active: 'bg-blue-800 text-white',
        hover: 'hover:bg-blue-50',
        text: 'text-slate-600',
        contentText: 'text-blue-50',
        contentTitle: 'text-white',
        icon: 'text-blue-200',
        wave1: 'rgba(255,255,255,0.1)',
        wave2: 'rgba(255,255,255,0.05)',
        shadow: 'shadow-blue-200/50',
        contentShadow: 'shadow-2xl shadow-blue-900/20',
        accent: 'text-blue-400',
        logo: '#3b82f6',
        logoTop: '#ffffff',
        headerTitle: 'text-blue-900',
        headerText: 'text-blue-700/90'
      };
    case 'ANALISE DE CORTE':
      return {
        primary: 'rose',
        bg: 'bg-slate-50',
        realBg: '#f8fafc',
        sidebarBg: 'bg-white',
        contentBg: 'bg-white/95 backdrop-blur-xl',
        border: 'border-rose-100',
        contentBorder: 'border-2 border-rose-600 shadow-md',
        active: 'bg-rose-600 text-white shadow-rose-500/30',
        hover: 'hover:bg-rose-50',
        text: 'text-slate-600',
        contentText: 'text-rose-900',
        contentTitle: 'text-rose-950',
        icon: 'text-rose-700',
        wave1: 'rgba(244,63,94,0.05)',
        wave2: 'rgba(244,63,94,0.02)',
        shadow: 'shadow-rose-400/30',
        contentShadow: 'shadow-md',
        accent: 'text-rose-700',
        logo: '#f43f5e',
        headerTitle: 'text-rose-950',
        headerText: 'text-rose-800'
      };
    default:
      return {
        primary: 'emerald',
        bg: 'bg-slate-50',
        realBg: '#f8fafc',
        sidebarBg: 'bg-white',
        contentBg: 'bg-emerald-900/95 backdrop-blur-xl',
        border: 'border-emerald-100',
        contentBorder: 'border-4 border-emerald-400',
        active: 'bg-emerald-600 text-white',
        hover: 'hover:bg-emerald-50',
        text: 'text-slate-600',
        contentText: 'text-emerald-50',
        contentTitle: 'text-white',
        icon: 'text-emerald-300',
        wave1: 'rgba(255,255,255,0.1)',
        wave2: 'rgba(255,255,255,0.05)',
        shadow: 'shadow-emerald-200/50',
        contentShadow: 'shadow-[0_0_20px_rgba(52,211,153,0.4)]',
        accent: 'text-emerald-400',
        logo: '#34d399', // Diferente verde (Emerald 400)
        logoTop: '#ffffff', // Branco para o arco superior
        headerTitle: 'text-black',
        headerText: 'text-black font-semibold opacity-90'
      };
  }
};

// --- Occupancy Components ---

const CollapsibleTableRow = ({ area, showStructure = false, showOccupied = false, showBlocked = false, showAvailable = false, theme }: { area: OccupancyMetric, showStructure?: boolean, showOccupied?: boolean, showBlocked?: boolean, showAvailable?: boolean, theme?: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSubcategories = area.subcategories && area.subcategories.length > 0;

  const isTotalCD = area.area.toUpperCase().includes('TOTAL CD');

  return (
    <>
        <tr className={cn(
          "transition-colors",
          !theme && "border-b border-slate-100",
          area.isCategory ? (theme ? "bg-zinc-900/50 font-bold" : "bg-slate-50 font-bold") : (theme ? theme.contentTitle : "text-slate-900"),
          isTotalCD && (theme ? "bg-zinc-800 border-t-2 border-zinc-700 text-white shadow-lg" : "bg-blue-50 border-t border-blue-200 text-blue-900")
        )}>
        <td className="py-4 px-4 flex items-center gap-2">
          {hasSubcategories ? (
            <button 
              onClick={() => setIsExpanded(!isExpanded)} 
              className={cn("transition-colors flex items-center gap-3 w-full text-left group", theme ? "text-blue-400 hover:text-blue-300" : "text-blue-500 hover:text-blue-700")}
            >
              <ChevronRight className={cn("w-5 h-5 transition-transform duration-200", isExpanded ? "rotate-90" : "")} />
              <span className={cn("text-sm uppercase tracking-wider font-bold group-hover:underline", theme ? (isTotalCD ? "text-white font-black" : theme.contentTitle) : "text-slate-950")}>{area.area}</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 ml-8">
              <span className={cn("text-sm uppercase tracking-wider font-bold", theme ? (isTotalCD ? "text-white font-black" : theme.contentTitle) : "text-slate-950")}>{area.area}</span>
            </div>
          )}
        </td>
        {showStructure && (
          <>
            <td className={cn("py-4 px-4 text-right font-mono text-base font-black", theme ? "text-white" : "text-black")}>{(area.structure || 0).toLocaleString()}</td>
            <td className={cn("py-4 px-4 text-right font-mono text-base font-black", theme ? "text-white" : "text-black")}>{(area.addresses || 0).toLocaleString()}</td>
          </>
        )}
        {showOccupied && (
          <>
            <td className={cn("py-4 px-4 text-right font-mono text-base font-black", theme ? "text-white" : "text-black")}>
              {(area.occupied || 0).toLocaleString()}
            </td>
            <td className={cn("py-4 px-4 text-right font-mono text-base font-black scale-110", theme ? (isTotalCD ? "text-yellow-200" : "text-amber-400") : "text-amber-700")}>
              {(area.percentage || 0).toFixed(1)}%
            </td>
          </>
        )}
        {showBlocked && (
          <td className={cn("py-4 px-4 text-right font-mono text-sm font-black", theme ? "text-rose-400" : "text-rose-700")}>
            {((area.definitivo || 0) + (area.operacional || 0)).toLocaleString()}
          </td>
        )}
        {showAvailable && (
          <td className={cn("py-4 px-4 text-right font-mono text-sm font-black", theme ? "text-emerald-400" : "text-emerald-700")}>{(area.disponivel || 0).toLocaleString()}</td>
        )}
      </tr>
      {isExpanded && hasSubcategories && area.subcategories?.map(sub => (
        <tr key={sub.area} className={cn("italic transition-colors", !theme && "border-b border-slate-200", theme ? cn(theme.contentBorder, "bg-black/40") : "bg-slate-100")}>
          <td className={cn("py-2 px-4 pl-14 text-xs font-black", theme ? "text-yellow-400" : "text-black")}>{sub.area}</td>
          {showStructure && (
            <>
              <td className={cn("py-2 px-4 text-right font-mono text-sm font-black", theme ? "text-white" : "text-black")}>{(sub.structure || 0).toLocaleString()}</td>
              <td className={cn("py-2 px-4 text-right font-mono text-sm font-black", theme ? "text-white" : "text-black")}>{(sub.addresses || 0).toLocaleString()}</td>
            </>
          )}
          {showOccupied && (
            <>
              <td className={cn("py-2 px-4 text-right font-mono text-sm font-black", theme ? "text-white" : "text-black")}>{(sub.occupied || 0).toLocaleString()}</td>
              <td className={cn("py-2 px-4 text-right font-mono text-sm font-black", theme ? "text-white" : "text-amber-800")}>{(sub.percentage || 0).toFixed(1)}%</td>
            </>
          )}
          {showBlocked && (
            <td className={cn("py-2 px-4 text-right font-mono text-xs font-black", theme ? "text-rose-400" : "text-rose-800")}>
              {((sub.definitivo || 0) + (sub.operacional || 0)).toLocaleString()}
            </td>
          )}
          {showAvailable && (
            <td className={cn("py-2 px-4 text-right font-mono text-xs font-black", theme ? "text-emerald-400" : "text-emerald-800")}>{(sub.disponivel || 0).toLocaleString()}</td>
          )}
        </tr>
      ))}
    </>
  );
};

const MiniMetric = ({ title, value, percentage, icon: Icon, color, theme }: { title: string, value: string, percentage?: string, icon: any, color: string, theme?: any }) => (
  <div className={cn("rounded-2xl p-6 flex items-center justify-between shadow-xl transition-all duration-500", theme ? `${theme.contentBg} border-transparent ${theme.contentShadow}` : "bg-white border-2 border-slate-200")}>
    <div className="flex items-center gap-5">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border-2", color, "border-transparent")}>
        <Icon className={cn("w-6 h-6", theme ? "text-white" : "text-black")} />
      </div>
      <div>
        <div className={cn("text-[11px] font-black uppercase tracking-widest mb-1.5", theme ? "text-white/80" : "text-slate-950")}>{title}</div>
        <div className={cn("text-4xl font-black font-mono leading-none", theme ? "text-white text-shadow-lg" : "text-black")}>{value}</div>
      </div>
    </div>
    {percentage && (
      <div className={cn("text-xs font-black px-2 py-1 rounded-lg bg-amber-500/10", theme ? "text-amber-400" : "text-amber-700")}>{percentage}</div>
    )}
  </div>
);

const OccupancyCard = ({ title, areaName, subtitle, data, theme }: { title: string, areaName: string, subtitle: string, data: OccupancyData, theme?: any }) => {
  const area = data.areas.find(a => a.area.toUpperCase().includes(areaName.toUpperCase()));
  if (!area) return null;

  const filledCount = Math.floor(area.percentage / (100 / 6));
    let mainColor = theme ? "text-white" : "text-slate-900";
    if (!theme) {
      if (filledCount === 4) mainColor = "text-yellow-600";
      else if (filledCount === 5) mainColor = "text-orange-600";
      else if (filledCount >= 6) mainColor = "text-red-600";
    }

  return (
    <div className={cn("rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all duration-500", theme ? `${theme.contentBg} ${theme.contentBorder} ${theme.contentShadow}` : "bg-white border-slate-100")}>
      <div className="p-8 text-center">
        <div className={cn("text-[12px] font-black uppercase tracking-[0.4em] mb-6", theme ? "text-white" : "text-slate-800")}>{title}</div>
        <div className={cn("text-8xl font-black mb-8 font-mono tracking-tighter", theme ? "text-white" : mainColor)}>
          {area.percentage.toFixed(1)}%
        </div>
        
        {/* Visual Representation of Levels */}
        <div className="flex justify-center mb-10">
          <div className={cn(
            "w-20 h-28 border-2 rounded-sm p-1 flex flex-col-reverse gap-1 transition-colors duration-500", 
            theme ? `border-zinc-700 bg-black/40` : "border-slate-100 bg-slate-50"
          )}>
            {[1, 2, 3, 4, 5, 6].map((lvl) => {
              const isFilled = (area.percentage / (100/6)) >= lvl;
              
              let barColor = theme ? "bg-white" : "bg-slate-900"; // Revertendo para barra branca sobre fundo preto sólido
              if (filledCount === 4) barColor = "bg-yellow-500";
              else if (filledCount === 5) barColor = "bg-orange-500";
              else if (filledCount >= 6) barColor = "bg-red-500";

              return (
                <div 
                  key={lvl} 
                  className={cn(
                    "flex-1 rounded-sm transition-all duration-1000",
                    isFilled ? barColor : (theme ? "bg-zinc-900/30" : "bg-white")
                  )}
                />
              );
            })}
          </div>
        </div>

        <div className={cn(
          "inline-flex items-center gap-2 px-5 py-2 rounded-full border transition-colors duration-500", 
          theme ? `border-zinc-700 bg-black/40` : "border-slate-100 bg-slate-50"
        )}>
          <div className={cn("w-2 h-2 rounded-full", theme ? "bg-zinc-100" : "bg-slate-900")} />
          <span className={cn("text-[9px] font-bold uppercase tracking-widest", theme ? "text-black" : "text-slate-500")}>{subtitle}</span>
        </div>
      </div>

      <div className={cn("mt-auto grid grid-cols-4 transition-all duration-500", theme ? `text-zinc-100 select-none` : "border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/50")}>
        <div className="p-5 text-center">
          <div className={cn("text-[9px] font-black uppercase tracking-widest mb-2", theme ? "text-white" : "text-slate-900")}>Ocup.</div>
          <div className={cn("text-xl font-black font-mono leading-none", mainColor)}>{(area.occupied || 0).toLocaleString()}</div>
        </div>
        <div className="p-5 text-center">
          <div className={cn("text-[9px] font-black uppercase tracking-widest mb-2", theme ? "text-white" : "text-slate-900")}>Disp.</div>
          <div className={cn("text-xl font-black font-mono leading-none", theme ? "text-white" : "text-slate-900")}>{(area.disponivel || 0).toLocaleString()}</div>
        </div>
        <div className="p-5 text-center">
          <div className={cn("text-[9px] font-black uppercase tracking-widest mb-2", theme ? "text-white" : "text-slate-900")}>Bloq.</div>
          <div className={cn("text-xl font-black font-mono leading-none", theme ? "text-white" : "text-slate-900")}>{((area.definitivo || 0) + (area.operacional || 0)).toLocaleString()}</div>
        </div>
        <div className="p-5 text-center">
          <div className={cn("text-[9px] font-black uppercase tracking-widest mb-2", theme ? "text-white" : "text-slate-900")}>Total</div>
          <div className={cn("text-xl font-black font-mono leading-none", theme ? "text-white" : "text-slate-900")}>{(area.addresses || 0).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};

const AlertCard = ({ sub, theme }: { sub: OccupancyMetric, theme?: any }) => {
  const percentage = sub.percentage;
  let statusColor = "text-slate-400";
  let barColor = "bg-slate-200";
  let cardBorder = theme ? "border-transparent" : "border-slate-100";
  let cardBg = theme ? theme.contentBg : "bg-white";
  let cardShadow = theme ? theme.contentShadow : "";
  
  if (percentage >= 90) {
    statusColor = "text-red-500";
    barColor = "bg-red-500";
    if (theme) {
      cardBorder = "border-red-500/40";
      cardShadow = "shadow-[0_0_20px_rgba(239,68,68,0.2)]";
    } else {
      cardBorder = "border-red-200";
      cardBg = "bg-red-50";
    }
  } else if (percentage >= 80) {
    statusColor = "text-orange-500";
    barColor = "bg-orange-500";
    if (theme) {
      cardBorder = "border-orange-500/40";
      cardShadow = "shadow-[0_0_20px_rgba(249,115,22,0.2)]";
    } else {
      cardBorder = "border-orange-200";
      cardBg = "bg-orange-50";
    }
  } else if (percentage >= 70) {
    statusColor = "text-yellow-500";
    barColor = "bg-yellow-500";
    if (theme) {
      cardBorder = "border-yellow-500/40";
      cardShadow = "shadow-[0_0_20px_rgba(234,179,8,0.2)]";
    } else {
      cardBorder = "border-yellow-200";
      cardBg = "bg-yellow-50";
    }
  }

  return (
    <div className={cn(
      "rounded-2xl p-6 transition-all duration-500 backdrop-blur-md flex flex-col space-y-6 border", 
      cardBg, 
      cardBorder, 
      cardShadow
    )}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h4 className={cn("text-[9px] font-black uppercase tracking-[0.2em]", theme ? "text-yellow-400" : "text-slate-400")}>{sub.area}</h4>
          <div className={cn("text-xl font-black font-mono", (percentage >= 70) ? statusColor : (theme ? theme.contentTitle : statusColor))}>{percentage.toFixed(1)}%</div>
        </div>
        <div className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider", theme ? "bg-white/5 text-black" : "bg-slate-50 text-slate-500")}>
          {sub.occupied.toLocaleString()} / {sub.addresses.toLocaleString()}
        </div>
      </div>
      
      <div className={cn("h-1.5 w-full rounded-full overflow-hidden", theme ? "bg-zinc-800" : "bg-slate-100")}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          className={cn("h-full transition-all duration-1000", barColor)} 
        />
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        <div className={cn("rounded-xl p-3 text-center transition-colors duration-500", theme ? "bg-black/10" : "border border-slate-100 bg-slate-50/50")}>
          <div className={cn("text-[7px] uppercase font-black mb-1", theme ? "text-black" : "opacity-50")}>Total</div>
          <div className={cn("text-sm font-black", theme ? "text-slate-600" : "text-slate-900")}>{sub.addresses.toLocaleString()}</div>
        </div>
        <div className={cn("rounded-xl p-3 text-center transition-colors duration-500", theme ? "bg-black/10" : "border border-slate-100 bg-slate-50/50")}>
          <div className={cn("text-[7px] uppercase font-black mb-1", theme ? "text-black" : "opacity-50")}>Ocup.</div>
          <div className="text-sm font-black text-orange-600">{sub.occupied.toLocaleString()}</div>
        </div>
        <div className={cn("rounded-xl p-3 text-center transition-colors duration-500", theme ? "bg-black/10" : "border border-slate-100 bg-slate-50/50")}>
          <div className={cn("text-[7px] uppercase font-black mb-1", theme ? "text-black" : "opacity-50")}>Bloq.</div>
          <div className="text-sm font-black text-rose-600">{(sub.definitivo + sub.operacional).toLocaleString()}</div>
        </div>
        <div className={cn("rounded-xl p-3 text-center transition-colors duration-500", theme ? "bg-black/10" : "border border-slate-100 bg-slate-50/50")}>
          <div className={cn("text-[7px] uppercase font-black mb-1", theme ? "text-black" : "opacity-50")}>Livre</div>
          <div className="text-sm font-black text-emerald-600">{sub.disponivel.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};

const InventarioGeralView = ({ data, theme }: { data: InventarioGTData | undefined, theme: any }) => {
  const [activeTab, setActiveTab] = useState<'geral' | 'fefo' | 'analise_geral'>('geral');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFefoSubTab, setActiveFefoSubTab] = useState<'perda' | 'pre_perda' | 'fefo' | 'pre_fefo'>('perda');
  const [fefoSearch, setFefoSearch] = useState('');
  const [rankSearch, setRankSearch] = useState('');

  if (!data) {
    return (
      <div className={cn("min-h-[400px] flex flex-col items-center justify-center p-12 text-center rounded-3xl border", theme.contentBg, theme.contentBorder)}>
        <FileSpreadsheet className="w-12 h-12 text-zinc-500 mb-4 animate-pulse" />
        <p className="text-zinc-500 font-medium">Dados do Inventário Geral não encontrados na planilha.</p>
        <p className="text-zinc-500 text-xs mt-2">Certifique-se de que a aba "INVENTARIO GT" existe na planilha vinculada e possui colunas de SKU, Endereço e Área válidas.</p>
      </div>
    );
  }

  // Filtragem dos itens na aba Geral
  const filteredItems = data.items.filter(item => 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Retorna a lista correspondente a cada categoria do FEFO
  const getSubTabCategoryName = (tab: 'perda' | 'pre_perda' | 'fefo' | 'pre_fefo') => {
    switch (tab) {
      case 'perda': return 'PERDA';
      case 'pre_perda': return 'PRÉ PERDA';
      case 'fefo': return 'FEFO';
      case 'pre_fefo': return 'PRÉ FEFO';
    }
  };

  const getSubFefoItems = (tab: 'perda' | 'pre_perda' | 'fefo' | 'pre_fefo') => {
    const originalCategory = getSubTabCategoryName(tab);
    
    interface GroupedFefoItem {
      sku: string;
      description: string;
      valueBR: number;
      expirationDate: string;
      daysRemaining: number;
      addresses: string[];
      category: string;
    }
    
    const grouped: { [sku: string]: GroupedFefoItem } = {};
    
    data.items.forEach(item => {
      if (item.category !== originalCategory) return;
      
      const existing = grouped[item.sku];
      const addr = item.address ? item.address.trim() : '';
      
      if (existing) {
        existing.valueBR += (item.valueBR || 0);
        if (addr && !existing.addresses.includes(addr)) {
          existing.addresses.push(addr);
        }
        // Keep the earliest daysRemaining and expiration date
        if (item.daysRemaining !== null && (existing.daysRemaining === 999 || item.daysRemaining < existing.daysRemaining)) {
          existing.daysRemaining = item.daysRemaining;
          existing.expirationDate = item.expirationDate;
        }
      } else {
        grouped[item.sku] = {
          sku: item.sku,
          description: item.description || '',
          valueBR: item.valueBR || 0,
          expirationDate: item.expirationDate,
          daysRemaining: item.daysRemaining !== null ? item.daysRemaining : 999,
          addresses: addr ? [addr] : [],
          category: item.category
        };
      }
    });
    
    return Object.values(grouped)
      .filter(item => 
        item.sku.toLowerCase().includes(fefoSearch.toLowerCase()) || 
        item.description.toLowerCase().includes(fefoSearch.toLowerCase()) ||
        item.addresses.some(a => a.toLowerCase().includes(fefoSearch.toLowerCase()))
      )
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  };

  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) {
      return 'R$ 0,00';
    }
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Coleta os itens mais próximos de vencer de forma global para compor o alerta rápido
  const globalAlerts = [...data.items]
    .filter(item => item.daysRemaining !== null && item.daysRemaining <= 90)
    .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Abas Principais */}
      <div className="flex flex-wrap gap-2 p-1 bg-black/20 rounded-2xl w-fit border border-white/5">
        <button
          onClick={() => setActiveTab('geral')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer",
            activeTab === 'geral' 
              ? theme.active 
              : "text-zinc-300 hover:text-white hover:bg-white/5"
          )}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('fefo')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer",
            activeTab === 'fefo' 
              ? theme.active 
              : "text-zinc-300 hover:text-white hover:bg-white/5"
          )}
        >
          Situação
        </button>
        <button
          onClick={() => setActiveTab('analise_geral')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer",
            activeTab === 'analise_geral' 
              ? theme.active 
              : "text-zinc-300 hover:text-white hover:bg-white/5"
          )}
        >
          Análise Geral da Situação
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'geral' ? (
          <motion.div 
            key="geral"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className={cn("p-8 rounded-3xl border shadow-xl flex flex-col items-center text-center transition-all", theme.contentBg, theme.contentBorder)}>
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border", theme.primary === 'blue' ? "bg-white/20 border-white/30" : "bg-blue-500/10 border-blue-500/20")}>
                  <Box className={cn("w-8 h-8", theme.primary === 'blue' ? "text-white" : "text-blue-500")} />
                </div>
                <h3 className={cn("text-xl font-bold mb-2", theme.contentTitle)}>TOTAL DE SKU´S</h3>
                <div className={cn("text-6xl font-black mb-2", theme.contentTitle)}>
                  {(data.uniqueSKUCount || 0).toLocaleString()}
                </div>
              </div>
              
              <div className={cn("p-8 rounded-3xl border shadow-xl flex flex-col items-center text-center transition-all lg:col-span-2", theme.contentBg, theme.contentBorder)}>
                 <div className="w-full flex flex-col md:flex-row justify-between items-center gap-6">
                   <div className="text-left">
                      <h2 className={cn("text-2xl font-black uppercase tracking-wider mb-1", theme.contentTitle)}>Análise de Itens</h2>
                      <p className={cn("text-xs font-semibold", theme.primary === 'blue' ? "text-blue-50" : "text-zinc-300")}>Filtro por SKU ou Descrição para listagem detalhada.</p>
                   </div>
                   <div className="relative w-full max-w-sm">
                      <input 
                        type="text" 
                        placeholder="Pesquisar SKU ou Descrição..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={cn(
                          "w-full border rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 transition-all",
                          theme.primary === 'blue' 
                            ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 ring-white/30" 
                            : "bg-black/20 border border-white/10 text-white ring-blue-500/50"
                        )}
                      />
                   </div>
                 </div>
              </div>
            </div>

            {/* Items Table */}
            <div className={cn("rounded-3xl border shadow-2xl overflow-hidden transition-all duration-500", theme.contentBg, theme.contentBorder)}>
              <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr className={cn("border-b transition-all duration-500", theme.primary === 'blue' ? "bg-blue-800 border-white/10" : "bg-[#111] border-white/5")}>
                      <th className={cn("px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]", theme.primary === 'blue' ? "text-blue-50" : "text-zinc-200")}>SKU</th>
                      <th className={cn("px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]", theme.primary === 'blue' ? "text-blue-50" : "text-zinc-200")}>Descrição do Produto</th>
                      <th className={cn("px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-right", theme.primary === 'blue' ? "text-blue-50" : "text-zinc-200")}>Shelf Life (AL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredItems.slice(0, 500).map((item, idx) => (
                      <tr key={`${item.sku}-${idx}`} className="hover:bg-white/5 transition-colors group">
                        <td className={cn("px-6 py-4 text-xs font-bold font-mono", theme.contentTitle)}>{item.sku}</td>
                        <td className={cn("px-6 py-4 text-xs font-medium group-hover:text-white transition-colors", theme.primary === 'blue' ? "text-blue-50" : "text-zinc-300")}>{item.description}</td>
                        <td className="px-6 py-4 text-xs font-bold text-right text-emerald-400 font-mono">
                          {item.shelfLifeAL || 'N/A'}
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-zinc-300 italic text-sm font-semibold">
                          Nenhum item encontrado para a pesquisa.
                        </td>
                      </tr>
                    )}
                    {filteredItems.length > 500 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-zinc-300 text-[10px] font-bold uppercase tracking-widest bg-zinc-950/50">
                          Mostrando os primeiros 500 itens de {filteredItems.length}. Use a pesquisa para filtrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'fefo' ? (
          <motion.div 
            key="fefo"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Bloco de Alertas Rápidos (Sempre com os mais próximos de vencer) */}
            <div className="bg-slate-950 p-6 rounded-3xl border border-rose-500/30 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-rose-300">Painel de Alertas FEFO Críticos</h3>
                  <p className="text-[11px] text-zinc-200 font-extrabold uppercase">Estes são os produtos mais próximos de vencer globalmente no inventário geral</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {globalAlerts.map((item, idx) => {
                   const rem = item.daysRemaining || 0;
                   let colorClass = "text-rose-200 border-rose-500/40 bg-rose-950/70 shadow-[0_0_10px_rgba(244,63,94,0.2)]";
                   let cardBg = "bg-slate-900 border border-rose-500/30 shadow-lg shadow-rose-950/20"; let valStyle = "text-rose-200 bg-rose-950/80 border border-rose-500/50 px-2.5 py-1 rounded-xl font-mono text-xs font-black animate-pulse";
                   if (rem > 60) {
                     colorClass = "text-sky-200 border-sky-500/40 bg-sky-950/70 shadow-[0_0_10px_rgba(14,165,233,0.2)]";
                     cardBg = "bg-slate-900 border border-sky-500/30 shadow-lg shadow-sky-950/20"; valStyle = "text-sky-200 bg-sky-950/80 border border-sky-500/50 px-2.5 py-1 rounded-xl font-mono text-xs font-black";
                   } else if (rem > 30) {
                     colorClass = "text-amber-200 border-amber-500/40 bg-amber-950/70 shadow-[0_0_10px_rgba(245,158,11,0.2)]";
                     cardBg = "bg-slate-900 border border-amber-500/30 shadow-lg shadow-amber-950/20"; valStyle = "text-amber-200 bg-amber-950/80 border border-amber-500/50 px-2.5 py-1 rounded-xl font-mono text-xs font-black";
                   } else if (rem > 15) {
                     colorClass = "text-orange-200 border-orange-500/40 bg-orange-950/70 shadow-[0_0_10px_rgba(249,115,22,0.2)]";
                     cardBg = "bg-slate-900 border border-orange-500/30 shadow-lg shadow-orange-950/20"; valStyle = "text-orange-200 bg-orange-950/80 border border-orange-500/50 px-2.5 py-1 rounded-xl font-mono text-xs font-black";
                   }

                   return (
                     <div key={`${item.sku}-${idx}`} className={cn("p-4 rounded-2xl border flex flex-col justify-between transition-all hover:scale-[1.02] duration-300", cardBg)}>
                       <div>
                         <div className="flex justify-between items-start gap-2 mb-2">
                           <span className="font-mono text-xs font-black text-white">{item.sku}</span>
                           <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border", colorClass)}>
                             {item.category}
                           </span>
                         </div>
                         <p className="text-[10px] text-zinc-200 font-bold truncate mb-3" title={item.description}>
                           {item.description}
                         </p>
                       </div>

                       <div className="border-t border-white/5 pt-3 mt-1 space-y-2">
                         <div className="flex justify-between text-[9px] font-bold text-zinc-300">
                           <span>POSIÇÃO:</span>
                           <span className="font-black text-cyan-300 font-mono">{item.address || 'N/A'}</span>
                         </div>
                         <div className="flex justify-between text-[9px] font-bold text-zinc-300">
                           <span>VALOR BR:</span>
                           <span className="font-black text-emerald-300 font-mono">{formatCurrency(item.valueBR)}</span>
                         </div>
                         <div className="flex justify-between text-[9px] font-bold text-zinc-300">
                           <span>VENCIMENTO:</span>
                           <span className="font-black text-zinc-100 font-mono">{item.expirationDate}</span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] font-black pt-1">
                           <span className="text-zinc-200">VALIDADE:</span>
                           <span className={valStyle}>
                             {rem} d
                           </span>
                         </div>
                       </div>
                     </div>
                   );
                })}
                {globalAlerts.length === 0 && (
                  <div className="col-span-full py-6 text-center text-zinc-300 text-xs italic uppercase tracking-wider">
                    Nenhum item com vencimento ≤ 90 dias registrado.
                  </div>
                )}
              </div>
            </div>

            {/* Abas Secundárias de Categorias */}
            <div className="grid grid-cols-2 md:grid-cols-4 p-1.5 bg-black/40 rounded-2xl border border-white/5 gap-1.5 shadow-lg">
              {(['perda', 'pre_perda', 'fefo', 'pre_fefo'] as const).map((tab) => {
                const count = getSubFefoItems(tab).length;
                let activeStyle = "bg-rose-500/30 text-rose-300 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]";
                if (tab === 'pre_fefo') activeStyle = "bg-sky-500/30 text-sky-300 border border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.15)]";
                else if (tab === 'fefo') activeStyle = "bg-amber-500/30 text-amber-300 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]";
                else if (tab === 'pre_perda') activeStyle = "bg-orange-500/30 text-orange-300 border border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)]";

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveFefoSubTab(tab)}
                    className={cn(
                      "px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer",
                      activeFefoSubTab === tab 
                        ? activeStyle 
                        : "text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <span>{tab === 'perda' ? 'PERDA (≤15d)' : tab === 'pre_perda' ? 'PRÉ PERDA (16-30d)' : tab === 'fefo' ? 'FEFO (31-60d)' : 'PRÉ FEFO (61-90d)'}</span>
                    <span className="text-xs font-serif opacity-85">({count} itens)</span>
                  </button>
                );
              })}
            </div>

            {/* Linha de Filtro da Categoria Selecionada */}
            <div className={cn("p-6 rounded-3xl border shadow-xl transition-all", theme.contentBg, theme.contentBorder)}>
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h3 className={cn("text-lg font-black uppercase tracking-wider mb-1", theme.contentTitle)}>
                    {activeFefoSubTab === 'perda' ? 'Itens em Perda Imediata' : activeFefoSubTab === 'pre_perda' ? 'Itens em Pré Perda' : activeFefoSubTab === 'fefo' ? 'Itens em Zona FEFO' : 'Itens em Zona Pré FEFO'}
                  </h3>
                  <p className="text-xs text-zinc-300 font-semibold">Visualizando SKUs filtrados com seus respectivos dias para progredir de critério.</p>
                </div>
                <div className="relative w-full max-w-sm">
                  <input 
                    type="text" 
                    placeholder={`Filtrar listagem de ${getSubTabCategoryName(activeFefoSubTab)}...`}
                    value={fefoSearch}
                    onChange={(e) => setFefoSearch(e.target.value)}
                    className={cn(
                      "w-full border rounded-xl px-5 py-3 text-xs focus:outline-none focus:ring-2 transition-all",
                      theme.primary === 'blue' 
                        ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 ring-white/30" 
                        : "bg-black/20 border border-white/10 text-white ring-blue-500/50"
                    )}
                  />
                  <Search className="absolute right-4 top-3.5 w-4 h-4 text-zinc-300" />
                </div>
              </div>
            </div>

            {/* Listagem de Itens da Categoria */}
            <div className="grid grid-cols-1 gap-6">
              <div className={cn("p-6 rounded-3xl border shadow-2xl overflow-hidden", theme.contentBg, theme.contentBorder)}>
                <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={cn("border-b border-white/10", theme.primary === 'blue' ? "bg-blue-800" : "bg-[#090909]")}>
                        <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-100">SKU / Descrição</th>
                        <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-center">Posição (B)</th>
                        <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-right">Valor BR</th>
                        <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-right">Data Validade</th>
                        <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-right">Contagem Regressiva</th>
                        <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-center">Dias para o Próximo Critério</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {getSubFefoItems(activeFefoSubTab).map((item, idx) => {
                        const days = item.daysRemaining || 0;
                        
                        // Cálculo dos dias para entrar em cada critério
                        const daysToFefo = days > 60 ? `${days - 60}d` : <span className="text-emerald-300 font-black bg-emerald-950/50 border border-emerald-800/30 px-2 py-0.5 rounded-lg">Atingido (≤60d)</span>;
                        const daysToPrePreda = days > 30 ? `${days - 30}d` : <span className="text-amber-300 font-black bg-amber-950/50 border border-amber-800/30 px-2 py-0.5 rounded-lg">Atingido (≤30d)</span>;
                        const daysToPerda = days > 15 ? `${days - 15}d` : <span className="text-rose-300 font-black bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded-lg animate-pulse">Crítico (≤15d)</span>;

                        return (
                          <tr key={`${item.sku}-${idx}`} className="hover:bg-white/5 transition-colors group">
                            <td className="px-4 py-4 min-w-[200px]">
                              <div className={cn("text-sm font-black font-mono leading-none", theme.contentTitle)}>{item.sku}</div>
                              <div className="text-[10px] font-extrabold text-zinc-200 mt-1 truncate max-w-sm" title={item.description}>{item.description}</div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex flex-wrap gap-1 justify-center max-w-[220px] mx-auto">
                                {item.addresses && item.addresses.length > 0 ? (
                                  item.addresses.map((addr, aIdx) => (
                                    <span key={aIdx} className="font-mono text-[10px] font-black text-cyan-300 bg-cyan-950/45 border border-cyan-500/30 px-2 py-0.5 rounded-lg shadow-sm">
                                      {addr}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-zinc-500 italic text-xs">N/A</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="font-mono text-xs font-black text-emerald-400">
                                {formatCurrency(item.valueBR)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="font-bold text-zinc-200 font-mono">
                                {item.expirationDate}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right whitespace-nowrap">
                              <span className={cn(
                                "text-xs font-black font-mono px-2.5 py-1 rounded-xl border",
                                days <= 15 ? "text-rose-200 bg-rose-950/50 border-rose-800/50" : 
                                days <= 30 ? "text-orange-200 bg-orange-950/50 border-orange-800/50" : 
                                days <= 60 ? "text-amber-200 bg-amber-950/50 border-amber-800/50" : 
                                "text-sky-200 bg-sky-950/50 border-sky-800/50"
                              )}>
                                {days} dias
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-1 text-[10px] text-zinc-200 font-bold justify-center items-center font-mono">
                                <div className="flex w-full max-w-[200px] justify-between border-b border-white/5 pb-0.5">
                                  <span>PERDA:</span>
                                  <span className="font-black text-white">{daysToPerda}</span>
                                </div>
                                <div className="flex w-full max-w-[200px] justify-between border-b border-white/5 pb-0.5">
                                  <span>PRÉ PERDA:</span>
                                  <span className="font-black text-white">{daysToPrePreda}</span>
                                </div>
                                <div className="flex w-full max-w-[200px] justify-between">
                                  <span>FEFO:</span>
                                  <span className="font-black text-white">{daysToFefo}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {getSubFefoItems(activeFefoSubTab).length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-xs text-zinc-500 font-extrabold uppercase tracking-widest">
                            Nenhum item encontrado nesta categoria de vencimento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="analise_geral"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {(() => {
              // Agrupar itens por SKU e Categoria para somar tudo que o SKU possui em cada critério
              interface AggregatedValue {
                sku: string;
                description: string;
                valueBR: number;
                daysRemaining: number;
                category: string;
                addresses: string[];
                occurrences: number;
              }

              const aggregatedItemsMap: { [key: string]: AggregatedValue } = {};

              data.items.forEach(item => {
                if (item.category === 'NORMAL') return;
                const key = `${item.sku}-${item.category}`;
                const existing = aggregatedItemsMap[key];
                const addr = item.address ? item.address.trim() : '';
                if (existing) {
                  existing.valueBR += (item.valueBR || 0);
                  if (item.daysRemaining !== undefined && item.daysRemaining < existing.daysRemaining) {
                    existing.daysRemaining = item.daysRemaining;
                  }
                  if (addr && !existing.addresses.includes(addr)) {
                    existing.addresses.push(addr);
                  }
                  existing.occurrences += 1;
                } else {
                  aggregatedItemsMap[key] = {
                    sku: item.sku,
                    description: item.description || '',
                    valueBR: item.valueBR || 0,
                    daysRemaining: item.daysRemaining !== undefined ? item.daysRemaining : 999,
                    category: item.category,
                    addresses: addr ? [addr] : [],
                    occurrences: 1
                  };
                }
              });

              const aggregatedItems = Object.keys(aggregatedItemsMap).map(key => {
                const item = aggregatedItemsMap[key];
                return {
                  sku: item.sku,
                  description: item.description,
                  valueBR: item.valueBR,
                  daysRemaining: item.daysRemaining === 999 ? 0 : item.daysRemaining,
                  category: item.category,
                  address: item.addresses.filter(Boolean).join(', '),
                  occurrences: item.occurrences
                };
              });

              const countPerda = aggregatedItems.filter(item => item.category === 'PERDA').length;
              const sumPerda = aggregatedItems.filter(item => item.category === 'PERDA').reduce((acc, item) => acc + item.valueBR, 0);

              const countPrePerda = aggregatedItems.filter(item => item.category === 'PRÉ PERDA').length;
              const sumPrePerda = aggregatedItems.filter(item => item.category === 'PRÉ PERDA').reduce((acc, item) => acc + item.valueBR, 0);

              const countFefo = aggregatedItems.filter(item => item.category === 'FEFO').length;
              const sumFefo = aggregatedItems.filter(item => item.category === 'FEFO').reduce((acc, item) => acc + item.valueBR, 0);

              const countPreFefo = aggregatedItems.filter(item => item.category === 'PRÉ FEFO').length;
              const sumPreFefo = aggregatedItems.filter(item => item.category === 'PRÉ FEFO').reduce((acc, item) => acc + item.valueBR, 0);

              const totalRiskCount = countPerda + countPrePerda + countFefo + countPreFefo;
              const totalRiskValue = sumPerda + sumPrePerda + sumFefo + sumPreFefo;

              const getTop10 = (cat: 'PERDA' | 'PRÉ PERDA' | 'FEFO' | 'PRÉ FEFO') => {
                return [...aggregatedItems]
                  .filter(item => item.category === cat)
                  .sort((a, b) => b.valueBR - a.valueBR)
                  .slice(0, 10);
              };

              const allRanked = [...aggregatedItems]
                .sort((a, b) => b.valueBR - a.valueBR);

              const filteredRanked = allRanked.filter(item =>
                item.sku.toLowerCase().includes(rankSearch.toLowerCase()) ||
                item.description.toLowerCase().includes(rankSearch.toLowerCase()) ||
                item.category.toLowerCase().includes(rankSearch.toLowerCase()) ||
                item.address.toLowerCase().includes(rankSearch.toLowerCase())
              );

              return (
                <div className="space-y-6">
                  {/* Summary / Header info */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-3xl border border-white/5 shadow-xl">
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-wider text-white">Análise Geral da Situação</h2>
                      <p className="text-xs text-zinc-300 font-medium">Consolidado financeiro e de criticidade por situação de vencimento do inventário.</p>
                    </div>
                    <div className="bg-slate-950 px-5 py-3 rounded-2xl border border-white/5 flex flex-col items-end">
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Total Acumulado Sob Risco</span>
                      <span className="text-xl font-black text-emerald-400 font-mono">{formatCurrency(totalRiskValue)}</span>
                      <span className="text-[10px] text-zinc-300 font-bold">{totalRiskCount} SKUs no total</span>
                    </div>
                  </div>

                  {/* 4 Cards Grid with the Requested Summary of each Situation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card PERDA */}
                    <div className="p-5 rounded-2xl border bg-slate-900 border-rose-500/20 shadow-lg hover:border-rose-500/40 transition-all duration-300">
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-rose-950/70 text-rose-300 border border-rose-500/40 animate-pulse">
                          PERDA (≤15d)
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Valor Somado</div>
                        <div className="text-xl font-black text-rose-300 font-mono">{formatCurrency(sumPerda)}</div>
                        <div className="text-xs font-bold text-zinc-300">{countPerda} produtos em perda imediata</div>
                      </div>
                    </div>

                    {/* Card PRÉ PERDA */}
                    <div className="p-5 rounded-2xl border bg-slate-900 border-orange-500/20 shadow-lg hover:border-orange-500/40 transition-all duration-300">
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-orange-950/70 text-orange-300 border border-orange-500/40">
                          PRÉ PERDA (16-30d)
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-orange-400" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Valor Somado</div>
                        <div className="text-xl font-black text-orange-300 font-mono">{formatCurrency(sumPrePerda)}</div>
                        <div className="text-xs font-bold text-zinc-300">{countPrePerda} produtos em atenção</div>
                      </div>
                    </div>

                    {/* Card FEFO */}
                    <div className="p-5 rounded-2xl border bg-slate-900 border-amber-500/20 shadow-lg hover:border-amber-500/40 transition-all duration-300">
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-950/70 text-amber-300 border border-amber-500/40">
                          FEFO (31-60d)
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Filter className="w-4 h-4 text-amber-400" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Valor Somado</div>
                        <div className="text-xl font-black text-amber-300 font-mono">{formatCurrency(sumFefo)}</div>
                        <div className="text-xs font-bold text-zinc-300">{countFefo} produtos na zona de giro</div>
                      </div>
                    </div>

                    {/* Card PRÉ FEFO */}
                    <div className="p-5 rounded-2xl border bg-slate-900 border-sky-500/20 shadow-lg hover:border-sky-500/40 transition-all duration-300">
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-sky-950/70 text-sky-300 border border-sky-500/40">
                          PRÉ FEFO (61-90d)
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-sky-400" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Valor Somado</div>
                        <div className="text-xl font-black text-sky-300 font-mono">{formatCurrency(sumPreFefo)}</div>
                        <div className="text-xs font-bold text-zinc-300">{countPreFefo} produtos monitorados</div>
                      </div>
                    </div>
                  </div>

                  {/* ALERTA FINANCEIRO: TOP 10 MAIS VALIOSOS POR SITUAÇÃO */}
                  <div className="bg-slate-950/70 p-6 rounded-3xl border border-rose-500/20 shadow-2xl relative overflow-hidden space-y-4">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-rose-300">Painel de Alertas Críticos (Top 10 por Situação)</h3>
                        <p className="text-[11px] text-zinc-300 font-bold uppercase">Produtos de maior valor financeiro sob risco imediato em cada categoria</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
                      {/* Top 10 Perda */}
                      <div className="bg-slate-900/60 rounded-2xl border border-rose-500/20 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
                            <span className="text-[11px] font-black text-rose-300 uppercase tracking-wider">Top 10 Perda (≤15d)</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/30 text-rose-300 font-mono">
                              R$ {sumPerda > 0 ? getTop10('PERDA').reduce((sum, item) => sum + item.valueBR, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {getTop10('PERDA').map((item, idx) => (
                              <div key={`${item.sku}-${idx}`} className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/10 hover:bg-rose-950/40 transition-colors flex justify-between items-center text-[10px] font-medium text-zinc-200">
                                <div className="truncate max-w-[110px]" title={item.description}>
                                  <span className="font-bold text-white font-mono block text-[11px]">{item.sku}</span>
                                  <span className="text-zinc-400 block text-[9px] truncate">{item.description}</span>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="font-black text-emerald-300 font-mono text-[11px]">{formatCurrency(item.valueBR)}</span>
                                  <span className="text-[9px] font-black text-rose-300">{item.daysRemaining} dias</span>
                                </div>
                              </div>
                            ))}
                            {getTop10('PERDA').length === 0 && (
                              <div className="text-center py-8 text-zinc-500 text-[10px] uppercase font-bold tracking-widest italic">Sem registros</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top 10 Pré Perda */}
                      <div className="bg-slate-900/60 rounded-2xl border border-orange-500/20 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-orange-500/20 pb-2 mb-3">
                            <span className="text-[11px] font-black text-orange-300 uppercase tracking-wider">Top 10 Pré Perda (16-30d)</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-orange-950/60 border border-orange-500/30 text-orange-300 font-mono">
                              R$ {sumPrePerda > 0 ? getTop10('PRÉ PERDA').reduce((sum, item) => sum + item.valueBR, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {getTop10('PRÉ PERDA').map((item, idx) => (
                              <div key={`${item.sku}-${idx}`} className="p-2 rounded-lg bg-orange-950/20 border border-orange-500/10 hover:bg-orange-950/40 transition-colors flex justify-between items-center text-[10px] font-medium text-zinc-200">
                                <div className="truncate max-w-[110px]" title={item.description}>
                                  <span className="font-bold text-white font-mono block text-[11px]">{item.sku}</span>
                                  <span className="text-zinc-400 block text-[9px] truncate">{item.description}</span>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="font-black text-emerald-300 font-mono text-[11px]">{formatCurrency(item.valueBR)}</span>
                                  <span className="text-[9px] font-black text-orange-300">{item.daysRemaining} dias</span>
                                </div>
                              </div>
                            ))}
                            {getTop10('PRÉ PERDA').length === 0 && (
                              <div className="text-center py-8 text-zinc-500 text-[10px] uppercase font-bold tracking-widest italic">Sem registros</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top 10 FEFO */}
                      <div className="bg-slate-900/60 rounded-2xl border border-amber-500/20 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-3">
                            <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">Top 10 FEFO (31-60d)</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300 font-mono">
                              R$ {sumFefo > 0 ? getTop10('FEFO').reduce((sum, item) => sum + item.valueBR, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {getTop10('FEFO').map((item, idx) => (
                              <div key={`${item.sku}-${idx}`} className="p-2 rounded-lg bg-amber-950/20 border border-amber-500/10 hover:bg-amber-950/40 transition-colors flex justify-between items-center text-[10px] font-medium text-zinc-200">
                                <div className="truncate max-w-[110px]" title={item.description}>
                                  <span className="font-bold text-white font-mono block text-[11px]">{item.sku}</span>
                                  <span className="text-zinc-400 block text-[9px] truncate">{item.description}</span>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="font-black text-emerald-300 font-mono text-[11px]">{formatCurrency(item.valueBR)}</span>
                                  <span className="text-[9px] font-black text-amber-300">{item.daysRemaining} dias</span>
                                </div>
                              </div>
                            ))}
                            {getTop10('FEFO').length === 0 && (
                              <div className="text-center py-8 text-zinc-500 text-[10px] uppercase font-bold tracking-widest italic">Sem registros</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top 10 Pré FEFO */}
                      <div className="bg-slate-900/60 rounded-2xl border border-sky-500/20 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-sky-500/20 pb-2 mb-3">
                            <span className="text-[11px] font-black text-sky-300 uppercase tracking-wider">Top 10 Pré FEFO (61-90d)</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/30 text-sky-300 font-mono">
                              R$ {sumPreFefo > 0 ? getTop10('PRÉ FEFO').reduce((sum, item) => sum + item.valueBR, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {getTop10('PRÉ FEFO').map((item, idx) => (
                              <div key={`${item.sku}-${idx}`} className="p-2 rounded-lg bg-sky-950/20 border border-sky-500/10 hover:bg-sky-950/40 transition-colors flex justify-between items-center text-[10px] font-medium text-zinc-200">
                                <div className="truncate max-w-[110px]" title={item.description}>
                                  <span className="font-bold text-white font-mono block text-[11px]">{item.sku}</span>
                                  <span className="text-zinc-400 block text-[9px] truncate">{item.description}</span>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="font-black text-emerald-300 font-mono text-[11px]">{formatCurrency(item.valueBR)}</span>
                                  <span className="text-[9px] font-black text-sky-300">{item.daysRemaining} dias</span>
                                </div>
                              </div>
                            ))}
                            {getTop10('PRÉ FEFO').length === 0 && (
                              <div className="text-center py-8 text-zinc-500 text-[10px] uppercase font-bold tracking-widest italic">Sem registros</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RANKING DE VALORES DO MAIOR PARA O MENOR */}
                  <div className={cn("p-6 rounded-3xl border shadow-xl transition-all", theme.contentBg, theme.contentBorder)}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center border border-yellow-500/20">
                          <Award className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div>
                          <h3 className="text-md font-black uppercase tracking-wider text-white">Ranking de Riscos de Valores (Maior para Menor)</h3>
                          <p className="text-[11px] text-zinc-300 font-bold">Lista ordenada decrescentemente por valor financeiro (Valor BR) de todos os itens com vencimento abaixo de 90 dias.</p>
                        </div>
                      </div>
                      <div className="relative w-full max-w-sm">
                        <input 
                          type="text" 
                          placeholder="Filtrar ranking por SKU, descrição..."
                          value={rankSearch}
                          onChange={(e) => setRankSearch(e.target.value)}
                          className={cn(
                            "w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 transition-all",
                            theme.primary === 'blue' 
                              ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 ring-white/30" 
                              : "bg-black/20 border border-white/10 text-white ring-blue-500/50"
                          )}
                        />
                        <Search className="absolute right-4 top-3 w-4 h-4 text-zinc-400" />
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[500px] custom-scrollbar border border-white/5 rounded-2xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className={cn("border-b border-white/10", theme.primary === 'blue' ? "bg-blue-800" : "bg-[#090909]")}>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-center w-16">Rank</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-100">SKU / Descrição</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-center">Posição</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-center">Situação</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-center">Validade</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-100 text-right">Valor BR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredRanked.slice(0, 250).map((item, idx) => {
                            const originalIdx = allRanked.findIndex(orig => orig.sku === item.sku && orig.category === item.category);
                            const displayRank = originalIdx !== -1 ? originalIdx + 1 : idx + 1;
                            const days = item.daysRemaining || 0;

                            let badgeStyle = "text-rose-200 bg-rose-950/60 border border-rose-500/40 animate-pulse";
                            if (item.category === 'PRÉ FEFO') badgeStyle = "text-sky-200 bg-sky-950/60 border border-sky-500/40";
                            else if (item.category === 'FEFO') badgeStyle = "text-amber-200 bg-amber-950/60 border border-amber-500/40";
                            else if (item.category === 'PRÉ PERDA') badgeStyle = "text-orange-200 bg-orange-950/60 border border-orange-500/40";

                            return (
                              <tr key={`${item.sku}-${idx}`} className="hover:bg-white/5 transition-colors group">
                                <td className="px-4 py-4 text-center font-black text-zinc-300 font-mono text-xs">
                                  {displayRank <= 3 ? (
                                    <span className={cn(
                                      "inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-black",
                                      displayRank === 1 ? "bg-yellow-400" :
                                      displayRank === 2 ? "bg-zinc-300" : "bg-amber-600"
                                    )}>
                                      {displayRank}
                                    </span>
                                  ) : (
                                    <span>#{displayRank}</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 min-w-[200px]">
                                  <div className="text-xs font-black font-mono text-white leading-none">{item.sku}</div>
                                  <div className="text-[10px] text-zinc-400 font-semibold mt-1 truncate max-w-sm" title={item.description}>{item.description}</div>
                                </td>
                                <td className="px-4 py-4 text-center whitespace-nowrap">
                                  <span 
                                    title={item.address || 'N/A'}
                                    className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-cyan-300 bg-cyan-950/30 border border-cyan-800/30 px-2 py-0.5 rounded-lg max-w-[160px] truncate"
                                  >
                                    <span className="truncate">{item.address || 'N/A'}</span>
                                    {item.occurrences > 1 && (
                                      <span 
                                        className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black bg-zinc-800 text-zinc-400 rounded border border-white/5 cursor-help"
                                        title={`${item.occurrences} registros agrupados nesta categoria`}
                                      >
                                        {item.occurrences}x
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <span className={cn("px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider", badgeStyle)}>
                                    {item.category}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-center whitespace-nowrap">
                                  <span className={cn(
                                    "text-xs font-bold font-mono px-2 py-0.5 rounded-lg border",
                                    days <= 15 ? "text-rose-200 bg-rose-950/30 border-rose-800/30" : 
                                    days <= 30 ? "text-orange-200 bg-orange-950/30 border-orange-800/30" : 
                                    days <= 60 ? "text-amber-200 bg-amber-950/30 border-amber-800/30" : 
                                    "text-sky-200 bg-sky-950/30 border-sky-800/30"
                                  )}>
                                    {days} d
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <span className="font-mono text-xs font-black text-emerald-400">
                                    {formatCurrency(item.valueBR)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredRanked.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-12 text-center text-xs text-zinc-500 font-extrabold uppercase tracking-widest">
                                Nenhum registro encontrado no ranking.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const OccupancyDashboard = ({ data, theme, activeView }: { data?: OccupancyData, theme: any, activeView: 'dashboard' | 'analitico' | 'mapa' }) => {
  const [alertView, setAlertView] = useState<'categoria' | 'geral'>('categoria');

  const getOccupancyColorClasses = (pct: number) => {
    if (pct >= 90) return {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20 hover:border-rose-500/50',
      text: 'text-rose-500',
      badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      bar: 'bg-rose-500',
      glow: 'shadow-rose-500/10'
    };
    if (pct >= 80) return {
      bg: 'bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500/20 hover:border-orange-500/50',
      text: 'text-orange-500',
      badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      bar: 'bg-orange-500',
      glow: 'shadow-orange-500/10'
    };
    if (pct >= 70) return {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20 hover:border-amber-500/50',
      text: 'text-amber-500',
      badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      bar: 'bg-amber-500',
      glow: 'shadow-amber-500/10'
    };
    return {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 hover:border-emerald-500/50',
      text: 'text-emerald-500',
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      bar: 'bg-emerald-500',
      glow: 'shadow-emerald-500/10'
    };
  };

  const globalSectors = React.useMemo(() => {
    if (!data) return [];
    const sectorsToSum = [
      { id: 'MERCEARIA SECA', label: 'Mercearia Seca' },
      { id: 'BAZAR, ELETRO E TEXTIL', label: 'Bazar, Eletro e Têxtil' },
      { id: 'BEBIDAS', label: 'Bebidas' },
      { id: 'HIGIENE, SAUDE E BELEZA', label: 'Higiene, Saúde e Beleza' },
      { id: 'LIMPEZA E LAVANDERIA', label: 'Limpeza e Lavanderia' },
      { id: 'FRACIONADO', label: 'Fracionados' },
      { id: 'CONFINADO', label: 'Confinados' },
      { id: 'AEROS', label: 'Aerosol' }
    ];

    const aggregated: Record<string, OccupancyMetric> = {};

    data.areas.forEach(area => {
      // Check subcategories first as they are usually the leaf nodes
      area.subcategories?.forEach(sub => {
        const normalizedSub = sub.area.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = sectorsToSum.find(s => normalizedSub.includes(s.id) || s.id.includes(normalizedSub));
        
        if (match) {
          if (!aggregated[match.id]) {
            aggregated[match.id] = {
              area: match.label,
              structure: 0,
              addresses: 0,
              occupied: 0,
              definitivo: 0,
              operacional: 0,
              disponivel: 0,
              percentage: 0,
              isCategory: false
            };
          }
          aggregated[match.id].structure += sub.structure;
          aggregated[match.id].addresses += sub.addresses;
          aggregated[match.id].occupied += sub.occupied;
          aggregated[match.id].definitivo += sub.definitivo;
          aggregated[match.id].operacional += sub.operacional;
          aggregated[match.id].disponivel += sub.disponivel;
        }
      });

      // Also check the area itself if it doesn't have subcategories (leaf area)
      if (!area.subcategories || area.subcategories.length === 0) {
        const normalizedArea = area.area.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = sectorsToSum.find(s => normalizedArea.includes(s.id) || s.id.includes(normalizedArea));
        
        if (match) {
          if (!aggregated[match.id]) {
            aggregated[match.id] = {
              area: match.label,
              structure: 0,
              addresses: 0,
              occupied: 0,
              definitivo: 0,
              operacional: 0,
              disponivel: 0,
              percentage: 0,
              isCategory: false
            };
          }
          aggregated[match.id].structure += area.structure;
          aggregated[match.id].addresses += area.addresses;
          aggregated[match.id].occupied += area.occupied;
          aggregated[match.id].definitivo += area.definitivo;
          aggregated[match.id].operacional += area.operacional;
          aggregated[match.id].disponivel += area.disponivel;
        }
      }
    });

    return Object.values(aggregated).map(item => ({
      ...item,
      percentage: item.addresses > 0 ? (item.occupied / item.addresses) * 100 : 0
    })).sort((a, b) => b.percentage - a.percentage);
  }, [data]);

  if (!data) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "min-h-[600px] flex flex-col items-center justify-center backdrop-blur-sm rounded-3xl border shadow-2xl p-12 text-center",
          theme.bg,
          theme.border
        )}
      >
        <div className={cn("w-24 h-24 rounded-3xl flex items-center justify-center mb-8 border", `bg-${theme.primary}-500/10`, `border-${theme.primary}-500/20`)}>
          <FileSpreadsheet className={cn("w-12 h-12 animate-pulse", theme.text)} />
        </div>
        <h2 className={cn("text-3xl font-bold mb-4 uppercase tracking-wider", theme.contentTitle)}>Mapa de Ocupação</h2>
        <p className={cn("max-w-md mx-auto leading-relaxed", theme.contentText)}>
          Nenhum dado de ocupação encontrado. Certifique-se de que a planilha possui a aba <span className={cn("font-bold", theme.contentText)}>"TABELA OCUPAÇÃO CD"</span> com os dados configurados.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <AnimatePresence mode="wait">
        {activeView === 'analitico' ? (
          <motion.div 
            key="analitico"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* 1. ESTRUTURA E ENDEREÇOS */}
            <div className={cn("rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all duration-500", theme ? `${theme.contentBg} ${theme.contentBorder} ${theme.contentShadow}` : "bg-white border-slate-100")}>
              <div className={cn("p-5 border-b bg-gradient-to-r from-blue-500/10 to-transparent", theme ? theme.contentBorder : "border-slate-100")}>
                <h3 className={cn("text-xs font-black tracking-[0.3em] uppercase mb-1", theme ? "text-white" : "text-slate-900")}>Estrutura & Endereços</h3>
                <p className={cn("text-[9px] uppercase tracking-widest font-black", theme ? "text-white" : "text-slate-950")}>Mapeamento por Posição e Setor</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn("text-[10px] uppercase tracking-[0.2em] border-b transition-all duration-500", theme ? "text-zinc-100 border-zinc-800 bg-black/40" : "text-slate-950 border-slate-200 bg-slate-50")}>
                      <th className="py-4 px-4 font-black">Posição / Setor (A)</th>
                      <th className="py-4 px-4 text-right font-black">Estrutura (B)</th>
                      <th className="py-4 px-4 text-right font-black">Endereços (C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.areas.map(area => <CollapsibleTableRow key={area.area} area={area} showStructure theme={theme} />)}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. OCUPAÇÃO TOTAL */}
            <div className={cn("rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all duration-500", theme ? `${theme.contentBg} ${theme.contentBorder} ${theme.contentShadow}` : "bg-white border-slate-100")}>
              <div className={cn("p-5 bg-gradient-to-r from-amber-500/10 to-transparent", !theme && "border-b border-slate-100")}>
                <h3 className={cn("text-xs font-black tracking-[0.3em] uppercase mb-1", theme ? "text-white" : "text-slate-900")}>Ocupação Total</h3>
                <p className={cn("text-[9px] uppercase tracking-widest font-black", theme ? "text-white" : "text-slate-950")}>Status de Armazenagem</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn("text-[10px] uppercase tracking-[0.2em] transition-all duration-500", theme ? "text-zinc-100 bg-black/40" : "text-slate-950 border-b border-slate-200 bg-slate-50")}>
                      <th className="py-4 px-4 font-black">Posição / Setor (A)</th>
                      <th className="py-4 px-4 text-right font-black">Ocupado (D)</th>
                      <th className="py-4 px-4 text-right font-black">% (H)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.areas.map(area => <CollapsibleTableRow key={area.area} area={area} showOccupied theme={theme} />)}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. CATEGORIAS BLOQUEADAS */}
            <div className={cn("rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all duration-500", theme ? `${theme.contentBg} ${theme.contentBorder} ${theme.contentShadow}` : "bg-white border-slate-100")}>
              <div className={cn("p-5 bg-gradient-to-r from-rose-500/10 to-transparent", !theme && "border-b border-slate-100")}>
                <h3 className={cn("text-xs font-black tracking-[0.3em] uppercase mb-1", theme ? theme.contentTitle : "text-slate-900")}>Posições Bloqueadas</h3>
                <p className={cn("text-[9px] uppercase tracking-widest font-medium", theme ? theme.contentText : "text-slate-500")}>Definitivo & Operacional</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn("text-[10px] uppercase tracking-[0.2em] transition-all duration-500", theme ? "text-zinc-100 bg-black/40" : "text-slate-950 border-b border-slate-200 bg-slate-50")}>
                      <th className="py-4 px-4 font-black">Posição / Setor (A)</th>
                      <th className="py-4 px-4 text-right font-black">Total Bloqueado (E+F)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.areas.map(area => <CollapsibleTableRow key={area.area} area={area} showBlocked theme={theme} />)}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. ESPAÇO DISPONÍVEL */}
            <div className={cn("rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all duration-500", theme ? `${theme.contentBg} ${theme.contentBorder} ${theme.contentShadow}` : "bg-white border-slate-100")}>
              <div className={cn("p-5 bg-gradient-to-r from-emerald-500/10 to-transparent", !theme && "border-b border-slate-100")}>
                <h3 className={cn("text-xs font-black tracking-[0.3em] uppercase mb-1", theme ? theme.contentTitle : "text-slate-900")}>Espaço Disponível</h3>
                <p className={cn("text-[9px] uppercase tracking-widest font-medium", theme ? theme.contentText : "text-slate-500")}>Capacidade Ociosa</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn("text-[10px] uppercase tracking-[0.2em] transition-all duration-500", theme ? "text-zinc-100 bg-black/40" : "text-slate-950 border-b border-slate-200 bg-slate-50")}>
                      <th className="py-4 px-4 font-black">Posição / Setor (A)</th>
                      <th className="py-4 px-4 text-right font-black">Disponível (G)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.areas.map(area => <CollapsibleTableRow key={area.area} area={area} showAvailable theme={theme} />)}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : activeView === 'mapa' ? (
          <CDPhysicalMap 
            data={data} 
            theme={theme} 
            getOccupancyColorClasses={getOccupancyColorClasses} 
            cn={cn} 
          />
        ) : (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <MiniMetric title="Estrutura" value={data.totalStructure.toLocaleString()} icon={LayoutDashboard} color="bg-blue-500/20" theme={theme} />
              <MiniMetric title="Endereços" value={data.totalAddresses.toLocaleString()} icon={FileSpreadsheet} color="bg-zinc-500/20" theme={theme} />
              <MiniMetric title="Ocupado" value={data.totalOccupied.toLocaleString()} percentage={`${data.globalPercentage.toFixed(1)}%`} icon={TrendingUp} color="bg-orange-500/20" theme={theme} />
              <MiniMetric 
                title="Categorias Bloqueadas" 
                value={(data.totalDefinitivo + data.totalOperacional).toLocaleString()} 
                percentage={`${((data.totalDefinitivo + data.totalOperacional) / data.totalAddresses * 100).toFixed(1)}%`} 
                icon={AlertCircle} 
                color="bg-rose-500/20" 
                theme={theme}
              />
              <MiniMetric title="Disponível" value={data.totalDisponivel.toLocaleString()} percentage={`${(data.totalDisponivel / data.totalAddresses * 100).toFixed(1)}%`} icon={CheckCircle2} color="bg-emerald-500/20" theme={theme} />
            </div>

            {/* Main Content Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OccupancyCard title="Picking" areaName="Picking" subtitle="Destaque: Nível 1" data={data} theme={theme} />
              <OccupancyCard title="Pulmão" areaName="Pulmão" subtitle="Destaque: Níveis 2 ao 6" data={data} theme={theme} />
            </div>

            {/* Alerta de Ocupação (Redesigned to match image) */}
            <div className={cn("rounded-2xl border shadow-2xl overflow-hidden flex flex-col p-6 space-y-8 transition-all duration-500", theme ? `${theme.contentBg} ${theme.contentBorder} ${theme.contentShadow}` : "bg-[#0f0f0f] border-white/10")}>
              {/* Header with Toggle and Legend */}
              <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", theme ? "bg-white/20" : "bg-black/10")}>
                      <Info className={cn("w-3.5 h-3.5", theme ? "text-white" : "text-black")} />
                    </div>
                    <h3 className={cn("text-xs font-black tracking-[0.2em] uppercase", theme ? "text-white" : "text-black")}>Alerta de Ocupação</h3>
                  </div>
                  
                  <div className={cn("h-4 w-[1px] mx-2", theme ? "bg-white/10" : "bg-white/10")} />
                  
                  <div className={cn("p-1 rounded-lg flex items-center gap-1 border transition-all duration-500", theme ? `${theme.contentBg} ${theme.contentBorder}` : "bg-[#1a1a1a] border-white/5")}>
                    <button 
                      onClick={() => setAlertView('categoria')}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all",
                        alertView === 'categoria' ? (theme ? "bg-zinc-950 text-white shadow-xl border border-white/10" : "bg-white text-zinc-950 shadow-lg") : "text-white/40 hover:text-white"
                      )}
                    >
                      Por Categoria
                    </button>
                    <button 
                      onClick={() => setAlertView('geral')}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all",
                        alertView === 'geral' ? (theme ? "bg-zinc-950 text-white shadow-xl border border-white/10" : "bg-white text-zinc-950 shadow-lg") : "text-white/40 hover:text-white"
                      )}
                    >
                      Geral
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", theme.contentText)}>Crítico (≥90%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", theme.contentText)}>Alto (≥80%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", theme.contentText)}>Médio (≥70%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", theme.contentText)}>Normal (&lt;70%)</span>
                  </div>
                </div>
              </div>

              {/* Content Area */}
              {alertView === 'categoria' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {['PICKING', 'PICKING DUPLO', 'PULMAO'].map(areaName => {
                    const area = data.areas.find(a => 
                      a.area.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === areaName
                    );
                    
                    if (!area) return null;

                    return (
                      <div key={areaName} className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                          <h4 className={cn("text-[11px] font-black uppercase tracking-[0.2em]", theme ? "text-white" : "text-white")}>{areaName}</h4>
                          <span className={cn("text-[8px] uppercase font-bold tracking-widest", theme ? "text-zinc-300" : "text-white/40")}>
                            {area.subcategories?.length || 0} itens
                          </span>
                        </div>
                        
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                          {[...(area.subcategories || [])]
                            .sort((a, b) => b.percentage - a.percentage)
                            .map((sub, idx) => (
                              <AlertCard key={idx} sub={sub} theme={theme} />
                            ))
                          }
                          
                          {(!area.subcategories || area.subcategories.length === 0) && (
                            <div className={cn("py-12 text-center rounded-xl border border-dashed", theme ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10")}>
                              <p className={cn("text-[9px] uppercase font-bold tracking-widest", theme ? "text-slate-300" : "text-white/20")}>Nenhum subsetor encontrado</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {globalSectors.length > 0 ? (
                    globalSectors.map((sector, idx) => (
                      <AlertCard key={idx} sub={sector} theme={theme} />
                    ))
                  ) : (
                    <div className={cn("col-span-full py-20 text-center rounded-2xl border border-dashed", theme ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10")}>
                      <p className={cn("text-xs uppercase font-black tracking-[0.3em]", theme ? "text-slate-300" : "text-white/20")}>Nenhum dado consolidado encontrado para os setores selecionados</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function DashboardApp() {
  const [data, setData] = useState<DashboardMetrics | null>(() => {
    try {
      const saved = localStorage.getItem('dashboard_data_local');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeModule, setActiveModule] = useState<Module>('INVENTARIO CÍCLICO');
  const [activeTab, setActiveTab] = useState<'overview' | 'streets' | 'errors' | 'daily'>('overview');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [occupancyView, setOccupancyView] = useState<'dashboard' | 'analitico' | 'mapa'>('analitico');
  const [streetSearchTerm, setStreetSearchTerm] = useState('');
  const [streetTypeFilter, setStreetTypeFilter] = useState<'ALL' | 'PICKING' | 'PULMAO'>('ALL');

  const SPREADSHEET_URL = '/api/fetch-sheets';

  const isAdmin = user?.email === 'thiagin.rodrigues@gmail.com';

  const processWorkbook = useCallback(async (wb: XLSX.WorkBook) => {
    console.log(`[Sync] Sheets found: ${wb.SheetNames.join(', ')}`);
    const mainSheetName = wb.SheetNames.find(n => {
      const normalized = n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized.includes("CONTAGEM_CICLICA_1_GIRO") || normalized.includes("DETALHES POR RUA");
    }) || wb.SheetNames[0];
    const ws = wb.Sheets[mainSheetName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Process "DIARIO" sheet for daily metrics
    const dailySheetName = wb.SheetNames.find(n => 
      n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === "DIARIO"
    );
    const dailySheet = dailySheetName ? wb.Sheets[dailySheetName] : null;
    
    let dailyCount = 0;
    let monthlyCount = 0;
    let weeklyGoal = 0;
    let dailyHistory: DailyHistory[] = [];
    let weeklyHistory: WeeklyHistory[] = [];

    if (dailySheet) {
      const dailyData: any[][] = XLSX.utils.sheet_to_json(dailySheet, { header: 1 });
      
      const dailyHeaders = dailyData[0] || [];
      const getDailyIdx = (names: string[]) => dailyHeaders.findIndex(h => 
        names.some(name => String(h || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(name))
      );

      const dCol = {
        date: getDailyIdx(['DATA']),
        count: getDailyIdx(['CONTAGEM', 'UNIDADES', 'QTDE']) || 2,
        weeklyGoal: getDailyIdx(['META SEMANAL', 'META SEMANA']) || 12
      };

      if (dCol.date === -1) dCol.date = 0;
      
      const sheetWeeklyGoal = Number(dailyData[1]?.[dCol.weeklyGoal]) || 0;
      if (sheetWeeklyGoal > 0) weeklyGoal = sheetWeeklyGoal;

      let lastValidCount = 0;

      for (let i = 1; i < dailyData.length; i++) {
        const row = dailyData[i];
        if (!row || !row[dCol.date]) continue;

        const dateVal = row[dCol.date];
        const count = Number(row[dCol.count]) || 0;

        monthlyCount += count;

        let date: Date | null = null;
        if (typeof dateVal === 'number') {
          date = new Date(Math.round((dateVal - 25569) * 86400 * 1000) + (12 * 60 * 60 * 1000));
        } else if (typeof dateVal === 'string') {
          const parts = dateVal.split('/');
          if (parts.length === 3) {
            date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
          } else {
            date = new Date(dateVal);
          }
        }

        if (date && !isNaN(date.getTime())) {
          const dayNameCalculated = date.toLocaleDateString('pt-BR', { weekday: 'long' });
          const formattedDayName = dayNameCalculated.charAt(0).toUpperCase() + dayNameCalculated.slice(1);

          const isSunday = date.getDay() === 0 || formattedDayName.toLowerCase().includes('domingo');
          
          if (!isSunday) {
            dailyHistory.push({
              date: date.toLocaleDateString('pt-BR'),
              dayName: formattedDayName,
              count: count
            });
            
            if (count > 0) {
              lastValidCount = count;
            }
          }
        }
      }
      dailyCount = lastValidCount;

      const weeks: { [key: string]: { count: number, start: number, end: number } } = {
        "Semana 1": { count: 0, start: 1, end: 7 },
        "Semana 2": { count: 0, start: 8, end: 14 },
        "Semana 3": { count: 0, start: 15, end: 21 },
        "Semana 4": { count: 0, start: 22, end: 31 }
      };

      dailyHistory.forEach(item => {
        const parts = item.date.split('/');
        const day = Number(parts[0]);
        
        let weekKey = "Semana 4";
        if (day <= 7) weekKey = "Semana 1";
        else if (day <= 14) weekKey = "Semana 2";
        else if (day <= 21) weekKey = "Semana 3";
        
        weeks[weekKey].count += item.count;
      });

      weeklyHistory = Object.entries(weeks)
        .map(([weekName, data]) => ({
          weekRange: `${weekName} (Dia ${data.start} ao ${data.end})`,
          count: data.count
        }));
    }

    const metrics: DashboardMetrics = {
      totalPositions: 0,
      totalCounted: 0,
      totalPending: 0,
      accuracy: 0,
      finalAccuracy: 0,
      totalErrors: 0,
      surplus: 0,
      shortage: 0,
      finalizedDivergences: 0,
      generalStatus: 0,
      dailyCount,
      monthlyCount,
      weeklyGoal,
      dailyGoal: 0,
      weeklyGoalCalculated: 0,
      dailyHistory,
      weeklyHistory,
      collaboratorCounts: [],
      streets: [],
      occupancyData: {
        totalStructure: 0,
        totalAddresses: 0,
        totalOccupied: 0,
        totalDefinitivo: 0,
        totalOperacional: 0,
        totalDisponivel: 0,
        globalPercentage: 0,
        areas: []
      }
    };

    // Process "Tabela Ocupação CD" sheet
    const occupancySheetName = wb.SheetNames.find(n => 
      n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("TABELA OCUPACAO CD")
    ) || wb.SheetNames.find(n => 
      n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("OCUPACAO CD")
    );
    
    if (occupancySheetName) {
      const occSheet = wb.Sheets[occupancySheetName];
      const occData: any[][] = XLSX.utils.sheet_to_json(occSheet, { header: 1 });
      
      const areas: OccupancyMetric[] = [];
      let totalStructure = 0;
      let totalAddresses = 0;
      let totalOccupied = 0;
      let totalDefinitivo = 0;
      let totalOperacional = 0;
      let totalDisponivel = 0;
      
      let currentCategory: OccupancyMetric | null = null;
      let subtotalMetric: OccupancyMetric | null = null;
      const TOP_LEVEL_POSITIONS = [
        'PICKING', 
        'PICKING DUPLO', 
        'FRACIONADO', 
        'PULMAO', 
        'TUNEL', 
        'SEGURANCA/INFRA', 
        'SEGURANCA / INFRA',
        'SUBTOTAL', 
        'TOTAL CD'
      ];

      for (let i = 0; i < occData.length; i++) {
        const row = occData[i];
        if (!row) continue;
        
        const rawAreaName = String(row[0] || '').trim();
        if (!rawAreaName && !row[1] && !row[2]) continue;

        let areaName = rawAreaName;
        let normalizedName = areaName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (normalizedName === 'TOTAL CD') {
          // Skip the original TOTAL CD row to avoid duplicating or showing the wrong data
          continue;
        }

        if (normalizedName === 'SUBTOTAL') {
          areaName = 'TOTAL CD';
          normalizedName = 'TOTAL CD';
        }

        const structure = Number(row[1]) || 0;
        const addresses = Number(row[2]) || 0;
        const occupied = Number(row[3]) || 0;
        const definitivo = Number(row[4]) || 0;
        const operacional = Number(row[5]) || 0;
        const disponivel = Number(row[6]) || 0;
        let percentage = Number(row[7]);
        
        if (isNaN(percentage)) {
          percentage = addresses > 0 ? (occupied / addresses) * 100 : 0;
        } else if (percentage <= 1 && percentage > 0) {
          percentage = percentage * 100;
        }

        // A row is a category if:
        // 1. It's in our explicit list of top-level positions (normalized)
        // 2. It's all uppercase AND contains letters AND is NOT "FRACIONADOS" (plural, which is a sector under PULMÃO)
        const isCategory = TOP_LEVEL_POSITIONS.includes(normalizedName) || 
                          normalizedName === "FRACIONADO" ||
                          (areaName === areaName.toUpperCase() && /[A-Z]/.test(areaName) && normalizedName !== "FRACIONADOS");
        
        const isSummary = normalizedName.includes("TOTAL") || normalizedName.includes("SUBTOTAL");
        
        const metric: OccupancyMetric = {
          area: areaName || 'Sem Nome',
          structure,
          addresses,
          occupied,
          definitivo,
          operacional,
          disponivel,
          percentage,
          isCategory,
          ...(isCategory ? { subcategories: [] } : {})
        };

        if (isCategory) {
          areas.push(metric);
          currentCategory = metric;
          
          if (normalizedName === 'TOTAL CD') {
            subtotalMetric = metric;
          }

          // Only sum "real" positions for the grand total
          if (!isSummary && normalizedName !== 'TOTAL CD') {
            totalStructure += structure;
            totalAddresses += addresses;
            totalOccupied += occupied;
            totalDefinitivo += definitivo;
            totalOperacional += operacional;
            totalDisponivel += disponivel;
          }
        } else if (currentCategory && areaName) {
          currentCategory.subcategories?.push(metric);
        }
      }
      
      // Sync TOTAL CD with SUBTOTAL if TOTAL CD is empty (as requested by user)
      const totalCdRow = areas.find(a => a.area.toUpperCase().includes('TOTAL CD'));
      if (totalCdRow && subtotalMetric) {
        if (totalCdRow.structure === 0) totalCdRow.structure = subtotalMetric.structure;
        if (totalCdRow.addresses === 0) totalCdRow.addresses = subtotalMetric.addresses;
        if (totalCdRow.occupied === 0) totalCdRow.occupied = subtotalMetric.occupied;
        if (totalCdRow.definitivo === 0) totalCdRow.definitivo = subtotalMetric.definitivo;
        if (totalCdRow.operacional === 0) totalCdRow.operacional = subtotalMetric.operacional;
        if (totalCdRow.disponivel === 0) totalCdRow.disponivel = subtotalMetric.disponivel;
        if (totalCdRow.percentage === 0) totalCdRow.percentage = subtotalMetric.percentage;
      }

      // Final global totals sync
      if (totalStructure === 0 && totalCdRow) {
        totalStructure = totalCdRow.structure;
        totalAddresses = totalCdRow.addresses;
        totalOccupied = totalCdRow.occupied;
        totalDefinitivo = totalCdRow.definitivo;
        totalOperacional = totalCdRow.operacional;
        totalDisponivel = totalCdRow.disponivel;
      } else if (subtotalMetric) {
        // If we have a subtotal, ensure global totals match it if they were calculated as 0
        if (totalStructure === 0) totalStructure = subtotalMetric.structure;
        if (totalAddresses === 0) totalAddresses = subtotalMetric.addresses;
        if (totalOccupied === 0) totalOccupied = subtotalMetric.occupied;
        if (totalDefinitivo === 0) totalDefinitivo = subtotalMetric.definitivo;
        if (totalOperacional === 0) totalOperacional = subtotalMetric.operacional;
        if (totalDisponivel === 0) totalDisponivel = subtotalMetric.disponivel;
      }

      metrics.occupancyData = {
        totalStructure,
        totalAddresses,
        totalOccupied,
        totalDefinitivo,
        totalOperacional,
        totalDisponivel,
        globalPercentage: totalAddresses > 0 ? (totalOccupied / totalAddresses) * 100 : 0,
        areas
      };
    }

    // Process "Setores" sheet with extreme resilience
    let setoresSheetName = wb.SheetNames.find(n => {
      const normalized = n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized === "SETORES" || normalized.includes("SETOR");
    });

    // Fallback: search all sheets to find which contains headers like RUA, PREDIO, and ANDAR
    if (!setoresSheetName) {
      for (const name of wb.SheetNames) {
        const tempWs = wb.Sheets[name];
        const tempData: any[][] = XLSX.utils.sheet_to_json(tempWs, { header: 1 });
        if (tempData && tempData.length > 0) {
          for (let r = 0; r < Math.min(8, tempData.length); r++) {
            const rowStr = JSON.stringify(tempData[r] || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (rowStr.includes("RUA") && (rowStr.includes("PREDIO") || rowStr.includes("MODULO") || rowStr.includes("POSICAO")) && (rowStr.includes("ANDAR") || rowStr.includes("NIVEL"))) {
              setoresSheetName = name;
              console.log(`[Sync] Automatically identified "Setores" sheet inside: "${name}" by content analysis.`);
              break;
            }
          }
        }
        if (setoresSheetName) break;
      }
    }

    if (setoresSheetName) {
      console.log(`[Sync] Parsing "Setores" sheet using name: "${setoresSheetName}"`);
      const setoresSheet = wb.Sheets[setoresSheetName];
      const setoresData: any[][] = XLSX.utils.sheet_to_json(setoresSheet, { header: 1 });
      const setoresLayout: SetoresLayoutItem[] = [];

      // Default spreadsheet indices (Excel 0-indexed):
      // Col B (1) = Rua, Col C (2) = Predio, Col D (3) = Andar, Col J (9) = Setores
      let colIdxRua = 1;
      let colIdxPredio = 2;
      let colIdxAndar = 3;
      let colIdxSetor = 9;
      let headerRowIndex = 0;

      // Try to dynamically detect columns from the first 10 rows
      for (let r = 0; r < Math.min(10, setoresData.length); r++) {
        const row = setoresData[r];
        if (!row) continue;
        
        const idxRua = row.findIndex(c => {
          const v = String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return v === "RUA" || v === "RUAS" || v.startsWith("RUA ");
        });
        const idxPredio = row.findIndex(c => {
          const v = String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return v.includes("PREDIO") || v.includes("MODULO") || v.includes("POSICAO");
        });
        const idxAndar = row.findIndex(c => {
          const v = String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return v.includes("ANDAR") || v.includes("NIVEL");
        });
        const idxSetor = row.findIndex(c => {
          const v = String(c || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return v.includes("SETOR") || v.includes("CLASSIFICACAO") || v.includes("CATEGORIA") || v.includes("SETOR QUE REPRESENTA");
        });

        if (idxRua !== -1 && idxPredio !== -1 && idxAndar !== -1) {
          headerRowIndex = r;
          colIdxRua = idxRua;
          colIdxPredio = idxPredio;
          colIdxAndar = idxAndar;
          if (idxSetor !== -1) {
            colIdxSetor = idxSetor;
          }
          console.log(`[Sync] Found dynamic columns at row ${r}: RuaCol=${colIdxRua}, PredioCol=${colIdxPredio}, AndarCol=${colIdxAndar}, SetorCol=${colIdxSetor}`);
          break;
        }
      }

      // Loop through the data rows starting after the detected header row (or from 1)
      const startRow = headerRowIndex + 1;
      for (let i = startRow; i < setoresData.length; i++) {
        const row = setoresData[i];
        if (!row) continue;

        const rawRua = row[colIdxRua];
        const rawPredio = row[colIdxPredio];
        const rawAndar = row[colIdxAndar];
        const rawSetor = row[colIdxSetor];

        // Skip empty or invalid rows (must have Rua value)
        if (rawRua === undefined || rawRua === null || String(rawRua).trim() === '') continue;

        // Extracts all sequences of digits (e.g. "RUA 15" -> "15", "03" -> "3", "3º Andar" -> "3")
        const rStr = String(rawRua).replace(/\D/g, '');
        const pStr = String(rawPredio || '').replace(/\D/g, '');
        const aStr = String(rawAndar || '').replace(/\D/g, '');

        const rVal = parseInt(rStr, 10);
        const pVal = parseInt(pStr, 10);
        const aVal = parseInt(aStr, 10);
        const sVal = rawSetor ? String(rawSetor).trim() : '';

        if (!isNaN(rVal) && !isNaN(pVal) && !isNaN(aVal)) {
          setoresLayout.push({
            rua: rVal,
            predio: pVal,
            andar: aVal,
            setor: sVal
          });
        }
      }

      metrics.setoresLayout = setoresLayout;
      if (metrics.occupancyData) {
        metrics.occupancyData.setoresLayout = setoresLayout;
      }
      console.log(`[Sync] Successfully parsed ${setoresLayout.length} positions with mapped sectors!`);
      if (setoresLayout.length > 0) {
        console.log(`[Sync] Sample mapped sectors:`, setoresLayout.slice(0, 5));
      }
    } else {
      console.warn(`[Sync] WARNING: "Setores" sheet not found inside the excel file! Available sheets: ${wb.SheetNames.join(', ')}`);
    }

    // Helper to parse dates from spreadsheet with high resilience
    const parseSheetDate = (value: any): Date | null => {
      if (!value) return null;
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
      }
      
      const str = String(value).trim();
      if (!str || str === 'N/A') return null;

      // Avoid parsing pure numeric SKU/codes as native dates
      if (/^\d+(\.\d+)?$/.test(str)) {
        // Safe Excel serial date range to prevent numbers like SKU (e.g. 2007645) or valueBR from being parsed as dates
        const serial = Math.floor(Number(str));
        if (serial >= 40000 && serial <= 60000) {
          const utcDate = new Date((serial - 25569) * 86400 * 1000);
          const date = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
          if (!isNaN(date.getTime())) return date;
        }
        return null;
      }

      // Replace hyphens and dots with slashes to unify split operations
      const cleanStr = str.replace(/[-.]/g, '/');
      const dateParts = cleanStr.split('/');
      
      if (dateParts.length === 3) {
        let d = parseInt(dateParts[0], 10);
        let m = parseInt(dateParts[1], 10) - 1;
        let y = parseInt(dateParts[2], 10);

        // If the first part is 4-digit, assume YYYY/MM/DD
        if (dateParts[0].length === 4) {
          y = parseInt(dateParts[0], 10);
          m = parseInt(dateParts[1], 10) - 1;
          d = parseInt(dateParts[2], 10);
        } else if (y < 100) {
          y += y < 50 ? 2000 : 1900;
        }

        if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
          const date = new Date(y, m, d);
          if (!isNaN(date.getTime())) return date;
        }
      }

      // Try native JS Date parsing (for ISO-8601 strings etc.)
      const nativeDate = new Date(str);
      if (!isNaN(nativeDate.getTime())) {
        return nativeDate;
      }

      return null;
    };

    // Process "INVENTARIO GT" sheet
    const inventarioGTSheetName = wb.SheetNames.find(n => {
      const normalized = n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized.includes("INVENTARIO GT") || 
             normalized.includes("INVENTARIO_GT") || 
             normalized.includes("INV GT") || 
             normalized.includes("GIROTRADE") || 
             normalized.includes("INVENTARIO GERAL") ||
             normalized === "GT" ||
             normalized.startsWith("GT ") ||
             normalized.endsWith(" GT");
    });
    
    if (inventarioGTSheetName) {
      console.log(`[Sync] Encontrada aba de Inventário Geral GT: ${inventarioGTSheetName}`);
      const gtSheet = wb.Sheets[inventarioGTSheetName];
      const gtData: any[][] = XLSX.utils.sheet_to_json(gtSheet, { header: 1 });
      
      // Dynamic scanning to find the real headers row (e.g., in case of blank rows or titles at the top)
      let headerRowIdx = 0;
      let maxMatches = 0;
      const coreTerms = [
        'SKU', 'CODIGO', 'CÓDIGO', 'MATERIAL', 'COD_MAT', 'PRODUTO_COD', 'COD_PROD',
        'DESCRICAO', 'DESCRIÇÃO', 'NOME', 'PRODUTO', 'MATERIAL_DESC',
        'ENDERECO', 'ENDEREÇO', 'POSICAO', 'POSIÇÃO', 'LOCAL', 'LOCALIZACAO', 'LOCALIZAÇÃO',
        'VALIDADE', 'VENCIMENTO', 'DT_VENC', 'DT_VALIDADE', 'EXPIRATION',
        'VALOR BR', 'VALOR_BR', 'VALOR', 'CUSTO'
      ];
      
      const scanLimit = Math.min(gtData.length, 15);
      for (let r = 0; r < scanLimit; r++) {
        const row = gtData[r];
        if (!row) continue;
        let matches = 0;
        row.forEach(cell => {
          if (cell === undefined || cell === null) return;
          const cellStr = String(cell).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (!cellStr) return;
          const matched = coreTerms.some(term => {
            const cleanTerm = term.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            return cellStr === cleanTerm || cellStr.includes(cleanTerm);
          });
          if (matched) matches++;
        });
        if (matches > maxMatches) {
          maxMatches = matches;
          headerRowIdx = r;
        }
      }
      
      console.log(`[Sync] GT Headers scanning: Row ${headerRowIdx} chosen as header row with ${maxMatches} matches.`);
      const headers = gtData[headerRowIdx] || [];
      
      const getIndex = (names: string[]) => {
        const cleanNames = names.map(n => 
          String(n).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        );
        const cleanHeaders = headers.map(h => 
          h === undefined || h === null ? '' : String(h).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        );

        // 1. Try exact matches first for all names in order of preference
        for (const name of cleanNames) {
          const idx = cleanHeaders.findIndex(h => h === name);
          if (idx !== -1) return idx;
        }

        // 2. Try partial matches (startsWith, endsWith, includes) for names in order of preference
        for (const name of cleanNames) {
          if (name.length < 3) continue;
          const idx = cleanHeaders.findIndex(h => h.startsWith(name) || h.endsWith(name) || h.includes(name));
          if (idx !== -1) return idx;
        }
        
        return -1;
      };

      const getColumnIndex = (names: string[], fallback: number): number => {
        const idx = getIndex(names);
        return idx !== -1 ? idx : fallback;
      };

      // Mapeamento dinâmico das colunas com fallback seguro para os índices padrão:
      // SKU na coluna K (índice 10), Descrição na coluna M (índice 12), Posição na coluna B (índice 1)
      // Valor na coluna BR (índice 69) e Data de Validade na coluna BQ (índice 68)
      const colIdx = {
        sku: getColumnIndex(['CODIGO DO PRODUTO', 'SKU', 'CODIGO', 'MATERIAL', 'COD_MAT', 'PRODUTO_COD', 'COD_PROD'], 10),
        desc: getColumnIndex(['DESCRICAO', 'DESCRIÇÃO', 'NOME', 'PRODUTO', 'MATERIAL_DESC'], 12),
        address: getColumnIndex(['LOCACAO', 'LOCAÇÃO', 'ENDERECO', 'ENDEREÇO', 'POSICAO', 'POSIÇÃO', 'LOCAL', 'LOCALIZACAO', 'LOCALIZAÇÃO'], 1),
        area: getColumnIndex(['TIPO DO LOCAL', 'TIPO_LOCAL', 'AREA', 'ÁREA', 'SETOR', 'TIPO_END', 'TIPO ENDERECO'], 2),
        estado: getColumnIndex(['ESTADO', 'SITUACAO', 'SITUAÇÃO', 'STATUS'], 4),
        exp: getColumnIndex(['DATA DE VENCIMENTO', 'DATA DE VENCIMENTO TRUNCADA', 'VENCIMENTO', 'VALIDADE', 'DT_VENC', 'DT VENC', 'DT_VALIDADE', 'DT VALIDADE', 'DATA VALIDADE', 'DATA DE VALIDADE', 'EXPIRATION', 'EXP_DATE'], 68),
        shelf: getColumnIndex(['PRAZO DE VALIDADE', 'SHELF LIFE', 'SHELF', 'AL'], 37),
        valor: getColumnIndex(['VALOR BR', 'VALOR_BR', 'VALOR', 'CUSTO', 'PRECO', 'PREÇO', 'TOTAL', 'VALOR TOTAL'], 69)
      };

      console.log(`[Sync] Mapeamento de Colunas GT (Dinâmico + Fallback):`, colIdx);
      
      const hasAreaColumn = getIndex(['TIPO DO LOCAL', 'TIPO_LOCAL', 'AREA', 'ÁREA', 'SETOR', 'TIPO_END', 'TIPO ENDERECO']) !== -1;
      
      const items: InventarioGTSKU[] = [];
      const backupItems: InventarioGTSKU[] = [];
      const uniqueSKUsSet = new Set<string>();
      const backupUniqueSKUsSet = new Set<string>();
      let preFefoCount = 0;
      let fefoCount = 0;
      let prePerdaCount = 0;
      let perdaCount = 0;
      let bPreFefoCount = 0;
      let bFefoCount = 0;
      let bPrePerdaCount = 0;
      let bPerdaCount = 0;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      for (let i = headerRowIdx + 1; i < gtData.length; i++) {
        const row = gtData[i];
        if (!row) continue;
        
        const sku = colIdx.sku < row.length ? String(row[colIdx.sku] || '').trim() : '';
        if (!sku || sku.toUpperCase() === 'SKU' || sku.toUpperCase() === 'CODIGO' || sku.toUpperCase() === 'CÓDIGO') continue;
        
        const area = colIdx.area < row.length ? String(row[colIdx.area] || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const address = colIdx.address < row.length ? String(row[colIdx.address] || '').trim() : '';

        // Validating columns C (Area) and B (Address/Posição)
        let isValidArea = !hasAreaColumn; // If there's no Area column, let it be valid by default
        
        if (hasAreaColumn) {
          const isPicking = area === 'PICKING';
          const isPulmaoBlocado = area === 'PULMAO BLOCADO';
          const isPulmao = (area.startsWith('PULMAO') || area.includes('PULMAO')) && !isPulmaoBlocado;

          if (isPicking) {
            isValidArea = true;
          } else if (isPulmaoBlocado) {
            isValidArea = address.startsWith('18') || address.startsWith('81') || address.startsWith('90');
          } else if (isPulmao) {
            isValidArea = true;
          }
        }

        const description = colIdx.desc < row.length ? String(row[colIdx.desc] || '').trim() : '';
        const estado = colIdx.estado < row.length ? String(row[colIdx.estado] || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const shelfLifeAL = colIdx.shelf < row.length && row[colIdx.shelf] !== undefined && row[colIdx.shelf] !== null ? row[colIdx.shelf] : 'N/A';
        
        // Parse raw value from column BR (index 69)
        let valueBR = 0;
        if (colIdx.valor < row.length) {
          const rawValor = row[colIdx.valor];
          if (rawValor !== undefined && rawValor !== null) {
            if (typeof rawValor === 'number') {
              valueBR = rawValor;
            } else {
              const cleanStr = String(rawValor).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
              valueBR = parseFloat(cleanStr) || 0;
            }
          }
        }

        // Expiration date (column BQ, index 68)
        let expirationDate = 'N/A';
        const rawDate = colIdx.exp < row.length ? row[colIdx.exp] : undefined;
        
        let daysRemaining: number | null = null;
        let category: 'PRÉ FEFO' | 'FEFO' | 'PRÉ PERDA' | 'PERDA' | 'NORMAL' = 'NORMAL';

        const expDate = parseSheetDate(rawDate);
        if (expDate) {
          // Format as DD/MM/YY
          const d = String(expDate.getDate()).padStart(2, '0');
          const m = String(expDate.getMonth() + 1).padStart(2, '0');
          const y = String(expDate.getFullYear()).slice(-2);
          expirationDate = `${d}/${m}/${y}`;

          const diffTime = expDate.getTime() - now.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (daysRemaining <= 15) {
            category = 'PERDA';
          } else if (daysRemaining <= 30) {
            category = 'PRÉ PERDA';
          } else if (daysRemaining <= 60) {
            category = 'FEFO';
          } else if (daysRemaining <= 90) {
            category = 'PRÉ FEFO';
          }
        } else if (rawDate !== undefined && rawDate !== null) {
          expirationDate = String(rawDate).trim();
        }

        const itemObj: InventarioGTSKU = {
          sku,
          description,
          address,
          expirationDate,
          shelfLifeAL,
          daysRemaining,
          category,
          valueBR
        };

        backupUniqueSKUsSet.add(sku);
        backupItems.push(itemObj);
        if (category === 'PERDA') bPerdaCount++;
        else if (category === 'PRÉ PERDA') bPrePerdaCount++;
        else if (category === 'FEFO') bFefoCount++;
        else if (category === 'PRÉ FEFO') bPreFefoCount++;

        if (isValidArea) {
          uniqueSKUsSet.add(sku);
          items.push(itemObj);
          if (category === 'PERDA') perdaCount++;
          else if (category === 'PRÉ PERDA') prePerdaCount++;
          else if (category === 'FEFO') fefoCount++;
          else if (category === 'PRÉ FEFO') preFefoCount++;
        }
      }

      const finalItems = items.length > 0 ? items : backupItems;
      const finalUniqueSKUsSet = items.length > 0 ? uniqueSKUsSet : backupUniqueSKUsSet;
      const finalPreFefoCount = items.length > 0 ? preFefoCount : bPreFefoCount;
      const finalFefoCount = items.length > 0 ? fefoCount : bFefoCount;
      const finalPrePerdaCount = items.length > 0 ? prePerdaCount : bPrePerdaCount;
      const finalPerdaCount = items.length > 0 ? perdaCount : bPerdaCount;

      console.log(`[Sync] GT processed items: ${finalItems.length} (Strict area match: ${items.length > 0})`);
      
      metrics.inventarioGT = {
        items: finalItems,
        uniqueSKUCount: finalUniqueSKUsSet.size,
        preFefoCount: finalPreFefoCount,
        fefoCount: finalFefoCount,
        prePerdaCount: finalPrePerdaCount,
        perdaCount: finalPerdaCount
      };
    }

    // Process "CORTES" sheet
    const cortesSheetName = wb.SheetNames.find(n => {
      const normalized = n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized.includes("CORTES") && !normalized.includes("WMS");
    });
    
    if (cortesSheetName) {
      console.log(`[Sync] Encontrada aba de Cortes: ${cortesSheetName}`);
      const cortesSheet = wb.Sheets[cortesSheetName];
      const cortesRawData: any[][] = XLSX.utils.sheet_to_json(cortesSheet, { header: 1 });
      
      const cortesItems: CortesItem[] = [];

      // Helper for robust parsing of values like "R$ 1.250,50" or "250,00"
      const parseNumericValue = (val: any): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'number') return val;
        const str = String(val).trim();
        if (!str) return 0;
        const clean = str
          .replace(/R\$\s*/gi, '')
          .replace(/[^\d.,-]/g, '')
          .trim();
        if (!clean) return 0;
        if (clean.includes(',') && clean.includes('.')) {
          const lastComma = clean.lastIndexOf(',');
          const lastPeriod = clean.lastIndexOf('.');
          if (lastComma > lastPeriod) {
            return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
          } else {
            return parseFloat(clean.replace(/,/g, ''));
          }
        } else if (clean.includes(',')) {
          return parseFloat(clean.replace(',', '.'));
        }
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Let's dynamically detect column indices based on header names (with defaults B=1, C=2, G=6, H=7, I=8, K=10, D=3 for Pedido)
      let colSku = 1;      // B
      let colDesc = 2;     // C
      let colDate = 6;     // G
      let colQty = 7;      // H
      let colVal = 8;      // I
      let colReason = 10;  // K
      let colPedido = 3;   // D (Default Column D)
      let headerRowIndex = 0;

      for (let r = 0; r < Math.min(cortesRawData.length, 12); r++) {
        const row = cortesRawData[r];
        if (!row) continue;
        
        let matches = 0;
        let tempSku = -1;
        let tempDesc = -1;
        let tempDate = -1;
        let tempQty = -1;
        let tempVal = -1;
        let tempReason = -1;
        let tempPedido = -1;

        for (let c = 0; c < row.length; c++) {
          const cellVal = String(row[c] || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (!cellVal) continue;

          if (cellVal === 'SKU' || cellVal === 'CODIGO' || cellVal === 'COD' || cellVal === 'COD.') {
            tempSku = c;
            matches++;
          } else if (cellVal.includes('DESCRIC') || cellVal === 'DESC' || cellVal.includes('PRODUTO')) {
            tempDesc = c;
            matches++;
          } else if (cellVal.includes('DATA') || cellVal.includes('DATE') || cellVal.includes('EMISSAO') || cellVal.includes('CORTE')) {
            tempDate = c;
            matches++;
          } else if (cellVal.includes('QTD') || cellVal.includes('QUANT') || cellVal.includes('VOLUME') || cellVal === 'QTD.' || cellVal === 'QTDE') {
            tempQty = c;
            matches++;
          } else if (cellVal.includes('VALOR') || cellVal.includes('PRECO') || cellVal.includes('TOTAL') || cellVal.includes('R$') || cellVal.includes('IMPACTO') || cellVal.includes('FINANC')) {
            tempVal = c;
            matches++;
          } else if (cellVal.includes('MOTIVO') || cellVal.includes('REASON') || cellVal.includes('JUSTIF') || cellVal.includes('CAUSA')) {
            tempReason = c;
            matches++;
          } else if (cellVal.includes('PEDIDO') || cellVal.includes('ORDEM') || cellVal === 'PED' || cellVal.includes('Nº PEDIDO') || cellVal.includes('N.PEDIDO') || cellVal.includes('NUM.PEDIDO') || cellVal.includes('DOCUMENTO')) {
            tempPedido = c;
          }
        }

        // If we found SKU and at least one other indicator (matches >= 2), we use this line as the header
        if (matches >= 2 && tempSku !== -1) {
          headerRowIndex = r;
          colSku = tempSku;
          if (tempDesc !== -1) colDesc = tempDesc;
          if (tempDate !== -1) colDate = tempDate;
          if (tempQty !== -1) colQty = tempQty;
          if (tempVal !== -1) colVal = tempVal;
          if (tempReason !== -1) colReason = tempReason;
          if (tempPedido !== -1) colPedido = tempPedido;
          console.log(`[Sync] Mapeamento dinâmico de CORTES na linha ${r}: SKU=${colSku}, DESC=${colDesc}, DATA=${colDate}, QTD=${colQty}, VALOR=${colVal}, MOTIVO=${colReason}, PEDIDO=${colPedido}`);
          break;
        }
      }

      const startRow = headerRowIndex + 1;
      for (let i = startRow; i < cortesRawData.length; i++) {
        const row = cortesRawData[i];
        if (!row) continue;
        
        const rawSkuValue = row[colSku];
        if (rawSkuValue === undefined || rawSkuValue === null) continue;
        
        const sku = String(rawSkuValue).trim();
        const skuUpper = sku.toUpperCase();
        // Robust skipping of header rows or actual subtotal rows without skipping real SKUs that may contain "TOTAL" as text
        if (!sku || skuUpper === 'SKU' || skuUpper === 'UNDEFINED' || skuUpper === 'NULL' || skuUpper === 'TOTAL' || skuUpper === 'TOTAL GERAL' || skuUpper === 'SUBTOTAL' || skuUpper.startsWith('TOTAL:')) continue;
        
        const description = String(row[colDesc] || '').trim();
        
        let dateStr = '';
        const rawDate = row[colDate];
        const dateObj = parseSheetDate(rawDate);
        if (dateObj) {
          const d = String(dateObj.getDate()).padStart(2, '0');
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const y = dateObj.getFullYear();
          dateStr = `${d}/${m}/${y}`;
        } else if (rawDate !== undefined && rawDate !== null) {
          dateStr = String(rawDate).trim();
        }
        
        const quantity = parseNumericValue(row[colQty]);
        const value = parseNumericValue(row[colVal]);
        const reason = String(row[colReason] || 'NÃO CATALOGADO').trim();
        const pedido = row[colPedido] !== undefined && row[colPedido] !== null ? String(row[colPedido]).trim() : '';
        
        cortesItems.push({
          sku,
          description,
          date: dateStr,
          dateObj: dateObj ? dateObj.toISOString() : null,
          quantity,
          value,
          reason,
          pedido
        });
      }
      
      console.log(`[Sync] Total de registros de cortes mapeados: ${cortesItems.length}`);
      metrics.cortes = cortesItems;
    }

    // Process "CORTES WMS" sheet
    const cortesWmsSheetName = wb.SheetNames.find(n => {
      const normalized = n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized.includes("CORTES") && normalized.includes("WMS");
    });
    
    if (cortesWmsSheetName) {
      console.log(`[Sync] Encontrada aba de Cortes WMS: ${cortesWmsSheetName}`);
      const cortesWmsSheet = wb.Sheets[cortesWmsSheetName];
      const cortesWmsRawData: any[][] = XLSX.utils.sheet_to_json(cortesWmsSheet, { header: 1 });
      
      const cortesWmsItems: CortesItem[] = [];

      // Helper for robust parsing of values like "R$ 1.250,50" or "250,00"
      const parseNumericValue = (val: any): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'number') return val;
        const str = String(val).trim();
        if (!str) return 0;
        const clean = str
          .replace(/R\$\s*/gi, '')
          .replace(/[^\d.,-]/g, '')
          .trim();
        if (!clean) return 0;
        if (clean.includes(',') && clean.includes('.')) {
          const lastComma = clean.lastIndexOf(',');
          const lastPeriod = clean.lastIndexOf('.');
          if (lastComma > lastPeriod) {
            return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
          } else {
            return parseFloat(clean.replace(/,/g, ''));
          }
        } else if (clean.includes(',')) {
          return parseFloat(clean.replace(',', '.'));
        }
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Find date column index if any
      let headerRowIndex = 0;
      let colDate = -1;

      // Scan first few rows to find header row containing date or SKU or ONDE
      for (let r = 0; r < Math.min(cortesWmsRawData.length, 12); r++) {
        const row = cortesWmsRawData[r];
        if (!row) continue;
        let matches = 0;
        for (let c = 0; c < row.length; c++) {
          const cellVal = String(row[c] || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (!cellVal) continue;
          if (cellVal.includes('SKU') || cellVal === 'CODIGO' || cellVal === 'COD' || cellVal === 'COD.') {
            matches++;
          }
          if (cellVal.includes('DATA') || cellVal.includes('DATE') || cellVal.includes('EMISSAO') || cellVal === 'DIA') {
            colDate = c;
          }
        }
        if (matches > 0) {
          headerRowIndex = r;
          break;
        }
      }

      // If no date column found dynamically in headers, look for any column where rows contain dates
      if (colDate === -1) {
        for (let c = 0; c < 30; c++) {
          if (c === 0 || c === 6 || c === 8 || c === 10 || c === 25) continue; // skip known columns
          let dateCount = 0;
          for (let r = headerRowIndex + 1; r < Math.min(cortesWmsRawData.length, headerRowIndex + 15); r++) {
            const val = cortesWmsRawData[r]?.[c];
            if (val && parseSheetDate(val)) {
              dateCount++;
            }
          }
          if (dateCount > 3) {
            colDate = c;
            console.log(`[Sync] Detectou dinamicamente a coluna de datas em Cortes WMS: índice ${colDate}`);
            break;
          }
        }
      }

      const startRow = headerRowIndex + 1;
      for (let i = startRow; i < cortesWmsRawData.length; i++) {
        const row = cortesWmsRawData[i];
        if (!row) continue;
        
        // Coluna G = index 6 (SKU)
        const rawSkuValue = row[6];
        if (rawSkuValue === undefined || rawSkuValue === null) continue;
        
        const sku = String(rawSkuValue).trim();
        const skuUpper = sku.toUpperCase();
        if (!sku || skuUpper === 'SKU' || skuUpper === 'UNDEFINED' || skuUpper === 'NULL' || skuUpper === 'TOTAL' || skuUpper === 'TOTAL GERAL' || skuUpper === 'SUBTOTAL' || skuUpper.startsWith('TOTAL:')) continue;
        
        // Coluna I = index 8 (descrição do SKU)
        const description = String(row[8] || '').trim();
        
        // Coluna A = index 0 (onde / local)
        const reason = String(row[0] || 'NÃO CATALOGADO').trim();
        
        // Coluna K = index 10 (quantidade)
        const quantity = parseNumericValue(row[10]);
        
        // Coluna Z = index 25 (valor)
        const value = parseNumericValue(row[25]);

        // Date resolution
        let dateStr = '';
        let dateObj: Date | null = null;
        if (colDate !== -1) {
          const rawDate = row[colDate];
          dateObj = parseSheetDate(rawDate);
        }
        
        // Fallback for date matching: search row for any cell that has a valid date if colDate was invalid or empty for this row
        if (!dateObj) {
          for (let c = 0; c < Math.min(row.length, 30); c++) {
            if (c === 0 || c === 6 || c === 8 || c === 10 || c === 25) continue;
            const parsed = parseSheetDate(row[c]);
            if (parsed) {
              dateObj = parsed;
              break;
            }
          }
        }

        if (dateObj) {
          const d = String(dateObj.getDate()).padStart(2, '0');
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const y = dateObj.getFullYear();
          dateStr = `${d}/${m}/${y}`;
        }

        cortesWmsItems.push({
          sku,
          description,
          date: dateStr,
          dateObj: dateObj ? dateObj.toISOString() : null,
          quantity,
          value,
          reason
        });
      }

      console.log(`[Sync] Total de registros de cortes WMS mapeados: ${cortesWmsItems.length}`);
      metrics.cortesWMS = cortesWmsItems;
    }

    // Process "AVARIA" sheet
    const avariaSheetName = wb.SheetNames.find(n => {
      const normalized = n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized.includes("AVARIA");
    });

    if (avariaSheetName) {
      console.log(`[Sync] Encontrada aba de Avarias: ${avariaSheetName}`);
      const avariaSheet = wb.Sheets[avariaSheetName];
      const avariaRawData: any[][] = XLSX.utils.sheet_to_json(avariaSheet, { header: 1 });
      
      const avariaItems: AvariaItem[] = [];

      // Helper for robust parsing of numeric/currency values (like "R$ 1.250,50" or "R$ -")
      const parseNumericValue = (val: any): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'number') return val;
        const str = String(val).trim();
        if (!str || str === '-' || str.includes('R$ -')) return 0;
        const clean = str
          .replace(/R\$\s*/gi, '')
          .replace(/[^\d.,-]/g, '')
          .trim();
        if (!clean) return 0;
        if (clean.includes(',') && clean.includes('.')) {
          const lastComma = clean.lastIndexOf(',');
          const lastPeriod = clean.lastIndexOf('.');
          if (lastComma > lastPeriod) {
            return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
          } else {
            return parseFloat(clean.replace(/,/g, ''));
          }
        } else if (clean.includes(',')) {
          return parseFloat(clean.replace(',', '.'));
        }
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Header detection:
      // Column indexes default values:
      let colDate = 0;
      let colSku = 2;
      let colDesc = 3;
      let colQty = 4;
      let colUnit = 5;
      let colPriceUnit = 6;
      let colPriceTotal = 7;

      // Scan first few rows to confirm column indices dynamically in case layout shifts
      for (let r = 0; r < Math.min(avariaRawData.length, 5); r++) {
        const row = avariaRawData[r];
        if (!row) continue;
        let foundHeaders = 0;
        row.forEach((cell, idx) => {
          const s = String(cell || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (s === 'DATA') { colDate = idx; foundHeaders++; }
          if (s.includes('CODIGO RM') || s.includes('SKU')) { colSku = idx; foundHeaders++; }
          if (s.includes('PRODUTO') || s.includes('DESCRICAO')) { colDesc = idx; foundHeaders++; }
          if (s.includes('QUANTIDADE') || s.includes('QTDE')) { colQty = idx; foundHeaders++; }
          if (s.includes('UNIDADE') || s.includes('EMBALAGEM') || s.includes('FATOR')) { colUnit = idx; foundHeaders++; }
          if (s.includes('PRECO UNITARIO') || s.includes('VALOR UNITARIO')) { colPriceUnit = idx; foundHeaders++; }
          if (s.includes('PRECO TOTAL') || s.includes('VALOR TOTAL') || s === 'TOTAL') { colPriceTotal = idx; foundHeaders++; }
        });
        if (foundHeaders >= 4) {
          break;
        }
      }

      // Start loop from 1 (assuming row 0 is header)
      for (let i = 1; i < avariaRawData.length; i++) {
        const row = avariaRawData[i];
        if (!row || row.length === 0) continue;
        
        // SKU check - must have SKU
        const skuVal = row[colSku];
        if (skuVal === undefined || skuVal === null || String(skuVal).trim() === '') continue;
        const sku = String(skuVal).trim();
        
        // Description
        const description = String(row[colDesc] || '').trim();
        
        // Quantity
        const quantity = Number(row[colQty]) || 0;
        
        // Unit/Conversion Factor
        const conversionFactor = String(row[colUnit] || 'UN').trim();
        
        // Unit Price
        const unitPrice = parseNumericValue(row[colPriceUnit]);
        
        // Total Price
        const totalPrice = parseNumericValue(row[colPriceTotal]);

        // Date
        const rawDate = row[colDate];
        let dateObj = parseSheetDate(rawDate);
        let dateStr = '';
        
        if (dateObj) {
          const d = String(dateObj.getDate()).padStart(2, '0');
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const y = dateObj.getFullYear();
          dateStr = `${d}/${m}/${y}`;
        }

        avariaItems.push({
          date: dateStr,
          dateObj: dateObj ? dateObj.toISOString() : null,
          sku,
          description,
          quantity,
          conversionFactor,
          unitPrice,
          totalPrice
        });
      }

      console.log(`[Sync] Total de registros de Avarias mapeados: ${avariaItems.length}`);
      metrics.avaria = avariaItems;
    }

    const row6 = jsonData[5] || [];
    const totalPositions = Number(row6[8]) || 0;
    metrics.totalPositions = totalPositions;
    metrics.totalCounted = Number(row6[9]) || 0;
    metrics.totalPending = Number(row6[10]) || 0;
    metrics.accuracy = (Number(row6[21]) || 0) * 100;
    metrics.finalAccuracy = (Number(row6[23]) || 0) * 100;
    metrics.totalErrors = Number(row6[17]) || 0;
    metrics.surplus = Number(row6[14]) || 0;
    metrics.shortage = Number(row6[15]) || 0;
    metrics.finalizedDivergences = Number(row6[18]) || 0;
    metrics.generalStatus = (Number(row6[19]) || 0) * 100;
    metrics.dailyGoal = Math.round(totalPositions / 26);
    metrics.weeklyGoalCalculated = Math.round(totalPositions / 4);

    const nameRow = jsonData[3] || [];
    const valueRow = jsonData[4] || [];
    const collaboratorCounts: CollaboratorCount[] = [];
    
    for (let col = 26; col <= 29; col++) {
      const name = nameRow[col];
      const value = Number(valueRow[col]) || 0;
      if (name) {
        collaboratorCounts.push({ name: String(name), count: value });
      }
    }
    metrics.collaboratorCounts = collaboratorCounts;

    // Process streets 
    let totalPickingPlan = 0;
    let totalPickingCounted = 0;
    let totalPulmaoPlan = 0;
    let totalPulmaoCounted = 0;

    for (let i = 8; i < jsonData.length; i += 6) {
      const row = jsonData[i] || [];
      const name = String(row[2] || '').trim();
      if (!name || name.toUpperCase().includes('TOTAL')) continue;

      let streetErrors = 0;
      let streetSurplus = 0;
      let streetShortage = 0;
      let streetFinalized = 0;
      
      let streetPlan = 0;
      let streetCounted = 0;
      
      let pickingPlan = 0;
      let pickingCounted = 0;
      let pulmaoPlan = 0;
      let pulmaoCounted = 0;

      // Keep summing errors and details from the sub-rows if they follow the previous pattern
      for (let j = 0; j < 6; j++) {
        const subRow = jsonData[i + j] || [];
        streetErrors += Math.abs(Number(subRow[17]) || 0);
        streetSurplus += Math.abs(Number(subRow[14]) || 0);
        streetShortage += Math.abs(Number(subRow[15]) || 0);
        streetFinalized += Number(subRow[18]) || 0;

        // Column I (index 8) is Plano, Column J (index 9) is Contado
        const subPlan = Math.abs(Number(subRow[8]) || 0);
        const subCounted = Math.abs(Number(subRow[9]) || 0);

        streetPlan += subPlan;
        streetCounted += subCounted;

        // Classify as Picking (level 1) or Pulmão (level 2-6)
        const rawNivel = subRow[3];
        const nivel = typeof rawNivel === 'number' ? rawNivel : parseInt(String(rawNivel || '').trim(), 10);

        if (nivel === 1) {
          pickingPlan += subPlan;
          pickingCounted += subCounted;
        } else if (nivel >= 2 && nivel <= 6) {
          pulmaoPlan += subPlan;
          pulmaoCounted += subCounted;
        }
      }

      totalPickingPlan += pickingPlan;
      totalPickingCounted += pickingCounted;
      totalPulmaoPlan += pulmaoPlan;
      totalPulmaoCounted += pulmaoCounted;
      
      const pending = streetCounted - streetPlan; 
      const status = streetPlan > 0 ? (streetCounted / streetPlan) * 100 : (streetCounted > 0 ? 100 : 0);

      const pickingPending = pickingCounted - pickingPlan;
      const pickingStatus = pickingPlan > 0 ? (pickingCounted / pickingPlan) * 100 : (pickingCounted > 0 ? 100 : 0);

      const pulmaoPending = pulmaoCounted - pulmaoPlan;
      const pulmaoStatus = pulmaoPlan > 0 ? (pulmaoCounted / pulmaoPlan) * 100 : (pulmaoCounted > 0 ? 100 : 0);

      metrics.streets.push({
        id: Math.floor(i / 6) + 1,
        name: name || `Rua ${Math.floor(i / 6) + 1}`,
        plan: streetPlan,
        counted: streetCounted,
        pending: pending,
        status: status > 100 ? 100 : status,
        errors: streetErrors,
        surplus: streetSurplus,
        shortage: streetShortage,
        finalized: streetFinalized,
        pickingPlan,
        pickingCounted,
        pickingPending,
        pickingStatus: pickingStatus > 100 ? 100 : pickingStatus,
        pulmaoPlan,
        pulmaoCounted,
        pulmaoPending,
        pulmaoStatus: pulmaoStatus > 100 ? 100 : pulmaoStatus
      });
    }

    metrics.pickingPositions = totalPickingPlan;
    metrics.pickingCounted = totalPickingCounted;
    metrics.pickingPending = totalPickingCounted - totalPickingPlan;
    metrics.pulmaoPositions = totalPulmaoPlan;
    metrics.pulmaoCounted = totalPulmaoCounted;
    metrics.pulmaoPending = totalPulmaoCounted - totalPulmaoPlan;

    return metrics;
  }, []);

  const syncGoogleSheets = useCallback(async () => {
    setUploading(true);
    setSyncError(null);
    try {
      // Use cache buster with random number + timestamp to definitely bypass cache
      const cacheBuster = `?t=${Date.now()}&z=${Math.random().toString(36).substring(7)}`;
      console.log(`[Sync] Sincronização iniciada: ${new Date().toLocaleTimeString()}`);
      
      const response = await fetch(`${SPREADSHEET_URL}${cacheBuster}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error(`[Sync] Erro na resposta: ${response.status} ${response.statusText}`);
        throw new Error('Falha ao buscar dados do Google Sheets. Verifique se a planilha está pública.');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log(`[Sync] Download concluído: ${arrayBuffer.byteLength} bytes recebidos.`);
      
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      console.log(`[Sync] Planilha lida com sucesso. Abas encontradas: ${wb.SheetNames.join(', ')}`);
      
      const metrics = await processWorkbook(wb);
      
      // Update local state immediately so this browser shows the latest data
      setData(metrics);
      setLastSync(new Date());

      try {
        localStorage.setItem('dashboard_data_local', JSON.stringify(metrics));
      } catch (locErr) {
        console.warn("Failed to write to localStorage:", locErr);
      }

      if (isAdmin) {
        console.log(`[Sync] Dados processados. Enviando para o Firebase...`);
        try {
          const docRef = doc(db, 'dashboard', 'latest');
          await setDoc(docRef, {
            ...metrics,
            v: Date.now(), // Force document update even if other data is identical
            updatedAt: new Date().toISOString(),
            updatedBy: user?.email || 'Google Sheets Sync AUTO'
          });
          console.log(`[Sync] Sucesso! Dashboard atualizado no Firebase em ${new Date().toLocaleTimeString()}`);
        } catch (fbErr) {
          console.error(`[Sync] Falha ao enviar para o Firebase (provavelmente limite de cota de escrita atingido):`, fbErr);
          setSyncError("Planilha lida com sucesso! Sincronizado localmente (Firebase sem cota de escrita).");
        }
      } else {
        console.log(`[Sync] Sucesso! Dashboard atualizado localmente.`);
      }
    } catch (error) {
      console.error("[Sync] Erro crítico:", error);
      setSyncError(error instanceof Error ? error.message : "Erro desconhecido na sincronização");
    } finally {
      setUploading(false);
    }
  }, [isAdmin, user, processWorkbook]);

  // --- Auth & Sync ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Fallback if auth takes too long or we want to allow immediate access
    const timeout = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsubscribeAuth();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const docRef = doc(db, 'dashboard', 'latest');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const snapData = docSnap.data() as DashboardMetrics;
        setData(snapData);
        try {
          localStorage.setItem('dashboard_data_local', JSON.stringify(snapData));
        } catch (e) {
          console.warn("localStorage quota exceeded", e);
        }
      }
    }, (error) => {
      console.warn("Firestore snapshot loading error (likely quota exceeded). Falling back to localStorage data.", error);
      // Suppress throwing error to avoid ErrorBoundary app crash. Let the cached datasets power the view.
      try {
        const cached = localStorage.getItem('dashboard_data_local');
        if (cached) {
          setData(JSON.parse(cached));
        }
      } catch (e) {
        console.error("Failed to parse cached local dataset", e);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Periodic Sync (every 1 minute for all users to fetch current spreadsheets)
  useEffect(() => {
    syncGoogleSheets();
    const interval = setInterval(syncGoogleSheets, 60000);
    return () => clearInterval(interval);
  }, [syncGoogleSheets]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full p-12 rounded-3xl border border-slate-200 bg-white flex flex-col items-center text-center shadow-xl"
        >
          <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
            <RefreshCw className={cn("w-10 h-10 text-emerald-600", uploading && "animate-spin")} />
          </div>
          <h1 className="text-3xl font-bold text-slate-950 mb-2">Contagem Cíclica</h1>
          <p className="text-slate-600 mb-8 max-w-sm">
            {uploading 
              ? "Sincronizando dados com a planilha Google Sheets..." 
              : "Aguardando sincronização inicial dos dados."}
          </p>
          
          <button onClick={handleLogout} className="mt-8 text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </motion.div>
      </div>
    );
  }

  const getStreetDisplayMetrics = (street: StreetData) => {
    if (streetTypeFilter === 'PICKING') {
      const plan = street.pickingPlan || 0;
      const counted = street.pickingCounted || 0;
      const pending = street.pickingPending || 0;
      const status = street.pickingStatus || 0;
      return { plan, counted, pending, status, typeLabel: 'Picking' };
    }
    if (streetTypeFilter === 'PULMAO') {
      const plan = street.pulmaoPlan || 0;
      const counted = street.pulmaoCounted || 0;
      const pending = street.pulmaoPending || 0;
      const status = street.pulmaoStatus || 0;
      return { plan, counted, pending, status, typeLabel: 'Pulmão' };
    }
    return {
      plan: street.plan,
      counted: street.counted,
      pending: street.pending,
      status: street.status,
      typeLabel: 'Geral'
    };
  };

  const filteredStreets = data.streets.filter(s => {
    if (!(s.plan > 0)) return false;
    
    if (streetSearchTerm && !s.name.toUpperCase().includes(streetSearchTerm.toUpperCase())) {
      return false;
    }

    if (streetTypeFilter === 'PICKING' && !(s.pickingPlan && s.pickingPlan > 0)) {
      return false;
    }
    if (streetTypeFilter === 'PULMAO' && !(s.pulmaoPlan && s.pulmaoPlan > 0)) {
      return false;
    }

    return true;
  });

  const activePositions = streetTypeFilter === 'PICKING' 
    ? (data.pickingPositions || 0) 
    : streetTypeFilter === 'PULMAO' 
      ? (data.pulmaoPositions || 0) 
      : data.totalPositions;

  const activeCounted = streetTypeFilter === 'PICKING' 
    ? (data.pickingCounted || 0) 
    : streetTypeFilter === 'PULMAO' 
      ? (data.pulmaoCounted || 0) 
      : data.totalCounted;

  const activePending = Math.max(0, activePositions - activeCounted);

  const activeAccuracy = streetTypeFilter === 'PICKING'
    ? ((data.pickingCounted || 0) / (data.pickingPositions || 1) * 100)
    : streetTypeFilter === 'PULMAO'
      ? ((data.pulmaoCounted || 0) / (data.pulmaoPositions || 1) * 100)
      : data.accuracy;

  const activeGeneralStatus = activePositions > 0 ? (activeCounted / activePositions) * 100 : 0;

  const chartData = filteredStreets.map(s => {
    const display = getStreetDisplayMetrics(s);
    return {
      name: s.name,
      Plano: display.plan,
      Contado: display.counted,
      Pendente: display.pending,
      Erros: s.errors,
      Sobra: s.surplus,
      Falta: s.shortage,
      Finalizadas: s.finalized
    };
  });

  const pieData = [
    { name: 'Contado', value: activeCounted, color: '#10b981' },
    { name: 'Pendente', value: activePending, color: '#f43f5e' },
  ];

  const theme = getTheme(activeModule);

  const modules: { name: Module, icon: any }[] = [
    { name: 'INVENTARIO CÍCLICO', icon: LayoutDashboard },
    { name: 'MAPA DE OCUPAÇÃO', icon: Box },
    { name: 'INVENTARIO GERAL GIROTRADE', icon: Box },
    { name: 'ANALISE DE CORTE', icon: Scissors },
    { name: 'AVARIA', icon: AlertTriangle }
  ];

  return (
    <div 
      className={cn("min-h-screen flex flex-row font-sans relative overflow-hidden transition-colors duration-500", theme.bg)}
      style={{
        ['--bg-color' as any]: theme.realBg || '#ffffff',
        ['--wave-1-url' as any]: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 300'%3E%3Cpath fill='${encodeURIComponent(theme.wave1)}' d='M0,150 C150,50 350,250 500,150 C650,50 850,250 1000,150 L1000,300 L0,300 Z'/%3E%3C/svg%3E")`,
        ['--wave-2-url' as any]: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 300'%3E%3Cpath fill='${encodeURIComponent(theme.wave2)}' d='M0,150 C150,250 350,50 500,150 C650,250 850,50 1000,150 L1000,300 L0,300 Z'/%3E%3C/svg%3E")`
      }}
    >
      {/* Sidebar */}
      <aside className={cn("w-64 backdrop-blur-3xl border-r flex flex-col z-10 shadow-2xl transition-colors duration-500", theme.sidebarBg ? theme.sidebarBg.replace('bg-white', 'bg-white/95') : 'bg-white/95', theme.border)}>
        <div className={cn("p-6 border-b", theme.border)}>
          <div className="flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-lg", theme.active)}>
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <span className={cn("font-bold tracking-wider text-sm uppercase", theme.accent)}>Menu Dashboard</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <div className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-2", theme.text)}>
            Relatórios & Filtros
          </div>
          {modules.map((m) => (
            <button
              key={m.name}
              onClick={() => setActiveModule(m.name)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl text-[11px] font-bold transition-all duration-300 flex items-center gap-3 group",
                activeModule === m.name 
                  ? `${theme.active} text-white shadow-lg ${theme.shadow}` 
                  : cn("text-slate-400 hover:bg-white/40 hover:text-slate-900")
              )}
            >
              <m.icon className={cn(
                "w-4 h-4 transition-all duration-300",
                activeModule === m.name ? "text-white" : "text-slate-300 group-hover:text-slate-600"
              )} />
              {m.name}
            </button>
          ))}
        </nav>

        <div className={cn("p-4 border-t", theme.border)}>
          <div className={cn("rounded-xl p-4 border", `bg-${theme.primary}-50/30`, theme.border)}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", `bg-${theme.primary}-500`)} />
              <span className={cn("text-[10px] font-bold uppercase tracking-widest", theme.text)}>Status Sistema</span>
            </div>
            <p className={cn("text-[9px] leading-relaxed", theme.text, "opacity-60")}>
              Sincronização ativa com Google Sheets. Atualização a cada 1min.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Moving Waves Background */}
        <div className="wave-container">
          <div className="wave wave-1"></div>
          <div className="wave wave-2"></div>
        </div>

      {/* Background Watermark Logo */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[-1]">
        <div className="flex items-center gap-0 scale-[12] md:scale-[25] lg:scale-[35] transition-all duration-700 animate-pulse-slow">
          <div className="w-20 h-16 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full filter blur-[0.2px]">
              <path 
                d="M 15 45 A 16 16 0 0 1 47 45" 
                fill="none" 
                stroke={theme.logoTop || "#334155"} 
                strokeWidth="6" 
                strokeLinecap="round"
              />
              <path 
                d="M 32 55 A 16 16 0 0 0 64 55" 
                fill="none" 
                stroke={theme.logo} 
                strokeWidth="6" 
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-transparent">
        <div className="max-w-7xl mx-auto">
          {activeModule === 'INVENTARIO CÍCLICO' ? (
            <>
              <div className={cn("flex flex-col md:flex-row justify-between items-center md:items-start mb-10 backdrop-blur-sm p-6 rounded-3xl border gap-6 md:gap-0 transition-colors duration-500", theme.contentBg, theme.contentBorder, theme.contentShadow)}>
            {/* Logo Area - Now Transparent */}
            <div className="flex items-center gap-0">
            <div className="w-20 h-16 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Top Curve - White */}
                <path 
                  d="M 15 45 A 16 16 0 0 1 47 45" 
                  fill="none" 
                  stroke={theme.logoTop || "#334155"} 
                  strokeWidth="12" 
                  strokeLinecap="round"
                />
                {/* Bottom Curve - Green */}
                <path 
                  d="M 32 55 A 16 16 0 0 0 64 55" 
                  fill="none" 
                  stroke={theme.logo} 
                  strokeWidth="12" 
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex flex-col -ml-6">
              <span className={cn("text-[32px] font-bold leading-[0.8] lowercase tracking-tight", theme.contentTitle)}>giro</span>
              <span className={cn("text-[32px] font-bold leading-[0.8] lowercase tracking-tight ml-[12px]", theme.contentText)}>trade</span>
            </div>
          </div>

          {/* Central Header */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="hidden sm:flex flex-col items-center justify-center flex-1 px-4 mt-1"
          >
            <div className="relative">
              <h1 className={cn("text-xl md:text-2xl lg:text-3xl font-black tracking-[0.15em] uppercase leading-none", theme.contentTitle)}>
                Inventário <span className={theme.contentText}>Cíclico</span>
              </h1>
              <div className="absolute -bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                <div className={cn("hidden md:block h-[2px] w-8 lg:w-12 bg-gradient-to-r from-transparent", `to-${theme.primary}-500/20`)}></div>
                <span className={cn("text-[7px] md:text-[9px] font-black uppercase tracking-[0.4em] whitespace-nowrap opacity-60", theme.contentText)}>
                  Performance & Acuracidade
                </span>
                <div className={cn("hidden md:block h-[2px] w-8 lg:w-12 bg-gradient-to-l from-transparent", `to-${theme.primary}-500/20`)}></div>
              </div>
            </div>
          </motion.div>

          {/* Signature and Actions */}
          <div className="flex flex-col items-end gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-slate-900 tracking-tight">Created by Thiago.Henrique</span>
              <span className={cn("text-[10px] font-medium uppercase tracking-widest", `${theme.contentText}/70`)}>junior inventory analyst</span>
              {data.updatedAt && (
                <div className="mt-1 flex items-center gap-1.5">
                  <Clock className={cn("w-3 h-3", theme ? theme.contentText : 'text-slate-400')} />
                  <span className={cn("text-[9px] font-medium uppercase tracking-wider", theme ? theme.contentText : 'text-slate-400')}>
                    Atualizado em: {new Date(data.updatedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
             <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <div className={cn("flex items-center gap-2 px-3 py-1.5 border rounded-lg", `bg-${theme.primary}-500/5`, `border-${theme.primary}-500/10`)}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", syncError ? "bg-rose-500" : `bg-${theme.primary}-500`, (uploading || !syncError) ? "animate-pulse" : "")} />
                  <span className={cn("text-[10px] font-bold uppercase tracking-widest", theme.contentText)}>
                    {uploading ? "Sincronizando..." : syncError ? "Erro Sinc." : isAdmin ? "Sinc. Nuvem" : "Sinc. Local"}
                  </span>
                </div>
                {syncError && (
                  <span className="text-[7px] text-rose-500 font-bold uppercase mt-1 max-w-[120px] text-right truncate">
                    {syncError}
                  </span>
                )}
              </div>

              <button 
                onClick={() => syncGoogleSheets()}
                disabled={uploading}
                className={cn(
                  "p-2 rounded-lg border transition-all hover:scale-105 active:scale-95",
                  theme.primary === 'rose' ? "bg-rose-500 text-white border-rose-600 shadow-md" : "bg-blue-500 text-white border-blue-600 shadow-md",
                  uploading && "opacity-50 cursor-not-allowed"
                )}
                title="Sincronizar Agora"
              >
                <RefreshCw className={cn("w-4 h-4", uploading && "animate-spin")} />
              </button>

              {user ? (
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 border border-rose-200 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-all"
                >
                  <LogOut className="w-3 h-3" />
                  Sair
                </button>
              ) : (
                <button 
                  onClick={handleLogin}
                  className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-lg", theme.active, theme.shadow)}
                >
                  <LogIn className="w-3 h-3" />
                  LogIn
                </button>
              )}
            </div>
          </div>
        </div>

        <header className="mb-8 text-center">
          <div className="mb-6">
            <h2 className={cn("text-4xl font-bold drop-shadow-sm", theme.headerTitle || theme.contentTitle)}>{activeModule === 'INVENTARIO CÍCLICO' ? 'Planejamento Cíclico' : activeModule}</h2>
            <p className={cn("font-medium", theme.headerText || theme.contentText)}>Acompanhamento em tempo real da performance operacional.</p>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-end justify-center gap-4">
            <nav className={cn("flex flex-wrap gap-2 p-1 backdrop-blur-md rounded-2xl border w-fit shadow-sm", theme.contentBg, theme.contentBorder)}>
              <button 
                onClick={() => setActiveTab('overview')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                  activeTab === 'overview' ? `${theme.active} shadow-lg ${theme.shadow}` : cn(theme ? theme.contentText : "text-black/60", "opacity-60 hover:opacity-100 transition-opacity")
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                Visão Geral
              </button>
              <button 
                onClick={() => setActiveTab('streets')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                  activeTab === 'streets' ? `${theme.active} shadow-lg ${theme.shadow}` : cn(theme ? theme.contentText : "text-black/60", "opacity-60 hover:opacity-100 transition-opacity")
                )}
              >
                <Map className="w-4 h-4" />
                Detalhes por Rua
              </button>
              <button 
                onClick={() => setActiveTab('errors')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                  activeTab === 'errors' ? `${theme.active} shadow-lg ${theme.shadow}` : cn(theme ? theme.contentText : "text-black/60", "opacity-60 hover:opacity-100 transition-opacity")
                )}
              >
                <AlertCircle className="w-4 h-4" />
                Análise de Erros
              </button>
              <button 
                onClick={() => setActiveTab('daily')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                  activeTab === 'daily' ? `${theme.active} shadow-lg ${theme.shadow}` : cn(theme ? theme.contentText : "text-black/60", "opacity-60 hover:opacity-100 transition-opacity")
                )}
              >
                <Clock className="w-4 h-4" />
                Contagem Diária
              </button>
            </nav>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="space-y-8"
            >
              {/* Filtro de Nível Superior */}
              <div className={cn("backdrop-blur-md p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className={cn("text-xs font-black uppercase tracking-wider", theme.contentTitle)}>Filtro por Nível Operacional</h4>
                    <p className="text-[10px] text-slate-400 font-medium">As métricas de todo o painel serão recalculadas instantaneamente.</p>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  {[
                    { id: 'ALL', label: 'Geral (Todos)' },
                    { id: 'PICKING', label: 'Picking (Nível 1)' },
                    { id: 'PULMAO', label: 'Pulmão (Níveis 2-6)' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setStreetTypeFilter(tab.id as any)}
                      className={cn(
                        "flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap",
                        streetTypeFilter === tab.id 
                          ? "bg-emerald-500 text-white shadow-lg ring-2 ring-emerald-500/20"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                  title="Total de Posições" 
                  value={activePositions} 
                  icon={LayoutDashboard} 
                  color="bg-emerald-800"
                  subtitle={streetTypeFilter === 'PICKING' ? 'Plano (Picking)' : streetTypeFilter === 'PULMAO' ? 'Plano (Pulmão)' : 'Plano (Geral)'}
                  theme={theme}
                />
                <MetricCard 
                  title="Posições Contadas" 
                  value={activeCounted} 
                  icon={CheckCircle2} 
                  color="bg-emerald-600"
                  subtitle={`${((activeCounted / activePositions) * 100).toFixed(2)}%`}
                  theme={theme}
                />
                <MetricCard 
                  title="Pendentes" 
                  value={activePending} 
                  icon={Clock} 
                  color="bg-emerald-700"
                  subtitle={`${((activePending / activePositions) * 100).toFixed(2)}%`}
                  theme={theme}
                />
                <MetricCard 
                  title="Acuracidade" 
                  value={`${activeAccuracy.toFixed(2)}%`} 
                  icon={TrendingUp} 
                  color="bg-emerald-500"
                  subtitle="Meta: 99,5%"
                  theme={theme}
                />
              </div>

              {/* Detalhamento de Nível (Picking vs Pulmão) */}
              <div className={cn("backdrop-blur-md p-6 rounded-2xl border shadow-sm transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                <h3 className={cn("text-lg font-bold mb-1 flex items-center gap-2", theme.contentTitle)}>
                  <Box className="w-5 h-5 text-emerald-500" /> Detalhamento por Nível (Picking vs Pulmão)
                </h3>
                <p className="text-xs text-slate-400 mb-4">Clique nos blocos abaixo para alternar o filtro de visualização do dashboard.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card Picking */}
                  <div 
                    onClick={() => setStreetTypeFilter(streetTypeFilter === 'PICKING' ? 'ALL' : 'PICKING')}
                    className={cn(
                      "p-5 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col justify-between hover:scale-[1.01] select-none",
                      streetTypeFilter === 'PICKING'
                        ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 shadow-lg"
                        : "border-white/5 bg-white/5 hover:border-emerald-500/30 hover:bg-white/10"
                    )}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-emerald-400">Picking (Nível 1)</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                          streetTypeFilter === 'PICKING'
                            ? "bg-emerald-500 text-white"
                            : "bg-emerald-500/10 text-emerald-400"
                        )}>
                          {streetTypeFilter === 'PICKING' ? 'Filtrado' : 'Atendimento Direto'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Posições</span>
                          <span className={cn("text-lg font-black font-mono", theme.contentTitle)}>{data.pickingPositions || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Contados</span>
                          <span className={cn("text-lg font-black font-mono", theme.contentTitle)}>{data.pickingCounted || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Pendentes</span>
                          <span className={cn("text-lg font-black font-mono text-rose-400")}>{Math.max(0, (data.pickingPositions || 0) - (data.pickingCounted || 0))}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Acurácia de Cobertura</span>
                        <span className="text-emerald-400">
                          {((data.pickingCounted || 0) / (data.pickingPositions || 1) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-400 transition-all duration-500" 
                          style={{ width: `${Math.min(((data.pickingCounted || 0) / (data.pickingPositions || 1) * 100), 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Pulmão */}
                  <div 
                    onClick={() => setStreetTypeFilter(streetTypeFilter === 'PULMAO' ? 'ALL' : 'PULMAO')}
                    className={cn(
                      "p-5 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col justify-between hover:scale-[1.01] select-none",
                      streetTypeFilter === 'PULMAO'
                        ? "border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/20 shadow-lg"
                        : "border-white/5 bg-white/5 hover:border-sky-500/30 hover:bg-white/10"
                    )}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-sky-400">Pulmão (Nivel 2 ao 6)</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                          streetTypeFilter === 'PULMAO'
                            ? "bg-sky-500 text-white"
                            : "bg-sky-500/10 text-sky-400"
                        )}>
                          {streetTypeFilter === 'PULMAO' ? 'Filtrado' : 'Estoque de Reserva'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Posições</span>
                          <span className={cn("text-lg font-black font-mono", theme.contentTitle)}>{data.pulmaoPositions || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Contados</span>
                          <span className={cn("text-lg font-black font-mono", theme.contentTitle)}>{data.pulmaoCounted || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Pendentes</span>
                          <span className={cn("text-lg font-black font-mono text-rose-400")}>{Math.max(0, (data.pulmaoPositions || 0) - (data.pulmaoCounted || 0))}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Acurácia de Cobertura</span>
                        <span className="text-sky-400">
                          {((data.pulmaoCounted || 0) / (data.pulmaoPositions || 1) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div 
                          className="h-full bg-sky-400 transition-all duration-500" 
                          style={{ width: `${Math.min(((data.pulmaoCounted || 0) / (data.pulmaoPositions || 1) * 100), 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className={cn("lg:col-span-2 backdrop-blur-md p-6 rounded-2xl border shadow-sm transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                  <h3 className={cn("text-lg font-bold mb-1", theme.contentTitle)}>Progresso por Rua</h3>
                  <p className="text-xs text-slate-400 mb-6">Exibição baseada no filtro selecionado ({streetTypeFilter === 'ALL' ? 'Geral' : streetTypeFilter === 'PICKING' ? 'Picking' : 'Pulmão'}).</p>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barGap={-16}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: '#111', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.4)' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend iconType="circle" />
                        <Bar name="Plano" dataKey="Plano" fill="#ffffff" opacity={0.1} barSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Bar name="Contado" dataKey="Contado" fill={streetTypeFilter === 'PULMAO' ? '#38bdf8' : '#4ade80'} barSize={16} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={cn("backdrop-blur-md p-6 rounded-2xl border shadow-sm flex flex-col transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                  <h3 className={cn("text-lg font-bold mb-1", theme.contentTitle)}>Status Geral</h3>
                  <p className="text-xs text-slate-400 mb-6">Proporção de cobertura {streetTypeFilter === 'ALL' ? 'geral' : streetTypeFilter === 'PICKING' ? 'de picking' : 'de pulmão'}.</p>
                  <div className="flex-1 flex items-center justify-center relative">
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className={cn("text-3xl font-bold", theme.contentTitle)}>{activeGeneralStatus.toFixed(1)}%</span>
                      <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Concluído</span>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? (streetTypeFilter === 'PULMAO' ? '#38bdf8' : '#10b981') : 'rgba(255,255,255,0.1)'} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ color: '#000' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 mt-4">
                    {pieData.map((item, index) => (
                      <div key={item.name} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: index === 0 ? (streetTypeFilter === 'PULMAO' ? '#38bdf8' : '#10b981') : 'rgba(255,255,255,0.2)' }} />
                          <span className="text-sm text-white/60">{item.name}</span>
                        </div>
                        <span className={cn("text-sm font-bold", theme.contentTitle)}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'streets' && (
            <div className="space-y-4">
              {/* Filtros e Busca da Rua */}
              <div className={cn("backdrop-blur-md p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 opacity-50" />
                  <input
                    type="text"
                    placeholder="Pesquisar rua..."
                    value={streetSearchTerm}
                    onChange={(e) => setStreetSearchTerm(e.target.value)}
                    className={cn(
                      "w-full pl-9 pr-4 py-2 text-xs border rounded-xl bg-white/5 focus:outline-none transition-colors",
                      theme.primary === 'rose' 
                        ? 'border-rose-200 focus:border-rose-500 text-slate-800 focus:bg-white' 
                        : 'border-white/10 focus:border-emerald-500 text-white'
                    )}
                  />
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className={cn("text-xs font-bold whitespace-nowrap", theme.contentText)}>Nível:</span>
                  <select
                    value={streetTypeFilter}
                    onChange={(e) => setStreetTypeFilter(e.target.value as any)}
                    className={cn(
                      "px-3 py-2 text-xs border rounded-xl focus:outline-none transition-colors cursor-pointer",
                      theme.primary === 'rose'
                        ? 'border-rose-200 text-slate-800 bg-white'
                        : 'border-white/10 text-slate-100 bg-slate-900'
                    )}
                  >
                    <option value="ALL">Visualizar Geral (Todas as posições)</option>
                    <option value="PICKING">Somente Picking (Nível 1)</option>
                    <option value="PULMAO">Somente Pulmão (Nível 2-6)</option>
                  </select>
                </div>
              </div>

              <motion.div 
                key="streets"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={cn("backdrop-blur-md rounded-2xl border shadow-lg overflow-hidden transition-all duration-500", theme.contentBg, theme.contentBorder)}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b transition-all duration-500 bg-white/5 border-white/10">
                        <th className={cn("px-6 py-4 text-xs font-semibold uppercase tracking-wider opacity-70", theme.contentText)}>Rua</th>
                        <th className={cn("px-6 py-4 text-xs font-semibold uppercase tracking-wider opacity-70", theme.contentText)}>Plano ({streetTypeFilter === 'ALL' ? 'Fixo' : streetTypeFilter === 'PICKING' ? 'Picking' : 'Pulmão'})</th>
                        <th className={cn("px-6 py-4 text-xs font-semibold uppercase tracking-wider opacity-70", theme.contentText)}>Contado</th>
                        <th className={cn("px-6 py-4 text-xs font-semibold uppercase tracking-wider opacity-70", theme.contentText)}>Pendente</th>
                        <th className={cn("px-6 py-4 text-xs font-semibold uppercase tracking-wider opacity-70", theme.contentText)}>Status (%)</th>
                        <th className={cn("px-6 py-4 text-xs font-semibold uppercase tracking-wider opacity-70", theme.contentText)}>Progresso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y transition-all duration-500 divide-white/5">
                      {filteredStreets.map((street) => {
                        const display = getStreetDisplayMetrics(street);
                        return (
                          <tr key={street.id} className="transition-colors group hover:bg-white/5">
                            <td className={cn("px-6 py-4 font-medium", theme.contentTitle)}>
                              <div className="flex flex-col">
                                <span className="font-bold">{street.name}</span>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                    theme.primary === 'rose' ? "bg-slate-100 text-slate-600" : "bg-white/5 text-white/60"
                                  )}>
                                    Picking: <span className="text-emerald-500 font-extrabold">{street.pickingCounted || 0}</span>/{street.pickingPlan || 0}
                                  </span>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                    theme.primary === 'rose' ? "bg-slate-100 text-slate-600" : "bg-white/5 text-white/60"
                                  )}>
                                    Pulmão: <span className="text-sky-500 font-extrabold">{street.pulmaoCounted || 0}</span>/{street.pulmaoPlan || 0}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className={cn("px-6 py-4 opacity-70", theme.contentText)}>{display.plan}</td>
                            <td className={cn("px-6 py-4 font-semibold", theme.contentTitle)}>{display.counted}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-lg text-xs font-bold",
                                display.pending < 0 ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                              )}>
                                {display.pending}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-emerald-400">
                              {display.status.toFixed(2)}%
                            </td>
                            <td className="px-6 py-4 w-48">
                              <div className="w-full h-2 rounded-full overflow-hidden bg-white/10">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(display.status, 100)}%` }}
                                  className={cn(
                                    "h-full transition-all",
                                    display.status >= 100 ? "bg-emerald-400" : "bg-emerald-500"
                                  )}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          )}

          {activeTab === 'errors' && (
            <motion.div 
              key="errors"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className={cn("backdrop-blur-md p-8 rounded-3xl border shadow-lg flex flex-col items-center text-center transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                    <AlertCircle className={cn("w-8 h-8", theme.contentTitle)} />
                  </div>
                  <h3 className={cn("text-xl font-bold mb-2", theme.contentTitle)}>Total de Erros</h3>
                  <p className={cn("mb-6 font-medium opacity-80", theme.contentText)}>Soma total de divergências (Sobra e Falta) identificadas na contagem.</p>
                  <div className={cn("text-5xl font-black mb-2", theme.contentTitle)}>
                    {data.totalErrors}
                  </div>
                  <div className="flex gap-4 mb-4">
                    <div className="flex flex-col">
                      <span className={cn("text-xs font-bold uppercase opacity-70", theme.contentText)}>Sobra (+)</span>
                      <span className="text-lg font-bold text-emerald-400">{data.surplus}</span>
                    </div>
                    <div className="w-px h-8 bg-white/10 self-center" />
                    <div className="flex flex-col">
                      <span className={cn("text-xs font-bold uppercase opacity-70", theme.contentText)}>Falta (-)</span>
                      <span className="text-lg font-bold text-rose-400">{data.shortage}</span>
                    </div>
                  </div>
                  <span className={cn("text-sm font-medium uppercase tracking-widest opacity-80", theme.contentText)}>Unidades Totais</span>
                </div>

                <div className={cn("backdrop-blur-md p-8 rounded-3xl border shadow-lg flex flex-col items-center text-center transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                    <CheckCircle2 className={cn("w-8 h-8", theme.contentTitle)} />
                  </div>
                  <h3 className={cn("text-xl font-bold mb-2", theme.contentTitle)}>Divergências Finalizadas</h3>
                  <p className={cn("mb-6 font-medium opacity-80", theme.contentText)}>Quantidade de divergências que já foram tratadas e concluídas.</p>
                  <div className={cn("text-5xl font-black mb-2", theme.contentTitle)}>
                    {data.finalizedDivergences}
                  </div>
                </div>

                <div className={cn("backdrop-blur-md p-8 rounded-3xl border shadow-lg flex flex-col items-center text-center transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                    <TrendingUp className={cn("w-8 h-8", theme.contentTitle)} />
                  </div>
                  <h3 className={cn("text-xl font-bold mb-2", theme.contentTitle)}>Acuracidade Final</h3>
                  <p className={cn("mb-6 font-medium opacity-80", theme.contentText)}>Percentual após analise das Divergências</p>
                  <div className={cn("text-5xl font-black mb-2", theme.contentTitle)}>
                    {data.finalAccuracy.toFixed(2)}%
                  </div>
                  <span className={cn("text-sm font-medium uppercase tracking-widest opacity-90", theme.contentText)}>Precisão</span>
                </div>
              </div>

              <div className={cn("backdrop-blur-md p-6 rounded-2xl border shadow-lg transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                <h3 className={cn("text-lg font-bold mb-6", theme.contentTitle)}>Análise de Divergência por Rua</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.primary === 'rose' ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme.primary === 'rose' ? '#64748b' : 'rgba(255,255,255,0.6)', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: theme.primary === 'rose' ? '#64748b' : 'rgba(255,255,255,0.6)', fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme.primary === 'rose' ? '#fff' : '#1a1a1a', 
                          borderRadius: '12px', 
                          border: theme.primary === 'rose' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                          color: theme.primary === 'rose' ? '#000' : '#fff'
                        }}
                        itemStyle={{ color: theme.primary === 'rose' ? '#000' : '#fff' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="Erros" stroke="#f43f5e" strokeWidth={3} dot={{ r: 6, fill: '#f43f5e' }} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="Finalizadas" stroke="#10b981" strokeWidth={3} dot={{ r: 6, fill: '#10b981' }} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="Sobra" name="Quantidade para mais (+)" stroke="#10b981" hide legendType="none" />
                      <Line type="monotone" dataKey="Falta" name="Quantidade para menos (-)" stroke="#fb7185" hide legendType="none" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'daily' && (
            <motion.div 
              key="daily"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className={cn("backdrop-blur-md p-8 rounded-3xl border shadow-lg flex flex-col items-center text-center opacity-95 transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                    <TrendingUp className={cn("w-8 h-8", theme.contentTitle)} />
                  </div>
                  <h3 className={cn("text-xl font-bold mb-2", theme.contentTitle)}>Meta Semanal</h3>
                  <p className={cn("mb-6 font-medium opacity-80", theme.contentText)}>Objetivo de contagem semanal (Meta Mês / 4).</p>
                  <div className={cn("text-5xl font-black mb-2", theme.contentTitle)}>
                    {data.weeklyGoalCalculated || 2852}
                  </div>
                  <span className={cn("text-sm font-medium uppercase tracking-widest opacity-90", theme.contentText)}>Unidades</span>
                </div>

                <div className={cn("backdrop-blur-md p-10 rounded-3xl border-4 shadow-2xl flex flex-col items-center text-center transform scale-105 z-10 transition-all duration-500", theme.contentBg, "border-white/20")}>
                  <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-6 border border-white/40">
                    <Clock className={cn("w-10 h-10", theme.contentTitle)} />
                  </div>
                  <h3 className={cn("text-2xl font-bold mb-2", theme.contentTitle)}>Meta Diária</h3>
                  <p className={cn("mb-6 font-medium opacity-80", theme.contentText)}>Meta calculada por dia útil (26 dias).</p>
                  <div className={cn("text-6xl font-black mb-2", theme.contentTitle)}>
                    {data.dailyGoal || 439}
                  </div>
                  <span className={cn("text-sm font-medium uppercase tracking-widest opacity-90", theme.contentText)}>Posições / Dia</span>
                </div>

                <div className={cn("backdrop-blur-md p-8 rounded-3xl border shadow-lg flex flex-col items-center text-center opacity-95 transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                    <FileSpreadsheet className={cn("w-8 h-8", theme.contentTitle)} />
                  </div>
                  <h3 className={cn("text-xl font-bold mb-2", theme.contentTitle)}>Meta Mês</h3>
                  <p className={cn("mb-6 font-medium opacity-80", theme.contentText)}>Quantidade total de posições.</p>
                  <div className={cn("text-5xl font-black mb-2", theme.contentTitle)}>
                    {data.totalPositions || 11408}
                  </div>
                  <span className={cn("text-sm font-medium uppercase tracking-wider mb-6 opacity-90", theme.contentText)}>Total Posições</span>
                  
                  {/* Summary inside Meta Mês */}
                  <div className={cn("w-full pt-6 border-t flex justify-center gap-10", "border-white/10")}>
                    <div className="flex flex-col">
                      <span className={cn("text-[10px] font-bold uppercase tracking-widest opacity-90", theme.contentText)}>Contado</span>
                      <span className="text-2xl font-bold text-emerald-400">{data.totalCounted}</span>
                    </div>
                    <div className={cn("w-px h-10 self-center", "bg-white/10")} />
                    <div className="flex flex-col">
                      <span className={cn("text-[10px] font-bold uppercase tracking-widest opacity-90", theme.contentText)}>Falta</span>
                      <span className="text-2xl font-bold text-rose-400">{data.totalPending}</span>
                    </div>
                  </div>
                </div>
              </div>


              {/* Collaborator Count Section */}
              <div className={cn("backdrop-blur-md p-6 rounded-2xl border shadow-lg overflow-hidden transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={cn("text-lg font-bold", theme.contentTitle)}>CONTAGEM POR COLABORADOR</h3>
                  <span className={cn("text-xs uppercase tracking-widest opacity-80", theme.contentText)}>Desempenho Individual</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {data.collaboratorCounts && data.collaboratorCounts.length > 0 ? (
                    data.collaboratorCounts.map((collab, idx) => (
                      <motion.div 
                        key={idx} 
                        whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                        className={cn("p-4 rounded-xl border flex flex-col items-center text-center relative overflow-hidden group transition-all", theme.contentBorder)}
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest mb-1 opacity-90", theme.contentText)}>{collab.name}</span>
                        <span className={cn("text-2xl font-black", theme.contentTitle)}>{collab.count.toLocaleString('pt-BR')}</span>
                        <span className={cn("text-[10px] uppercase font-medium opacity-50", theme.contentText)}>Unidades Contadas</span>
                      </motion.div>
                    ))
                  ) : (
                    <div className={cn("col-span-full py-4 text-center italic opacity-60", theme.contentText)}>
                      Nenhum dado de colaborador disponível.
                    </div>
                  )}
                </div>
              </div>

              {/* History Table */}
              <div className={cn("backdrop-blur-md p-6 rounded-2xl border shadow-lg overflow-hidden transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={cn("text-lg font-bold", theme.contentTitle)}>Histórico de Contagem (Mês atual)</h3>
                  <span className={cn("text-xs uppercase tracking-widest opacity-80", theme.contentText)}>Excluindo Domingos</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b transition-all duration-500 bg-white/5 border-white/10">
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Data</th>
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Dia</th>
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Contada</th>
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Previsão</th>
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Atingimento (%)</th>
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Status vs Meta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y transition-all duration-500 divide-white/10">
                      {(() => {
                        let accumulatedDeficit = 0;
                        return data.dailyHistory && data.dailyHistory.length > 0 ? (
                          data.dailyHistory.map((item, idx) => {
                            const dailyGoal = data.dailyGoal || 439;
                            
                            // Meta total para hoje = Meta do dia + O que sobrou de ontem
                            const dailyTarget = Math.round(dailyGoal + accumulatedDeficit);
                            
                            // Atingimento referente à meta acumulada (Meta do dia + Déficit anterior)
                            const percentage = dailyTarget > 0 ? (item.count / dailyTarget) * 100 : 100;
                            
                            // Previsão (Saldo para amanhã) = Meta de Hoje + Saldo de Ontem - Contado Hoje
                            const remaining = Math.round(dailyTarget - item.count);
                            
                            // Atualiza o acumulado para a próxima iteração
                            accumulatedDeficit = remaining;

                            let statusColor = "text-emerald-400";
                            let statusBg = "bg-emerald-500/10";
                            let statusText = "Meta Atingida";

                            if (percentage < 50) {
                              statusColor = "text-rose-400";
                              statusBg = "bg-rose-500/20";
                              statusText = "Crítico (<50%)";
                            } else if (percentage < 75) {
                              statusColor = "text-amber-400";
                              statusBg = "bg-amber-500/20";
                              statusText = "Abaixo (50-75%)";
                            } else if (percentage < 100) {
                              statusColor = "text-emerald-400 font-bold";
                              statusBg = "bg-emerald-500/10";
                              statusText = "Próximo (>75%)";
                            }

                            return (
                              <tr 
                                key={idx} 
                                className={cn(
                                  "transition-colors duration-150 border-l-4",
                                  percentage >= 100 
                                    ? "bg-white/10 border-l-emerald-500 hover:bg-white/20"
                                    : "hover:bg-white/5 border-l-transparent"
                                )}
                              >
                                <td className={cn("px-4 py-3 text-sm font-bold", theme.contentTitle)}>{item.date}</td>
                                <td className={cn("px-4 py-3 text-sm opacity-70", theme.contentText)}>{item.dayName}</td>
                                <td className={cn("px-4 py-3 text-sm font-bold", theme.contentTitle)}>{item.count}</td>
                                <td className="px-4 py-3 text-sm text-emerald-400 font-bold">{remaining}</td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "text-sm font-bold",
                                    statusColor
                                  )}>
                                    {percentage.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                                    statusBg,
                                    statusColor
                                  )}>
                                    {statusText}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-300 italic">
                              Nenhum dado de histórico disponível. Faça o upload da planilha com a aba "DIARIO".
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Weekly History Table */}
              <div className={cn("backdrop-blur-md p-6 rounded-2xl border shadow-lg overflow-hidden transition-all duration-500", theme.contentBg, theme.contentBorder)}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={cn("text-lg font-bold", theme.contentTitle)}>Histórico de Contagem Semanal</h3>
                  <span className={cn("text-xs uppercase tracking-widest opacity-80", theme.contentText)}>Agrupado por Período</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b transition-all duration-500 bg-white/5 border-white/10">
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Semana</th>
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Contada</th>
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Previsão</th>
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Atingimento (%)</th>
                        <th className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider opacity-70", theme.contentText)}>Status vs Meta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y transition-all duration-500 divide-white/10">
                      {(() => {
                        let accumulatedWeeklyDeficit = 0;
                        return data.weeklyHistory && data.weeklyHistory.length > 0 ? (
                          data.weeklyHistory.map((item, idx) => {
                            const weeklyGoal = data.weeklyGoalCalculated || 2852;
                            
                            // Meta total para esta semana = Meta da semana + O que sobrou da anterior
                            const weeklyTarget = Math.round(weeklyGoal + accumulatedWeeklyDeficit);
                            
                            // Atingimento referente à meta acumulada (Meta da semana + Déficit anterior)
                            const percentage = weeklyTarget > 0 ? (item.count / weeklyTarget) * 100 : 100;
                            
                            // Previsão (Saldo para próxima semana) = Meta de Hoje + Saldo de Ontem - Contado Hoje
                            const remaining = Math.round(weeklyTarget - item.count);
                            
                            // Atualiza o acumulado para a próxima iteração
                            accumulatedWeeklyDeficit = remaining;

                            let statusColor = "text-emerald-400";
                            let statusBg = "bg-emerald-500/10";
                            let statusText = "Meta Atingida";

                            if (percentage < 50) {
                              statusColor = "text-rose-400";
                              statusBg = "bg-rose-500/20";
                              statusText = "Crítico (<50%)";
                            } else if (percentage < 75) {
                              statusColor = "text-amber-400";
                              statusBg = "bg-amber-500/20";
                              statusText = "Abaixo (50-75%)";
                            } else if (percentage < 100) {
                              statusColor = "text-emerald-400 font-bold";
                              statusBg = "bg-emerald-500/10";
                              statusText = "Próximo (>75%)";
                            }

                            return (
                              <tr 
                                key={idx} 
                                className={cn(
                                  "transition-colors duration-150 border-l-4",
                                  percentage >= 100 
                                    ? "bg-white/10 border-l-emerald-500 hover:bg-white/20"
                                    : "hover:bg-white/5 border-l-transparent"
                                )}
                              >
                                <td className={cn("px-4 py-3 text-sm font-bold", theme.contentTitle)}>{item.weekRange}</td>
                                <td className={cn("px-4 py-3 text-sm font-bold", theme.contentTitle)}>{item.count}</td>
                                <td className="px-4 py-3 text-sm text-emerald-400 font-bold">{remaining}</td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "text-sm font-bold",
                                    statusColor
                                  )}>
                                    {percentage.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                                    statusBg,
                                    statusColor
                                  )}>
                                    {statusText}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-300 italic">
                              Nenhum dado de histórico semanal disponível.
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
            </>
          ) : activeModule === 'MAPA DE OCUPAÇÃO' ? (
            <>
              <div className={cn("flex flex-col md:flex-row justify-between items-center md:items-start mb-10 backdrop-blur-sm p-6 rounded-3xl border gap-6 md:gap-0 transition-colors duration-500", theme.contentBg, theme.contentBorder, theme.contentShadow)}>
        <div className="flex items-center gap-0">
          <div className="w-20 h-16 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M 15 45 A 16 16 0 0 1 47 45" fill="none" stroke={theme.logoTop || "#334155"} strokeWidth="12" strokeLinecap="round" />
              <path d="M 32 55 A 16 16 0 0 0 64 55" fill="none" stroke={theme.logo} strokeWidth="12" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex flex-col -ml-6">
            <span className={cn("text-[32px] font-bold leading-[0.8] lowercase tracking-tight", theme.headerTitle || theme.contentTitle)}>giro</span>
            <span className={cn("text-[32px] font-bold leading-[0.8] lowercase tracking-tight ml-[12px]", theme.headerText || theme.contentText)}>trade</span>
          </div>
        </div>
                
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="hidden sm:flex flex-col items-center justify-center flex-1 px-4 mt-1"
                >
                  <div className="relative">
                    <h1 className={cn("text-xl md:text-2xl lg:text-3xl font-black tracking-[0.15em] uppercase leading-none text-center", theme.headerTitle || theme.contentTitle)}>
                      Ocupação <span className={cn("opacity-70", theme.contentTitle)}>CD</span>
                    </h1>
                    <div className="absolute -bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                      <div className={cn("hidden md:block h-[2px] w-8 lg:w-12 bg-gradient-to-r from-transparent", theme ? "to-white/20" : "to-black/10")}></div>
                      <span className={cn("text-[7px] md:text-[9px] font-black uppercase tracking-[0.4em] whitespace-nowrap opacity-90", theme.contentText)}>
                        Performance & Ocupação
                      </span>
                      <div className={cn("hidden md:block h-[2px] w-8 lg:w-12 bg-gradient-to-l from-transparent", theme ? "to-white/20" : "to-black/10")}></div>
                    </div>
                  </div>
                </motion.div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden lg:block">
                    <div className={cn("text-[8px] font-bold uppercase tracking-widest opacity-70", theme.contentText)}>Created By</div>
                    <div className={cn("text-xs font-black uppercase tracking-tighter leading-none", theme.contentTitle)}>Thiago Rodrigues</div>
                    <div className={cn("text-[8px] font-bold uppercase tracking-[0.2em] mt-1", theme ? (theme.headerText || theme.contentText) : "text-slate-600")}>Inventory Analyst</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white transition-colors">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] font-black text-rose-400 uppercase tracking-widest hover:bg-rose-500/20 transition-all font-sans"
                      >
                        <LogOut className="w-3 h-3" />
                        Sair
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed Navigation at Top */}
              <div className="flex justify-center mb-10 sticky top-0 z-40 py-2">
                <div className={cn("backdrop-blur-md border rounded-2xl p-1 shadow-xl flex items-center gap-1", theme.contentBg, theme.contentBorder)}>
                  <button 
                    onClick={() => setOccupancyView('dashboard')}
                    className={cn(
                      "px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      occupancyView === 'dashboard' ? `${theme.active} ${theme.contentTitle} shadow-lg` : cn("opacity-40 hover:opacity-100", theme.contentText)
                    )}
                  >
                    Visão Analítica
                  </button>
                  <button 
                    onClick={() => setOccupancyView('analitico')}
                    className={cn(
                      "px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      occupancyView === 'analitico' ? `${theme.active} ${theme.contentTitle} shadow-lg` : cn("opacity-40 hover:opacity-100", theme.contentText)
                    )}
                  >
                    Visão Geral
                  </button>
                  <button 
                    onClick={() => setOccupancyView('mapa')}
                    className={cn(
                      "px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      occupancyView === 'mapa' ? `${theme.active} ${theme.contentTitle} shadow-lg` : cn("opacity-40 hover:opacity-100", theme.contentText)
                    )}
                  >
                    MAPA
                  </button>
                </div>
              </div>

              <OccupancyDashboard data={data?.occupancyData} theme={theme} activeView={occupancyView} />
            </>
          ) : (
            <>
              <div className={cn("flex flex-col md:flex-row justify-between items-center md:items-start mb-10 backdrop-blur-sm p-6 rounded-3xl border gap-6 md:gap-0 transition-colors duration-500", theme.contentBg, theme.contentBorder, theme.contentShadow)}>
                <div className="flex items-center gap-0">
                  <div className="w-20 h-16 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <path d="M 15 45 A 16 16 0 0 1 47 45" fill="none" stroke={theme.logoTop || "#334155"} strokeWidth="12" strokeLinecap="round" />
                      <path d="M 32 55 A 16 16 0 0 0 64 55" fill="none" stroke={theme.logo} strokeWidth="12" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex flex-col -ml-6">
                    <span className={cn("text-[32px] font-bold leading-[0.8] lowercase tracking-tight", theme.contentTitle)}>giro</span>
                    <span className={cn("text-[32px] font-bold leading-[0.8] lowercase tracking-tight ml-[12px]", theme.contentText)}>trade</span>
                  </div>
                </div>
                
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="hidden sm:flex flex-col items-center justify-center flex-1 px-4 mt-1"
                >
                  <div className="relative">
                    <h1 className={cn("text-xl md:text-2xl lg:text-3xl font-black tracking-[0.15em] uppercase leading-none text-center", theme.contentTitle)}>
                      {activeModule === 'ANALISE DE CORTE' ? 'Análise de' : 'Inventário'} <span className={theme.contentText}>{activeModule === 'ANALISE DE CORTE' ? 'Corte' : 'Geral'}</span>
                    </h1>
                    <div className="absolute -bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                      <div className={cn("hidden md:block h-[2px] w-8 lg:w-12 bg-gradient-to-r from-transparent", "to-white/10")}></div>
                      <span className={cn("text-[7px] md:text-[9px] font-black uppercase tracking-[0.4em] whitespace-nowrap opacity-60", theme.contentText)}>
                        Performance & Girotrade
                      </span>
                      <div className={cn("hidden md:block h-[2px] w-8 lg:w-12 bg-gradient-to-l from-transparent", "to-white/10")}></div>
                    </div>
                  </div>
                </motion.div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] font-black text-rose-400 uppercase tracking-widest hover:bg-rose-500/20 transition-all font-sans"
                      >
                        <LogOut className="w-3 h-3" />
                        Sair
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {activeModule === 'INVENTARIO GERAL GIROTRADE' ? (
                <InventarioGeralView data={data?.inventarioGT} theme={theme} />
              ) : activeModule === 'ANALISE DE CORTE' ? (
                <CortesDashboard data={data?.cortes} wmsData={data?.cortesWMS} theme={theme} />
              ) : activeModule === 'AVARIA' ? (
                <AvariaDashboard data={data?.avaria} theme={theme} />
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn("min-h-[600px] flex flex-col items-center justify-center backdrop-blur-sm rounded-3xl border p-12 text-center transition-colors duration-500", theme.contentBg, theme.contentBorder, theme.contentShadow)}
                >
                  <div className={cn("w-24 h-24 rounded-3xl flex items-center justify-center mb-8 border", `bg-${theme.primary}-500/10`, `border-${theme.primary}-500/20`)}>
                    <Clock className={cn("w-12 h-12 animate-pulse", theme.contentText)} />
                  </div>
                  <h2 className={cn("text-3xl font-bold mb-4 uppercase tracking-wider", theme.contentTitle)}>{activeModule as string}</h2>
                  <p className={cn("max-w-md mx-auto leading-relaxed opacity-40", theme.contentText)}>
                    Este módulo está sendo preparado para integração com os dados da sua planilha. 
                    Em breve, você poderá visualizar a <span className={cn("font-bold", theme.contentText)}>{(activeModule as string).toLowerCase()}</span> em tempo real.
                  </p>
                  <button 
                    onClick={() => setActiveModule('INVENTARIO CÍCLICO')}
                    className={cn("mt-10 px-8 py-3 text-white rounded-xl font-bold transition-all shadow-lg text-xs uppercase tracking-widest", theme.active, theme.shadow)}
                  >
                    Voltar para Inventário Cíclico
                  </button>
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  </div>
);
}
