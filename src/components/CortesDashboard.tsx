import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Scissors, 
  Calendar, 
  DollarSign, 
  Package, 
  TrendingDown, 
  AlertCircle,
  Search,
  Filter,
  BarChart3,
  ListFilter,
  ArrowUpDown,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  TrendingUp,
  FolderOpen,
  X,
  Eye
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LabelList
} from 'recharts';
import { cn } from '../lib/utils';

// Interfaz para el item de Corte
export interface CortesItem {
  sku: string;
  description: string;
  date: string;
  dateObj?: string | null;
  quantity: number;
  value: number;
  reason: string;
  pedido?: string | null;
}

interface CortesDashboardProps {
  data: CortesItem[] | undefined;
  wmsData?: CortesItem[] | undefined;
  theme: any;
}

export default function CortesDashboard({ data: propsData = [], wmsData = [], theme }: CortesDashboardProps) {
  const [selectedSource, setSelectedSource] = useState<'comercial' | 'wms'>('comercial');

  // Seleciona a fonte ativa de dados de cortes
  const data = useMemo(() => {
    return selectedSource === 'comercial' ? propsData : wmsData;
  }, [selectedSource, propsData, wmsData]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReason, setSelectedReason] = useState('ALL');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [activeTab, setActiveTab ] = useState<'geral' | 'skus' | 'evolucao'>('geral');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [userSelectedSkuDate, setUserSelectedSkuDate] = useState<string>('');
  
  // Período para gráfico
  const [chartPeriod, setChartPeriod] = useState<'day' | 'week' | 'month'>('day');

  // Paginación para la tabla de registros
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Paginación para la tabla de SKUs
  const [currentSkuPage, setCurrentSkuPage] = useState(1);
  const skusPerPage = 10;

  // Lista de meses por extenso em português para filtros
  const MONTHS_PT = useMemo(() => [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ], []);

  // Tradução do mês para o português
  const formatMonth = (dateObj: Date): string => {
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return `${months[dateObj.getMonth()]}/${dateObj.getFullYear()}`;
  };

  // Helper para obter início della semana (segunda-feira)
  const getWeekRange = (dateObj: Date): string => {
    const temp = new Date(dateObj);
    const day = temp.getDay();
    const diff = temp.getDate() - day + (day === 0 ? -6 : 1); // Segunda-feira
    const monday = new Date(temp.setDate(diff));
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const format = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `Sem: ${format(monday)} a ${format(sunday)}`;
  };

  // 1. Processamento e Normalização Inicial
  const processedData = useMemo(() => {
    return data.map(item => {
      let parsedDate: Date | null = null;
      const dateRaw = String(item.date || item.dateObj || "").trim();
      
      if (dateRaw) {
        // Formato DD/MM/YYYY ou D/M/YYYY
        if (dateRaw.includes('/')) {
          const parts = dateRaw.split('/');
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              const fullYear = y < 100 ? 2000 + y : y;
              parsedDate = new Date(fullYear, m, d);
            }
          }
        } else {
          // Tenta Casar com YYYY-MM-DD (ISO)
          const isoMatch = dateRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (isoMatch) {
            const y = parseInt(isoMatch[1], 10);
            const m = parseInt(isoMatch[2], 10) - 1;
            const d = parseInt(isoMatch[3], 10);
            parsedDate = new Date(y, m, d);
          } else {
            // Tenta Casar com DD-MM-YYYY
            const brMatch = dateRaw.match(/^(\d{2})-(\d{2})-(\d{4})/);
            if (brMatch) {
              const d = parseInt(brMatch[1], 10);
              const m = parseInt(brMatch[2], 10) - 1;
              const y = parseInt(brMatch[3], 10);
              parsedDate = new Date(y, m, d);
            } else {
              // Falback constructor nativo
              const d = new Date(dateRaw);
              if (!isNaN(d.getTime())) {
                parsedDate = d;
              }
            }
          }
        }
      }

      return {
        ...item,
        dateObject: parsedDate,
      };
    });
  }, [data]);

  // Razões exclusivas para filtros
  const uniqueReasons = useMemo(() => {
    const reasons = new Set<string>();
    processedData.forEach(item => {
      if (item.reason && item.reason.trim()) {
        reasons.add(item.reason.trim());
      }
    });
    return Array.from(reasons).sort();
  }, [processedData]);

  // Meses exclusivos presentes nos dados no formato YYYY-MM
  const uniqueMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    processedData.forEach(item => {
      const d = item.dateObject;
      if (d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        monthsSet.add(`${year}-${month}`);
      }
    });
    return Array.from(monthsSet).sort();
  }, [processedData]);

  // Gerar rótulo legível em português (Ex: "Janeiro / 2026")
  const getMonthLabel = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split('-');
    const monthIndex = parseInt(month) - 1;
    return `${MONTHS_PT[monthIndex]} / ${year}`;
  };

  // Aplicar filtros de pesquisa, motivo, mês selecionado e data de calendário
  const filteredCortes = useMemo(() => {
    return processedData.filter(item => {
      const matchSearch = 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchReason = selectedReason === 'ALL' || item.reason === selectedReason;
      
      let matchMonth = true;
      if (selectedMonths.length > 0) {
        if (item.dateObject) {
          const year = item.dateObject.getFullYear();
          const month = String(item.dateObject.getMonth() + 1).padStart(2, '0');
          const ym = `${year}-${month}`;
          matchMonth = selectedMonths.includes(ym);
        } else {
          matchMonth = false;
        }
      }

      let matchDate = true;
      if (userSelectedSkuDate) {
        if (item.dateObject) {
          const year = item.dateObject.getFullYear();
          const month = String(item.dateObject.getMonth() + 1).padStart(2, '0');
          const day = String(item.dateObject.getDate()).padStart(2, '0');
          const formattedItemDate = `${year}-${month}-${day}`;
          matchDate = formattedItemDate === userSelectedSkuDate;
        } else {
          matchDate = false;
        }
      }

      return matchSearch && matchReason && matchMonth && matchDate;
    });
  }, [processedData, searchTerm, selectedReason, selectedMonths, userSelectedSkuDate]);

  // 2. Agrupamentos (Métricas de Cabeçalho)
  const kpis = useMemo(() => {
    let totalValue = 0;
    let totalQty = 0;
    const uniqueSkus = new Set<string>();
    const reasonsCount: Record<string, number> = {};

    filteredCortes.forEach(item => {
      totalValue += item.value;
      totalQty += item.quantity;
      uniqueSkus.add(item.sku);
      if (item.reason) {
        reasonsCount[item.reason] = (reasonsCount[item.reason] || 0) + item.value;
      }
    });

    let topReasonName = 'Nenhum';
    let topReasonVal = 0;
    Object.entries(reasonsCount).forEach(([name, val]) => {
      if (val > topReasonVal) {
        topReasonVal = val;
        topReasonName = name;
      }
    });

    return {
      totalValue,
      totalQty,
      skuCount: uniqueSkus.size,
      topReason: topReasonName,
      topReasonValue: topReasonVal
    };
  }, [filteredCortes]);

  // 3. Agrupamento e Soma por SKU (Ranqueados de maior a menor por valor do corte)
  const skuRanking = useMemo(() => {
    const aggregation: Record<string, { sku: string; description: string; totalQty: number; totalValue: number; count: number; lastReason: string }> = {};

    filteredCortes.forEach(item => {
      if (!aggregation[item.sku]) {
        aggregation[item.sku] = {
          sku: item.sku,
          description: item.description,
          totalQty: 0,
          totalValue: 0,
          count: 0,
          lastReason: item.reason
        };
      }
      aggregation[item.sku].totalQty += item.quantity;
      aggregation[item.sku].totalValue += item.value;
      aggregation[item.sku].count += 1;
      aggregation[item.sku].lastReason = item.reason;
    });

    return Object.values(aggregation).sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredCortes]);

  const skuRankTotalValue = useMemo(() => {
    return skuRanking.reduce((sum, item) => sum + item.totalValue, 0);
  }, [skuRanking]);

  // Detalhamento do SKU selecionado por dia, motivo e pedido
  const skuDetails = useMemo(() => {
    if (!selectedSku) return [];
    
    // Filtra todas as ocorrências de corte para o SKU selecionado
    const items = filteredCortes.filter(item => item.sku === selectedSku);
    
    // Agrupa por Dia (Data), Motivo (Reason) e Pedido (Pedido)
    const groups: Record<string, { date: string; dateObject: Date | null; reason: string; quantity: number; value: number; pedido: string }> = {};
    
    items.forEach(item => {
      const ped = item.pedido ? String(item.pedido).trim() : '';
      const key = `${item.date}_${item.reason}_${ped}`;
      if (!groups[key]) {
        groups[key] = {
          date: item.date,
          dateObject: item.dateObject || null,
          reason: item.reason,
          quantity: 0,
          value: 0,
          pedido: ped
        };
      }
      groups[key].quantity += item.quantity;
      groups[key].value += item.value;
    });
    
    // Ordena por data decrescente
    return Object.values(groups).sort((a, b) => {
      if (a.dateObject && b.dateObject) {
        return b.dateObject.getTime() - a.dateObject.getTime();
      }
      return b.date.localeCompare(a.date);
    });
  }, [selectedSku, filteredCortes]);

  // 4. Agrupamentos por Data (Dia, Semana, Mês)
  const timeGroupings = useMemo(() => {
    const dailyMap: Record<string, { dateStr: string; sortKey: string; totalValue: number; totalQty: number; occurrences: number }> = {};
    const weeklyMap: Record<string, { weekStr: string; sortKey: string; totalValue: number; totalQty: number; occurrences: number }> = {};
    const monthlyMap: Record<string, { monthStr: string; sortKey: string; totalValue: number; totalQty: number; occurrences: number }> = {};

    filteredCortes.forEach(item => {
      const dObj = item.dateObject;
      if (!dObj) return;

      // Dia
      const dayStr = item.date; // "DD/MM/YYYY" format
      
      const year = dObj.getFullYear();
      const month = String(dObj.getMonth() + 1).padStart(2, '0');
      const day = String(dObj.getDate()).padStart(2, '0');
      const daySortKey = `${year}-${month}-${day}`;

      if (!dailyMap[daySortKey]) {
        dailyMap[daySortKey] = { dateStr: dayStr, sortKey: daySortKey, totalValue: 0, totalQty: 0, occurrences: 0 };
      }
      dailyMap[daySortKey].totalValue += item.value;
      dailyMap[daySortKey].totalQty += item.quantity;
      dailyMap[daySortKey].occurrences += 1;

      // Semana
      const weekStr = getWeekRange(dObj);
      const startOfWeek = new Date(dObj);
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      
      const weekYear = startOfWeek.getFullYear();
      const weekMonth = String(startOfWeek.getMonth() + 1).padStart(2, '0');
      const weekDay = String(startOfWeek.getDate()).padStart(2, '0');
      const weekSortKey = `${weekYear}-${weekMonth}-${weekDay}`;

      if (!weeklyMap[weekSortKey]) {
        weeklyMap[weekSortKey] = { weekStr, sortKey: weekSortKey, totalValue: 0, totalQty: 0, occurrences: 0 };
      }
      weeklyMap[weekSortKey].totalValue += item.value;
      weeklyMap[weekSortKey].totalQty += item.quantity;
      weeklyMap[weekSortKey].occurrences += 1;

      // Mês
      const monthStr = formatMonth(dObj);
      const monthSortKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[monthSortKey]) {
        monthlyMap[monthSortKey] = { monthStr, sortKey: monthSortKey, totalValue: 0, totalQty: 0, occurrences: 0 };
      }
      monthlyMap[monthSortKey].totalValue += item.value;
      monthlyMap[monthSortKey].totalQty += item.quantity;
      monthlyMap[monthSortKey].occurrences += 1;
    });

    const sortedDaily = Object.values(dailyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const sortedWeekly = Object.values(weeklyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const sortedMonthly = Object.values(monthlyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return {
      daily: sortedDaily,
      weekly: sortedWeekly,
      monthly: sortedMonthly
    };
  }, [filteredCortes]);

  const monthComparisonData = useMemo(() => {
    if (selectedMonths.length <= 1) return [];

    return selectedMonths
      .map(monthKey => {
        const monthItems = filteredCortes.filter(item => {
          if (!item.dateObject) return false;
          const year = item.dateObject.getFullYear();
          const month = String(item.dateObject.getMonth() + 1).padStart(2, '0');
          return `${year}-${month}` === monthKey;
        });

        const totalValue = monthItems.reduce((sum, item) => sum + item.value, 0);
        const totalQty = monthItems.reduce((sum, item) => sum + item.quantity, 0);

        return {
          monthKey,
          name: getMonthLabel(monthKey),
          valor: parseFloat(totalValue.toFixed(2)),
          quantidade: totalQty
        };
      })
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredCortes, selectedMonths]);

  const isComparingMonths = selectedMonths.length > 1;

  // Gráfico do Período Ativo
  const activeChartData = useMemo(() => {
    if (isComparingMonths) {
      return monthComparisonData;
    }

    if (chartPeriod === 'day') {
      return timeGroupings.daily.map(d => ({
        name: d.dateStr,
        valor: parseFloat(d.totalValue.toFixed(2)),
        quantidade: d.totalQty
      }));
    } else if (chartPeriod === 'week') {
      return timeGroupings.weekly.map(w => ({
        name: w.weekStr,
        valor: parseFloat(w.totalValue.toFixed(2)),
        quantidade: w.totalQty
      }));
    } else {
      return timeGroupings.monthly.map(m => ({
        name: m.monthStr,
        valor: parseFloat(m.totalValue.toFixed(2)),
        quantidade: m.totalQty
      }));
    }
  }, [timeGroupings, chartPeriod, isComparingMonths, monthComparisonData]);

  // Top 5 motivos (por valor financeiro) para gráfico de donuts/linhas
  const reasonsChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCortes.forEach(item => {
      if (item.reason) {
        counts[item.reason] = (counts[item.reason] || 0) + item.value;
      }
    });

    const sorted = Object.entries(counts)
      .map(([name, val]) => ({ name, value: parseFloat(val.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    const top5 = sorted.slice(0, 5);
    const elementsSum = top5.reduce((sum, current) => sum + current.value, 0);
    const totalDiff = kpis.totalValue - elementsSum;

    if (totalDiff > 0 && sorted.length > 5) {
      top5.push({ name: 'Outros Motivos', value: parseFloat(totalDiff.toFixed(2)) });
    }
    return top5;
  }, [filteredCortes, kpis.totalValue]);

  // Cores de Gráficos Pie (Tons Profissionais e Sofisticados)
  const PIE_COLORS = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#a1a1aa'];

  // Paginação para tabela de registros de Cortes
  const totalPages = Math.ceil(filteredCortes.length / itemsPerPage);
  const paginatedCortes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCortes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCortes, currentPage]);

  // Paginação para tabela de SKU Rankings
  const totalSkuPages = Math.ceil(skuRanking.length / skusPerPage);
  const paginatedSkuRanking = useMemo(() => {
    const startIndex = (currentSkuPage - 1) * skusPerPage;
    return skuRanking.slice(startIndex, startIndex + skusPerPage);
  }, [skuRanking, currentSkuPage]);

  // Formatar Moeda Brasileira
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Se não houver dados em absolutamente nenhuma das fontes de cortes, exibe tela de boas vindas com instruções profissionais
  if (propsData.length === 0 && wmsData.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "w-full rounded-3xl border p-12 text-center shadow-lg backdrop-blur-md transition-colors duration-500 flex flex-col items-center justify-center min-h-[500px]",
          theme.contentBg, theme.contentBorder, theme.contentShadow
        )}
      >
        <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center mb-6 border bg-rose-500/10 border-rose-500/20")}>
          <FileSpreadsheet className="w-10 h-10 text-rose-500 animate-pulse" />
        </div>
        <h2 className={cn("text-2xl font-black mb-3 tracking-wider uppercase", theme.contentTitle)}>
          Mapeamento de Cortes Não Encontrado
        </h2>
        <p className={cn("max-w-xl mx-auto text-sm leading-relaxed mb-8 text-slate-500")}>
          Este módulo exibe análises financeiras e de motivos sobre cortes operacionais de mercadoria. 
          Para carregar dados aqui, faça o upload de uma planilha no seletor de dados contendo uma aba exatamente com o nome <span className="font-bold text-rose-600 underline">CORTES</span>.
        </p>

        <div className="bg-zinc-950/5 border border-zinc-800/10 p-6 rounded-2xl max-w-lg w-full text-left font-sans shadow-inner">
          <span className="text-xs font-black uppercase text-rose-500 tracking-widest block mb-4">Estrutura Esperada do Excel</span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-rose-500"></div><span className="font-semibold">Coluna B:</span> SKU do Produto</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-rose-500"></div><span className="font-semibold">Coluna C:</span> Descrição do Produto</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-rose-500"></div><span className="font-semibold">Coluna G:</span> Data do Corte</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-rose-500"></div><span className="font-semibold">Coluna H:</span> Quantidade Cortada</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-rose-500"></div><span className="font-semibold">Coluna I:</span> Valor (R$ perdido)</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-rose-500"></div><span className="font-semibold">Coluna K:</span> Motivo do Corte</div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full space-y-6 font-sans">
      
      {/* Seletor Superior de Tipo de Cortes (Comerciais vs WMS) */}
      <div className="flex justify-center mb-2">
        <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-md">
          <button
            onClick={() => {
              setSelectedSource('comercial');
              setSearchTerm('');
              setSelectedReason('ALL');
              setSelectedMonths([]);
              setCurrentPage(1);
              setCurrentSkuPage(1);
            }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 tracking-wide uppercase",
              selectedSource === 'comercial'
                ? "bg-rose-500 text-white shadow-lg"
                : "text-zinc-500 hover:text-rose-500 hover:bg-rose-500/5 dark:hover:bg-rose-500/10"
            )}
          >
            <Scissors className="w-4 h-4" />
            Cortes Comerciais
          </button>
          <button
            onClick={() => {
              setSelectedSource('wms');
              setSearchTerm('');
              setSelectedReason('ALL');
              setSelectedMonths([]);
              setCurrentPage(1);
              setCurrentSkuPage(1);
            }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 tracking-wide uppercase",
              selectedSource === 'wms'
                ? "bg-rose-600 text-white shadow-lg"
                : "text-zinc-500 hover:text-rose-600 hover:bg-rose-600/5 dark:hover:bg-rose-600/10"
            )}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Cortes Diários WMS
          </button>
        </div>
      </div>

      {/* Se a fonte de dados selecionada estiver vazia na planilha, orienta como carregar */}
      {data.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "w-full rounded-3xl border p-12 text-center shadow-lg backdrop-blur-md transition-colors duration-500 flex flex-col items-center justify-center min-h-[400px]",
            theme.contentBg, theme.contentBorder, theme.contentShadow
          )}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border bg-rose-500/15 border-rose-500/30">
            <FileSpreadsheet className="w-8 h-8 text-rose-500 animate-bounce" />
          </div>
          <h3 className={cn("text-xl font-bold mb-2 uppercase tracking-wide", theme.contentTitle)}>
            Aba {selectedSource === 'comercial' ? '"CORTES"' : '"CORTES WMS"'} Não Localizada
          </h3>
          <p className="max-w-md mx-auto text-xs text-slate-500 leading-relaxed mb-6">
            Nenhum dado encontrado para {selectedSource === 'comercial' ? 'Cortes Comerciais' : 'Cortes Diários WMS'} nesta planilha. 
            Por favor, certifique-se de que a sua planilha do Google Sheets contenha uma aba com o nome exato{' '}
            <span className="font-bold underline text-rose-600">{selectedSource === 'comercial' ? 'CORTES' : 'CORTES WMS'}</span>.
          </p>
          <div className="bg-zinc-50/50 border border-zinc-200/50 p-5 rounded-xl max-w-sm w-full text-left text-xs font-sans">
            <span className="font-bold text-rose-500 block mb-3 uppercase tracking-wide">Estrutura de Colunas {selectedSource === 'comercial' ? 'Comercial' : 'WMS'}:</span>
            {selectedSource === 'comercial' ? (
              <ul className="space-y-1.5 opacity-80">
                <li>• <strong className="font-bold">Coluna B:</strong> SKU</li>
                <li>• <strong className="font-bold">Coluna C:</strong> Descrição</li>
                <li>• <strong className="font-bold">Coluna G:</strong> Data</li>
                <li>• <strong className="font-bold">Coluna H:</strong> Quantidade</li>
                <li>• <strong className="font-bold">Coluna I:</strong> Valor</li>
                <li>• <strong className="font-bold">Coluna K:</strong> Motivo</li>
              </ul>
            ) : (
              <ul className="space-y-1.5 opacity-80">
                <li>• <strong className="font-bold">Coluna A:</strong> "Onde" (Ocorrência / Motivo)</li>
                <li>• <strong className="font-bold">Coluna G:</strong> SKU do Produto</li>
                <li>• <strong className="font-bold">Coluna I:</strong> Descrição do Produto</li>
                <li>• <strong className="font-bold">Coluna K:</strong> Quantidade Cortada</li>
                <li>• <strong className="font-bold">Coluna Z:</strong> Valor Perdido</li>
              </ul>
            )}
          </div>
        </motion.div>
      ) : (
        <>
          {/* Botões do Top Tab Menu */}
          <div className="flex justify-center mb-2">
        <div className={cn("backdrop-blur-md border rounded-2xl p-1 shadow-md flex items-center gap-1", theme.contentBg, theme.contentBorder)}>
          <button 
            onClick={() => {
              setActiveTab('geral');
            }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
              activeTab === 'geral' ? `${theme.active} shadow-md` : "opacity-50 hover:opacity-100 text-slate-500"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Visão Geral
          </button>
          <button 
            onClick={() => {
              setActiveTab('skus');
            }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
              activeTab === 'skus' ? `${theme.active} shadow-md` : "opacity-50 hover:opacity-100 text-slate-500"
            )}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Rank por SKU
          </button>
          <button 
            onClick={() => {
              setActiveTab('evolucao');
            }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
              activeTab === 'evolucao' ? `${theme.active} shadow-md` : "opacity-50 hover:opacity-100 text-slate-500"
            )}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Análise Temporal
          </button>
        </div>
      </div>

      {/* Caixa de Filtros no Topo de Todas as Abas */}
      <div className="p-5 border-2 border-rose-600/90 rounded-2xl transition-all shadow-md bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-center">
          {/* Caixa de Pesquisasku/desc*/}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-rose-500/60" />
            <input 
               type="text"
               placeholder="Pesquisar por SKU ou Descrição..."
               value={searchTerm}
               onChange={(e) => {
                 setSearchTerm(e.target.value);
                 setCurrentPage(1);
                 setCurrentSkuPage(1);
               }}
               className="w-full pl-10 pr-4 py-2.5 border-2 border-rose-200 rounded-xl text-xs bg-rose-50/10 focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          {/* Filtro fixo por Motivo: Avaria */}
          <div className="relative">
            <Filter className="absolute left-3.5 top-3.5 w-4 h-4 text-rose-500/60" />
            <select
               value={selectedReason}
               onChange={(e) => {
                 setSelectedReason(e.target.value);
                 setCurrentPage(1);
                 setCurrentSkuPage(1);
               }}
               className="w-full pl-10 pr-4 py-2.5 border-2 border-rose-200 rounded-xl text-xs bg-rose-50/10 appearance-none focus:outline-none focus:border-rose-500 transition-colors cursor-pointer"
            >
              <option value="ALL">Visualizar Todos os Motivos</option>
              {uniqueReasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Mês */}
          <div className="relative">
            <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-rose-500/60 z-10 pointer-events-none" />
            <button
              type="button"
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-rose-200 rounded-xl text-xs bg-rose-50/10 focus:outline-none focus:border-rose-500 transition-colors cursor-pointer text-left font-medium text-zinc-700 flex justify-between items-center bg-white"
            >
              <span className="truncate">
                {selectedMonths.length === 0
                  ? 'Visualizar Todos os Meses'
                  : selectedMonths.length === 1
                    ? getMonthLabel(selectedMonths[0])
                    : `${selectedMonths.length} Meses Selecionados`}
              </span>
              <ChevronDown className="w-4 h-4 text-rose-500 shrink-0 ml-1" />
            </button>

            {isMonthDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsMonthDropdownOpen(false)} 
                />
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border-2 border-rose-200 rounded-xl shadow-xl z-30 p-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonths([]);
                      setCurrentPage(1);
                      setCurrentSkuPage(1);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between hover:bg-rose-50 cursor-pointer",
                      selectedMonths.length === 0 ? "text-rose-600 bg-rose-50" : "text-slate-700"
                    )}
                  >
                    <span>Todos os meses</span>
                    {selectedMonths.length === 0 && <Check className="w-3.5 h-3.5 text-rose-600" />}
                  </button>
                  <div className="border-t border-rose-100 my-1" />
                  {uniqueMonths.map(m => {
                    const isSelected = selectedMonths.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          let updated: string[];
                          if (isSelected) {
                            updated = selectedMonths.filter(x => x !== m);
                          } else {
                            updated = [...selectedMonths, m];
                          }
                          setSelectedMonths(updated);
                          setCurrentPage(1);
                          setCurrentSkuPage(1);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between hover:bg-rose-50 transition-colors cursor-pointer",
                          isSelected ? "text-rose-600 bg-rose-50/50 font-bold" : "text-slate-700 hover:text-rose-600"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded border-rose-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer accent-rose-600"
                          />
                          <span>{getMonthLabel(m)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Filtro por Data (Calendário) */}
          <div className="relative">
            <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-rose-500/65 pointer-events-none z-10" />
            <div className="flex items-center gap-1.5 w-full pl-10 pr-3 py-2 border-2 border-rose-200 rounded-xl text-xs bg-white focus-within:border-rose-500 transition-colors h-[42px] max-h-[42px]">
              <span className="text-zinc-400 font-extrabold uppercase tracking-wider text-[9px] mr-1 shrink-0 select-none">Filtrar Dia:</span>
              <input
                type="date"
                value={userSelectedSkuDate}
                onChange={(e) => {
                  setUserSelectedSkuDate(e.target.value);
                  setCurrentPage(1);
                  setCurrentSkuPage(1);
                }}
                className="w-full bg-transparent font-bold text-zinc-700 dark:text-zinc-200 focus:outline-none border-none outline-none cursor-pointer text-xs"
                style={{ colorScheme: 'light' }}
              />
              {userSelectedSkuDate && (
                <button
                  type="button"
                  onClick={() => {
                    setUserSelectedSkuDate('');
                    setCurrentPage(1);
                    setCurrentSkuPage(1);
                  }}
                  className="px-2 py-0.5 text-[9px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors uppercase cursor-pointer shrink-0"
                  title="Limpar Data"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Resumo Rápido e Limpar */}
          <div className="flex flex-row sm:flex-row lg:flex-col justify-between items-center lg:items-end gap-2 text-xs px-2 w-full">
            <div className="text-slate-500 font-medium text-left lg:text-right leading-tight">
              Resultados: <span className="font-bold text-zinc-800">{filteredCortes.length}</span> de <span className="font-bold text-zinc-800">{data.length}</span> registros
            </div>
            {(searchTerm || selectedReason !== 'ALL' || selectedMonths.length > 0 || userSelectedSkuDate) && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedReason('ALL');
                  setSelectedMonths([]);
                  setUserSelectedSkuDate('');
                }}
                className={cn("px-4 py-1.5 border text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer border-rose-350 text-rose-550 hover:bg-rose-50", theme.primary === 'amber' ? "border-amber-300 text-amber-700 hover:bg-amber-50" : "border-rose-300 text-rose-500 hover:bg-rose-50")}
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RENDER VIEW CONFORME ABA ATIVA */}

      {/* TAB 1: VISÃO GERAL */}
      {activeTab === 'geral' && (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Sessão KPI de Destaques */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={cn("p-6 rounded-2xl flex items-center gap-4 shadow-sm", theme.contentBg, theme.contentBorder)}>
              <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-amber-200">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider leading-none mb-1">Impacto Financeiro total</span>
                <span className="text-xl font-bold text-slate-900 block tracking-tight leading-none mb-0.5">{formatCurrency(kpis.totalValue)}</span>
                <span className="text-[9px] text-zinc-500">Soma da coluna de valores</span>
              </div>
            </div>

            <div className={cn("p-6 rounded-2xl flex items-center gap-4 shadow-sm", theme.contentBg, theme.contentBorder)}>
              <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-orange-200">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider leading-none mb-1">Volume total de cortes</span>
                <span className="text-xl font-bold text-slate-900 block tracking-tight leading-none mb-0.5">{kpis.totalQty.toLocaleString('pt-BR')} un</span>
                <span className="text-[9px] text-zinc-500">Soma da quantidade física cortada</span>
              </div>
            </div>

            <div className={cn("p-6 rounded-2xl flex items-center gap-4 shadow-sm", theme.contentBg, theme.contentBorder)}>
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-200">
                <Scissors className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider leading-none mb-1">SKUs impactados</span>
                <span className="text-xl font-bold text-slate-900 block tracking-tight leading-none mb-0.5">{kpis.skuCount} produtos</span>
                <span className="text-[9px] text-zinc-500">De um total de {skuRanking.length} cadastrados</span>
              </div>
            </div>

            <div className={cn("p-6 rounded-2xl flex items-center gap-4 shadow-sm", theme.contentBg, theme.contentBorder)}>
              <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider leading-none mb-1">Maior Motivo de Corte</span>
                <span className="text-[13px] font-bold text-slate-900 block truncate leading-tight select-none mb-0.5" title={kpis.topReason}>
                  {kpis.topReason}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono font-bold block">{formatCurrency(kpis.topReasonValue)} em cortes</span>
              </div>
            </div>
          </div>

          {/* Gráfico Temporal Rápido de Destaque e Distribuição */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={cn("p-6 rounded-2xl shadow-sm lg:col-span-2", theme.contentBg, theme.contentBorder)}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider block">
                    {isComparingMonths ? 'Comparativo do Impacto por Mês' : 'Evolução do Impacto por Data'}
                  </h3>
                  <span className="text-[10px] text-slate-400 block">
                    {isComparingMonths
                      ? 'Comparação do impacto financeiro entre os meses selecionados'
                      : 'Valor monetário totalizado conforme agrupamento temporal'}
                  </span>
                </div>
                <div className="flex gap-1 border border-zinc-200 bg-zinc-50 p-1 rounded-xl">
                    {(['day', 'week', 'month'] as const).map(p => (
                      <button 
                        key={p}
                        onClick={() => setChartPeriod(p)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                          chartPeriod === p ? cn("bg-white shadow-sm font-bold border", theme.accent, theme.border) : "opacity-40 hover:opacity-100 text-zinc-600"
                        )}
                      >
                        {p === 'day' ? 'Dia' : p === 'week' ? 'Semana' : 'Mês'}
                      </button>
                    ))}
                  </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {isComparingMonths ? (
                    <LineChart data={activeChartData} margin={{ top: 35, right: 30, left: 30, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="name" fontSize={10} stroke="#a1a1aa" tickLine={false} />
                      <YAxis fontSize={10} stroke="#a1a1aa" tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip 
                        formatter={(value: any) => [formatCurrency(Number(value)), "Valor Cortado"]}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 11 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="valor"
                        stroke={theme.logo || '#2563eb'}
                        strokeWidth={3}
                        dot={{ r: 4, fill: theme.logo || '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: theme.logo || '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                      />
                      <LabelList 
                        dataKey="valor" 
                        position="top" 
                        formatter={(val: any) => "R$ " + Math.round(Number(val)).toLocaleString('pt-BR')} 
                        fontSize={11} 
                        fill="#1e293b" 
                        fontWeight="extrabold" 
                        offset={10} 
                      />
                    </LineChart>
                  ) : activeChartData.length === 1 ? (
                    <BarChart data={activeChartData} margin={{ top: 35, right: 30, left: 30, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="name" fontSize={10} stroke="#a1a1aa" tickLine={false} />
                      <YAxis fontSize={10} stroke="#a1a1aa" tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip 
                        formatter={(value: any) => [formatCurrency(Number(value)), "Valor Cortado"]}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 11 }}
                      />
                      <Bar dataKey="valor" fill={theme.logo || "#f43f5e"} radius={[6, 6, 0, 0]} maxBarSize={60}>
                        <LabelList 
                          dataKey="valor" 
                          position="top" 
                          formatter={(val: any) => "R$ " + Math.round(Number(val)).toLocaleString('pt-BR')} 
                          fontSize={11} 
                          fill="#1e293b" 
                          fontWeight="extrabold" 
                          offset={10} 
                        />
                      </Bar>
                    </BarChart>
                  ) : (
                    <AreaChart data={activeChartData} margin={{ top: 35, right: 30, left: 30, bottom: 10 }}>
                      <defs>
                        <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={theme.logo || "#f43f5e"} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={theme.logo || "#f43f5e"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="name" fontSize={10} stroke="#a1a1aa" tickLine={false} />
                      <YAxis fontSize={10} stroke="#a1a1aa" tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip 
                        formatter={(value: any) => [formatCurrency(Number(value)), "Valor Cortado"]}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 11 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="valor" 
                        stroke={theme.logo || "#f43f5e"} 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill="url(#colorValor)"
                        dot={{ r: 4, stroke: '#fff', strokeWidth: 1.5, fill: theme.logo || "#f43f5e" }}
                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: theme.logo || "#f43f5e" }}
                      >
                        <LabelList 
                          dataKey="valor" 
                          position="top" 
                          formatter={(val: any) => val > 0 ? "R$ " + Math.round(Number(val)).toLocaleString('pt-BR') : ""} 
                          fontSize={11} 
                          fill="#1e293b" 
                          fontWeight="extrabold" 
                          offset={10} 
                        />
                      </Area>
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            <div className={cn("p-6 rounded-2xl shadow-sm flex flex-col justify-between", theme.contentBg, theme.contentBorder)}>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider block mb-1">
                  {selectedSource === 'wms' ? 'Participação por Onda' : 'Participação por Motivo'}
                </h3>
                <span className="text-[10px] text-slate-400 block mb-4">
                  {selectedSource === 'wms' ? 'Divisão monetária das ondas de cortes' : 'Divisão monetária dos motivos de cortes'}
                </span>
              </div>
              <div className="h-44 relative flex items-center justify-center">
                {reasonsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reasonsChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={50}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ cx, cy, midAngle, outerRadius: oRadius, value, percent }) => {
                          if (!value || percent < 0.04) return null;
                          const RADIAN = Math.PI / 180;
                          const radius = oRadius + 14;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text 
                              x={x} 
                              y={y} 
                              fill="#1e293b" 
                              textAnchor={x > cx ? 'start' : 'end'} 
                              dominantBaseline="central"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              R$ {Math.round(value).toLocaleString('pt-BR')}
                            </text>
                          );
                        }}
                        labelLine={true}
                      >
                        {reasonsChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), "Valor"]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-slate-400 italic">
                    {selectedSource === 'wms' ? 'Nenhuma onda catalogada' : 'Nenhum motivo catalogado'}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 mt-2">
                {reasonsChartData.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                      <span className="font-semibold text-zinc-700 truncate select-none uppercase">{item.name}</span>
                    </div>
                    <span className="font-mono text-zinc-500 font-bold shrink-0">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Destaque rápido: Top 5 SKUs mais afetados */}
          <div className={cn("p-6 rounded-2xl shadow-sm", theme.contentBg, theme.contentBorder)}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider block">Principais SKUs Ranqueados por Cortes</h3>
                <span className="text-[10px] text-slate-400 block text-left">Ranking dos 5 produtos que geraram o maior impacto financeiro acumulado por cortes</span>
              </div>
              <button 
                onClick={() => setActiveTab('skus')}
                className={cn("text-[10px] font-black uppercase font-bold flex items-center gap-1 cursor-pointer", theme.accent)}
              >
                Ver Rank Completo <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {skuRanking.slice(0, 5).map((item, index) => {
                const percentage = ((item.totalValue / skuRankTotalValue) * 100) || 0;
                return (
                  <div key={item.sku} className="group relative flex flex-col text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className={cn(
                          "w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] border",
                          theme.primary === 'amber' ? "bg-amber-50 border-amber-250 text-amber-700" : "bg-rose-50 border-rose-200 text-rose-500"
                        )}>
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-950 font-mono uppercase bg-zinc-100 px-1 py-0.5 rounded text-[10px]">{item.sku}</span>
                          <span className={cn(
                            "font-semibold text-slate-600 block truncate transition-colors uppercase select-none mt-0.5 whitespace-nowrap",
                            theme.primary === 'amber' ? "group-hover:text-amber-600" : "group-hover:text-rose-600"
                          )} title={item.description}>{item.description}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 font-mono block">{formatCurrency(item.totalValue)}</span>
                        <span className="text-[10px] text-zinc-500 font-mono block leading-none mt-0.5">{item.totalQty.toLocaleString('pt-BR')} un • {percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden mt-1 line-clamp-1">
                      <div className={cn("h-full rounded-full transition-all duration-500", theme.primary === 'amber' ? "bg-amber-600" : "bg-rose-500")} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 2: RANK POR SKU COMPLETO */}
      {activeTab === 'skus' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn("p-6 rounded-2xl shadow-sm", theme.contentBg, theme.contentBorder)}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 pb-4 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider block">Rank Financeiro Completo por SKU</h3>
              <span className="text-[10px] text-slate-400 block text-left">Lista ordenada decrescentemente por impacto financeiro gerado pelo corte de cada produto</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-4 px-4 w-12 text-center">Rank</th>
                  <th className="py-4 px-4 w-28">SKU</th>
                  <th className="py-4 px-4">Descrição do Produto</th>
                  <th className="py-4 px-4 w-28 text-center">Quantidade</th>
                  <th className="py-4 px-4 w-28 text-center">Registros</th>
                  <th className="py-4 px-4 w-36 text-right">Prejuízo (R$)</th>
                  <th className="py-4 px-4 w-40 text-center">Distribuição %</th>
                  <th className="py-4 px-4 w-32 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSkuRanking.length > 0 ? (
                  paginatedSkuRanking.map((item, idx) => {
                    const actualRank = (currentSkuPage - 1) * skusPerPage + idx + 1;
                    const percentage = ((item.totalValue / skuRankTotalValue) * 100) || 0;
                    
                    return (
                      <tr 
                        key={item.sku}
                        onClick={() => setSelectedSku(item.sku)}
                        className={cn(
                          "border-b border-zinc-100 transition-colors cursor-pointer",
                          theme.primary === 'amber' ? "hover:bg-amber-500/5" : "hover:bg-rose-500/5"
                        )}
                        title="Clique para ver o detalhamento dos cortes deste produto"
                      >
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            "w-6 h-6 rounded-lg font-bold text-[10px] inline-flex items-center justify-center border",
                            actualRank === 1 ? (theme.primary === 'amber' ? "bg-amber-700 border-amber-800 text-white" : "bg-red-500 border-red-600 text-white") :
                            actualRank === 2 ? (theme.primary === 'amber' ? "bg-amber-500 border-amber-600 text-white" : "bg-rose-400 border-rose-500 text-white") :
                            actualRank === 3 ? "bg-amber-400 border-amber-500 text-white" :
                            "bg-slate-50 border-slate-200 text-slate-600"
                          )}>
                            {actualRank}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 uppercase">
                          {item.sku}
                        </td>
                        <td className="py-3 px-4 uppercase font-semibold text-slate-700 truncate max-w-sm" title={item.description}>{item.description}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-zinc-800">{item.totalQty.toLocaleString('pt-BR')} un</td>
                        <td className="py-3 px-4 text-center font-mono text-zinc-500">{item.count} cortes</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-950 text-xs">{formatCurrency(item.totalValue)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden shrink min-w-[50px]">
                              <div className={cn("h-full rounded-full", theme.primary === 'amber' ? "bg-amber-600" : "bg-rose-500")} style={{ width: `${percentage}%` }}></div>
                            </div>
                            <span className="font-mono text-zinc-500 w-10 text-right shrink-0">{percentage.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedSku(item.sku)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm border cursor-pointer",
                              theme.primary === 'amber' 
                                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/80" 
                                : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100/80"
                            )}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">Nenhum SKU encontrado com os filtros atuais.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sku Paginação */}
          {totalSkuPages > 1 && (
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-zinc-100">
              <span className="text-xs text-zinc-500 select-none">Mostrando página {currentSkuPage} de {totalSkuPages} (Total de {skuRanking.length} produtos cortados)</span>
              <div className="flex gap-2">
                <button 
                  disabled={currentSkuPage === 1}
                  onClick={() => setCurrentSkuPage(prev => Math.max(1, prev - 1))}
                  className="p-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  disabled={currentSkuPage === totalSkuPages}
                  onClick={() => setCurrentSkuPage(prev => Math.min(totalSkuPages, prev + 1))}
                  className="p-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* TAB 3: ANÁLISE TEMPORAL (DETALHE POR DIA, SEMANA E MÊS) */}
      {activeTab === 'evolucao' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8"
        >
          {/* Sessão de Cartões por Período */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Dia */}
            <div className={cn("p-6 rounded-2xl shadow-sm", theme.contentBg, theme.contentBorder)}>
              <div className="flex items-center gap-3.5 mb-4">
                <div className={cn("p-3 rounded-xl", theme.primary === 'amber' ? "bg-amber-500/10" : "bg-rose-500/10")}>
                  <Calendar className={cn("w-5 h-5", theme.primary === 'amber' ? "text-amber-600" : "text-rose-500")} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 block leading-none mb-1">Cortes por Dia</h4>
                  <span className="text-xs text-zinc-400 tracking-tight leading-none">Visão por data específica</span>
                </div>
              </div>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {timeGroupings.daily.map(d => (
                  <div key={d.dateStr} className="flex justify-between items-center text-xs pb-2 border-b border-zinc-50">
                    <div>
                      <span className="font-bold text-slate-800">{d.dateStr}</span>
                      <span className="text-[9px] text-zinc-400 block">{d.occurrences} cortes • {d.totalQty.toLocaleString('pt-BR')} un</span>
                    </div>
                    <span className={cn("font-mono font-bold block", theme.primary === 'amber' ? "text-amber-700" : "text-rose-600")}>{formatCurrency(d.totalValue)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Semana */}
            <div className={cn("p-6 rounded-2xl shadow-sm", theme.contentBg, theme.contentBorder)}>
              <div className="flex items-center gap-3.5 mb-4">
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 block leading-none mb-1">Cortes por Semana</h4>
                  <span className="text-xs text-zinc-400 tracking-tight leading-none">Agrupamento consolidado de segunda a domingo</span>
                </div>
              </div>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {timeGroupings.weekly.map(w => (
                  <div key={w.weekStr} className="flex justify-between items-center text-xs pb-2 border-b border-zinc-50">
                    <div>
                      <span className="font-bold text-slate-800 select-none uppercase">{w.weekStr}</span>
                      <span className="text-[9px] text-zinc-400 block">{w.occurrences} cortes • {w.totalQty.toLocaleString('pt-BR')} un</span>
                    </div>
                    <span className={cn("font-mono font-bold block", theme.primary === 'amber' ? "text-amber-700" : "text-rose-600")}>{formatCurrency(w.totalValue)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mês */}
            <div className={cn("p-6 rounded-2xl shadow-sm", theme.contentBg, theme.contentBorder)}>
              <div className="flex items-center gap-3.5 mb-4">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 block leading-none mb-1">Cortes por Mês</h4>
                  <span className="text-xs text-zinc-400 tracking-tight leading-none">Consolidado em datas de faturamento</span>
                </div>
              </div>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {timeGroupings.monthly.map(m => (
                  <div key={m.monthStr} className="flex justify-between items-center text-xs pb-2 border-b border-zinc-50">
                    <div>
                      <span className="font-bold text-slate-800 uppercase">{m.monthStr}</span>
                      <span className="text-[9px] text-zinc-400 block">{m.occurrences} cortes • {m.totalQty.toLocaleString('pt-BR')} un</span>
                    </div>
                    <span className={cn("font-mono font-bold block", theme.primary === 'amber' ? "text-amber-700" : "text-rose-600")}>{formatCurrency(m.totalValue)}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Gráfico de Barras com Análise Cruzada de Volume e Prejuízo */}
          <div className={cn("p-6 rounded-2xl shadow-sm", theme.contentBg, theme.contentBorder)}>
            <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider block">Estudo Consolidado por {chartPeriod === 'day' ? 'Dia' : chartPeriod === 'week' ? 'Semana' : 'Mês'}</h3>
                <span className="text-[10px] text-slate-400 block text-left">Representação volumétrica em barras e financeira por período</span>
              </div>
              <div className="flex gap-1 border border-zinc-200 bg-zinc-50 p-1 rounded-xl shrink-0 self-start">
                {(['day', 'week', 'month'] as const).map(p => (
                  <button 
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                      chartPeriod === p ? cn("bg-white shadow-sm font-bold border", theme.accent, theme.border) : "opacity-40 hover:opacity-100 text-zinc-600"
                    )}
                  >
                    {p === 'day' ? 'Dia' : p === 'week' ? 'Semana' : 'Mês'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeChartData} margin={{ top: 35, right: 30, left: 30, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="name" fontSize={10} stroke="#a1a1aa" tickLine={false} />
                  <YAxis fontSize={10} stroke="#a1a1aa" tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip 
                    formatter={(value: any, name: string) => {
                      if (name === "valor") return [formatCurrency(Number(value)), "Impacto Financeiro (R$)"];
                      return [value.toLocaleString('pt-BR') + ' unidades', "Volume (un)"];
                    }}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 11 }}
                  />
                  <Bar dataKey="valor" fill={theme.logo || "#f43f5e"} radius={[4, 4, 0, 0]} maxBarSize={45}>
                    <LabelList 
                      dataKey="valor" 
                      position="top" 
                      formatter={(val: any) => val > 0 ? "R$ " + Math.round(Number(val)).toLocaleString('pt-BR') : ""} 
                      fontSize={11} 
                      fill="#1e293b" 
                      fontWeight="extrabold" 
                      offset={10} 
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}
        </>
      )}

      {/* Modal de Detalhamento por SKU */}
      {selectedSku && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-3xl rounded-3xl border border-zinc-200 p-6 shadow-2xl relative flex flex-col max-h-[90vh] bg-white text-slate-900"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-4 pb-4 border-b border-zinc-200">
              <div className="min-w-0 pr-6">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-black uppercase px-2.5 py-1 rounded-md border tracking-wider font-mono",
                    theme.primary === 'amber' 
                      ? "bg-amber-100 border-amber-300 text-amber-950" 
                      : "bg-rose-100 border-rose-300 text-rose-950"
                  )}>
                    SKU {selectedSku}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">Detalhamento de Cortes</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase mt-2 truncate" title={skuRanking.find(item => item.sku === selectedSku)?.description || 'Produto'}>
                  {skuRanking.find(item => item.sku === selectedSku)?.description || 'PRODUTO SEM DESCRIÇÃO'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSku(null)}
                className="p-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Micro KPIs de SKU */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] font-black uppercase text-slate-500 block tracking-wider mb-1">Prejuízo Total</span>
                <span className={cn(
                  "text-base font-black block leading-none font-mono",
                  theme.primary === 'amber' ? "text-amber-700" : "text-rose-600"
                )}>
                  {formatCurrency(skuRanking.find(item => item.sku === selectedSku)?.totalValue || 0)}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] font-black uppercase text-slate-500 block tracking-wider mb-1">Qtd. Total Cortada</span>
                <span className="text-base font-black text-slate-900 block leading-none font-mono">
                  {(skuRanking.find(item => item.sku === selectedSku)?.totalQty || 0).toLocaleString('pt-BR')} un
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm">
                <span className="text-[10px] font-black uppercase text-slate-500 block tracking-wider mb-1">Ocorrências</span>
                <span className="text-base font-black text-slate-900 block leading-none font-mono">
                  {skuRanking.find(item => item.sku === selectedSku)?.count || 0} cortes
                </span>
              </div>
            </div>

            {/* List/Table of details */}
            <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-2xl shadow-xs">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100 sticky top-0 backdrop-blur-xs z-10 border-b border-zinc-200">
                  <tr className="text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4 font-black">Dia (Data)</th>
                    <th className="py-3.5 px-4 font-black">Pedido</th>
                    <th className="py-3.5 px-4 font-black">Motivo / Ocorrência</th>
                    <th className="py-3.5 px-4 text-center font-black">Quantidade</th>
                    <th className="py-3.5 px-4 text-right font-black">Prejuízo (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {skuDetails.length > 0 ? (
                    skuDetails.map((detail, idx) => {
                      const isCorteIndevido = detail.reason.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("CORTE INDEVIDO");
                      return (
                        <tr 
                          key={idx} 
                          className={cn(
                            "transition-colors",
                            isCorteIndevido 
                              ? "bg-amber-50/70 hover:bg-amber-100/70" 
                              : "hover:bg-slate-50/80"
                          )}
                        >
                          <td className="py-3 px-4 font-bold text-slate-800 font-mono">
                            {detail.date}
                          </td>
                          <td className="py-3 px-4 font-black text-rose-600 font-mono text-[11px]">
                            {detail.pedido || <span className="text-zinc-300">-</span>}
                          </td>
                          <td className="py-3 px-4 font-bold uppercase text-[10px] text-slate-700 max-w-xs truncate" title={detail.reason}>
                            <div className="flex items-center gap-2">
                              <span>{detail.reason}</span>
                              {isCorteIndevido && (
                                <span className="inline-flex items-center gap-1 bg-amber-200 text-amber-950 font-black px-1.5 py-0.5 rounded text-[8px] border border-amber-300 shadow-sm shrink-0 uppercase tracking-wide">
                                  Corte Indevido
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black text-slate-900">
                            {detail.quantity.toLocaleString('pt-BR')} un
                          </td>
                          <td className={cn(
                            "py-3 px-4 text-right font-mono font-black",
                            isCorteIndevido ? "text-amber-800" : "text-slate-900"
                          )}>
                            {formatCurrency(detail.value)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 italic">Nenhum registro detalhado encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Footer Actions */}
            <div className="flex justify-end mt-4 pt-4 border-t border-zinc-200">
              <button
                onClick={() => setSelectedSku(null)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md text-white",
                  theme.primary === 'amber' 
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200/50" 
                    : "bg-rose-500 hover:bg-rose-700 shadow-rose-200/50"
                )}
              >
                Fechar Detalhes
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
