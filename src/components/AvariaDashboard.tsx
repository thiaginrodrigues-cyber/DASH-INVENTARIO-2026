import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, 
  DollarSign, 
  Package, 
  Search, 
  ArrowUpDown, 
  Percent, 
  AlertTriangle,
  TrendingUp,
  Info,
  ChevronLeft,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LabelList
} from 'recharts';
import { cn } from '../lib/utils';

// Definition of AvariaItem
export interface AvariaItem {
  date: string; // formatted DD/MM/YYYY
  dateObj?: string | null;
  sku: string;
  description: string;
  quantity: number;
  conversionFactor: string; // Fator de conversão (UN, FD, etc.)
  unitPrice: number;
  totalPrice: number;
}

interface AvariaDashboardProps {
  data: AvariaItem[] | undefined;
  theme: any;
}

export default function AvariaDashboard({ data: propsData = [], theme }: AvariaDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Clean dates and parse properly to ensure consistent behavior
  const processedData = useMemo(() => {
    return propsData.map(item => {
      let parsedDate: Date | null = null;
      const dateRaw = String(item.dateObj || item.date || "").trim();
      
      if (dateRaw) {
        if (dateRaw.includes('-')) {
          // ISO format or YYYY-MM-DD
          parsedDate = new Date(dateRaw);
        } else if (dateRaw.includes('/')) {
          const parts = dateRaw.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            parsedDate = new Date(year, month, day);
          }
        }
      }
      
      return {
        ...item,
        parsedDateObj: parsedDate
      };
    });
  }, [propsData]);

  // Extract all unique dates from sheets data
  const uniqueDates = useMemo(() => {
    const datesSet = new Set<string>();
    processedData.forEach(item => {
      if (item.date) {
        datesSet.add(item.date);
      }
    });
    // Sort dates chronological (newest first or oldest first)
    return Array.from(datesSet).sort((a, b) => {
      const partsA = a.split('/');
      const partsB = b.split('/');
      const timeA = partsA.length === 3 ? new Date(parseInt(partsA[2]), parseInt(partsA[1]) - 1, parseInt(partsA[0])).getTime() : 0;
      const timeB = partsB.length === 3 ? new Date(parseInt(partsB[2]), parseInt(partsB[1]) - 1, parseInt(partsB[0])).getTime() : 0;
      return timeB - timeA; // Newest first
    });
  }, [processedData]);

  // Set initial selected date as the first unique date, or empty string if none
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return uniqueDates[0] || '';
  });

  // Handler for direct date selection via HTML date picker
  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // YYYY-MM-DD format
    if (!val) return;
    
    const parts = val.split('-');
    if (parts.length === 3) {
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`; // Convert to DD/MM/YYYY
      // Check if we have data for this date. If not, we still set it so the user can see empty state
      setSelectedDate(formatted);
    }
  };

  // Convert currently selectedDate (DD/MM/YYYY) to HTML date input format (YYYY-MM-DD)
  const calendarInputVal = useMemo(() => {
    if (!selectedDate) return '';
    const parts = selectedDate.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return '';
  }, [selectedDate]);

  // Filter data by selected date & search term
  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      const matchesDate = item.date === selectedDate;
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        item.sku.toLowerCase().includes(searchLower) || 
        item.description.toLowerCase().includes(searchLower);
        
      return matchesDate && matchesSearch;
    });
  }, [processedData, selectedDate, searchTerm]);

  // Aggregated metrics for the selected date
  const selectedDayTotals = useMemo(() => {
    let totalValue = 0;
    let totalQty = 0;
    let totalItems = 0;
    
    processedData.forEach(item => {
      if (item.date === selectedDate) {
        totalValue += item.totalPrice;
        totalQty += item.quantity;
        totalItems++;
      }
    });

    return {
      totalValue,
      totalQty,
      totalItems,
      avgPrice: totalQty > 0 ? totalValue / totalQty : 0
    };
  }, [processedData, selectedDate]);

  // Aggregated overall statistics for contextual comparison (total of all avarias in history)
  const overallTotals = useMemo(() => {
    let overallValue = 0;
    let overallQty = 0;
    processedData.forEach(item => {
      overallValue += item.totalPrice;
      overallQty += item.quantity;
    });
    return { 
      overallValue, 
      overallQty, 
      overallRows: processedData.length 
    };
  }, [processedData]);

  // Ranking list: sorted from highest price to lowest
  const rankedItems = useMemo(() => {
    return [...filteredData].sort((a, b) => b.totalPrice - a.totalPrice);
  }, [filteredData]);

  // Recharts data: top 10 items for the selected day
  const chartData = useMemo(() => {
    return rankedItems.slice(0, 10).map(item => {
      const percentage = selectedDayTotals.totalValue > 0 
        ? (item.totalPrice / selectedDayTotals.totalValue) * 100 
        : 0;
      return {
        name: item.description.length > 22 ? `${item.description.slice(0, 20)}...` : item.description,
        fullName: item.description,
        sku: item.sku,
        totalPrice: item.totalPrice,
        quantity: item.quantity,
        percentage
      };
    });
  }, [rankedItems, selectedDayTotals.totalValue]);

  // Table pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.ceil(rankedItems.length / itemsPerPage);
  
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return rankedItems.slice(start, start + itemsPerPage);
  }, [rankedItems, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Recharts colors
  const barColors = ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'];

  return (
    <div id="avaria-dashboard-container" className="space-y-6">
      
      {/* Title & Filter Bar */}
      <div id="avaria-header-bar" className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-6 bg-white/95 rounded-2xl border border-amber-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Painel de Avarias</h1>
              <p className="text-xs text-slate-500">Controle e rastreabilidade de produtos avariados na operação</p>
            </div>
          </div>
        </div>

        {/* Dynamic Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Calendar Picker */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Selecione uma Data</span>
            <div className="relative flex items-center">
              <input 
                type="date" 
                value={calendarInputVal} 
                onChange={handleCalendarChange}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:border-amber-400 focus:border-amber-500 focus:outline-none shadow-sm transition-all h-[38px] w-[160px]"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            </div>
          </div>

          {/* Quick Date Selector (Select Dropdown) */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Datas Disponíveis</span>
            <select 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:border-amber-400 focus:border-amber-500 focus:outline-none shadow-sm transition-all h-[38px] min-w-[140px]"
            >
              {uniqueDates.length === 0 ? (
                <option value="">Nenhuma data</option>
              ) : (
                uniqueDates.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))
              )}
            </select>
          </div>

          {/* Search SKU/Product */}
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Buscar SKU ou Produto</span>
            <div className="relative flex items-center">
              <input 
                type="text" 
                placeholder="Ex: 2002612 ou Sal Cisne..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 bg-white hover:border-amber-400 focus:border-amber-500 focus:outline-none shadow-sm transition-all h-[38px] w-full sm:w-[220px]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div id="avaria-kpis-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* KPI 1: Valor Avariado do Dia */}
        <div className="bg-white/90 p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-100 flex items-center justify-center text-amber-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preço Total do Dia</h4>
            <p className="text-2xl font-black font-mono tracking-tight text-slate-800">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedDayTotals.totalValue)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              Data selecionada: <strong className="text-amber-600">{selectedDate || 'N/A'}</strong>
            </p>
          </div>
        </div>

        {/* KPI 2: Quantidade de Unidades */}
        <div className="bg-white/90 p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-100 flex items-center justify-center text-orange-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Unitário do Dia</h4>
            <p className="text-2xl font-black font-mono tracking-tight text-slate-800">
              {new Intl.NumberFormat('pt-BR').format(selectedDayTotals.totalQty)} <span className="text-xs font-normal text-slate-400 font-sans">unidades</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Média de <strong className="text-slate-700">{(selectedDayTotals.totalItems > 0 ? selectedDayTotals.totalQty / selectedDayTotals.totalItems : 0).toFixed(1)}</strong> por registro
            </p>
          </div>
        </div>

        {/* KPI 3: Registros Únicos de Avaria */}
        <div className="bg-white/90 p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-100 flex items-center justify-center text-yellow-600">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itens Avariados (Hoje)</h4>
            <p className="text-2xl font-black font-mono tracking-tight text-slate-800">
              {selectedDayTotals.totalItems} <span className="text-xs font-normal text-slate-400 font-sans">linhas</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Representa <strong className="text-amber-600">{overallTotals.overallValue > 0 ? ((selectedDayTotals.totalValue / overallTotals.overallValue) * 100).toFixed(1) : 0}%</strong> do histórico total
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Dashboard Layout */}
      <div id="avaria-main-content" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Visual Chart - Left Side (7 Cols) */}
        <div className="lg:col-span-7 bg-white/95 p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[460px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800">Distribuição Financeira por Item</h3>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Top 10 Itens</span>
            </div>
            <p className="text-xs text-slate-400 mb-6">Gráfico ilustrativo de perdas financeiras (Preço Total) por SKU selecionado no dia</p>
          </div>

          <div className="h-[320px] w-full">
            {chartData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl p-6">
                <AlertTriangle className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Sem dados de gráfico para o dia {selectedDate}</p>
                <p className="text-[11px] text-slate-400 mt-1">Selecione outra data ou limpe os filtros de busca</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 25, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 10)}..` : value}
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', padding: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}
                    itemStyle={{ color: '#fbbf24', fontSize: '11px' }}
                    formatter={(value: any, name: any, props: any) => {
                      const item = props.payload;
                      return [
                        <div key={item.sku} className="space-y-1">
                          <p className="text-amber-400 font-bold font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))}</p>
                          <p className="text-slate-300 text-[10px]">Qtde: <span className="font-bold">{item.quantity}</span></p>
                          <p className="text-slate-300 text-[10px]">Porcentagem: <span className="font-bold text-amber-300">{item.percentage?.toFixed(1)}%</span></p>
                          <p className="text-slate-400 text-[9px] max-w-[200px] whitespace-normal leading-tight">{item.fullName}</p>
                        </div>,
                        'Preço Total'
                      ];
                    }}
                  />
                  <Bar dataKey="totalPrice" radius={[6, 6, 0, 0]} maxBarSize={38}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                    ))}
                    <LabelList 
                      dataKey="totalPrice" 
                      position="top" 
                      formatter={(val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(val))}
                      style={{ fill: '#475569', fontSize: '10px', fontWeight: 'bold' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Comparative Analysis Bento - Right Side (5 Cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-amber-600 to-amber-800 p-6 rounded-3xl border border-amber-900 shadow-md text-white flex flex-col justify-between min-h-[460px]">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-amber-200" />
              <h3 className="font-bold text-white tracking-wide">Contexto da Operação</h3>
            </div>
            
            <p className="text-xs text-amber-50 leading-relaxed mb-6">
              O controle de avarias reflete produtos descartados, danificados ou vencidos identificados no CD. 
              As análises permitem identificar falhas logísticas, problemas de manuseio ou SKUs recorrentes com alto índice de perdas.
            </p>

            <div className="space-y-4">
              <div className="bg-black/15 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider block mb-1">Impacto Acumulado Geral</span>
                <p className="text-xl font-black font-mono">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(overallTotals.overallValue)}
                </p>
                <span className="text-[10px] text-amber-300/80">Soma de todas as ocorrências de avarias históricas</span>
              </div>

              <div className="bg-black/15 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider block mb-1">Total de Itens Avariados</span>
                <p className="text-xl font-black font-mono">
                  {new Intl.NumberFormat('pt-BR').format(overallTotals.overallQty)} unidades
                </p>
                <span className="text-[10px] text-amber-300/80">Quantidade física total no histórico de {overallTotals.overallRows} registros</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-amber-200">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
              <span>Sincronizado com o Planilhas</span>
            </div>
            <span className="text-[10px] font-bold font-mono bg-amber-900/40 px-3 py-1 rounded-lg text-amber-200">
              Aba: AVARIA
            </span>
          </div>
        </div>
      </div>

      {/* Item Ranking & Details Table Section */}
      <div id="avaria-ranking-table-section" className="bg-white/95 rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Ranking de Perdas Financeiras por Item</span>
              <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                Maior para Menor
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">Lista ordenada contendo SKU, descrição, quantidade, e indicador de percentual referente ao valor total do dia selecionado</p>
          </div>
          
          <div className="text-xs text-slate-500 font-semibold bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
            Registros Encontrados: <span className="font-bold text-amber-600">{rankedItems.length}</span>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-5 text-center w-16">Pos</th>
                <th className="py-4 px-4 w-32">SKU</th>
                <th className="py-4 px-4">Descrição do Produto</th>
                <th className="py-4 px-4 text-center">Quantidade</th>
                <th className="py-4 px-4 text-center">Emb / Fator</th>
                <th className="py-4 px-4 text-right">Preço Unitário</th>
                <th className="py-4 px-4 text-right">Preço Total</th>
                <th className="py-4 px-5 text-center w-48">Porcentagem do Dia</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum registro encontrado para a data {selectedDate} com os critérios definidos.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                  const itemPercentage = selectedDayTotals.totalValue > 0 
                    ? (item.totalPrice / selectedDayTotals.totalValue) * 100 
                    : 0;

                  return (
                    <tr 
                      key={`${item.sku}-${index}`} 
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group"
                    >
                      {/* Rank Position Badge */}
                      <td className="py-3 px-5 text-center">
                        <span className={cn(
                          "w-6 h-6 rounded-lg text-xs font-bold font-mono inline-flex items-center justify-center",
                          globalIndex === 1 ? "bg-amber-500 text-white" :
                          globalIndex === 2 ? "bg-amber-400 text-slate-800" :
                          globalIndex === 3 ? "bg-amber-200 text-slate-800" :
                          "bg-slate-100 text-slate-500"
                        )}>
                          {globalIndex}
                        </span>
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 font-medium">
                        {item.sku}
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-4 text-xs font-semibold text-slate-700 max-w-xs truncate group-hover:text-amber-700 transition-colors">
                        {item.description || 'Produto sem descrição'}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center font-mono text-xs text-slate-600 font-bold">
                        {item.quantity}
                      </td>

                      {/* Unit / factor */}
                      <td className="py-3 px-4 text-center text-xs text-slate-500">
                        <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600">
                          {item.conversionFactor || 'UN'}
                        </span>
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unitPrice)}
                      </td>

                      {/* Total Price */}
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-800 font-black">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalPrice)}
                      </td>

                      {/* Percentage Progress Indicator */}
                      <td className="py-3 px-5 text-center">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-amber-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, itemPercentage)}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-black font-mono text-slate-500 w-10 text-right">
                            {itemPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-slate-400">
              Mostrando página <span className="font-bold text-slate-600">{currentPage}</span> de <span className="font-bold text-slate-600">{totalPages}</span> ({rankedItems.length} registros no total)
            </p>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                // Only show a window of pages
                if (totalPages > 5 && Math.abs(currentPage - pageNum) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return <span key={pageNum} className="text-xs text-slate-400 px-1">...</span>;
                  }
                  return null;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                      currentPage === pageNum 
                        ? "bg-amber-500 text-white shadow-md"
                        : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
