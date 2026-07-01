import React, { useMemo } from "react";

interface CDPhysicalMapProps {
  data: any;
  theme: any;
  getOccupancyColorClasses: (pct: number) => any;
  cn: (...classes: any[]) => string;
}

export function CDPhysicalMap({ cn, data, theme, getOccupancyColorClasses }: CDPhysicalMapProps) {
  // Balanced super-compact dimensions to fit standard screens while being perfectly readable and massive visible area
  const lvlCellSize = 8.5;     // Extra compact level cells
  const modCellWidth = 12.0;   // Compact module index labels
  const corrWidth = 7.5;       // Sleek physical corridor
  const sidebarColWidth = 6.5; // Optimized thin layout sidebar for vertical labels
  const rowCellHeight = 8.5;   // Tighter row heights for high concentration
  const txtSize = 5.2;         // Very clean and readable micro-typography base font

  // Generate vertical module indices (reverse from 55 to 0. 123/124 at top, 13/14 at bottom)
  const rows = useMemo(() => {
    const list = [];
    for (let i = 55; i >= 0; i--) {
      list.push({
        idx: i,
        posOdd: 13 + 2 * i,
        posEven: 14 + 2 * i
      });
    }
    return list;
  }, []);

  // Helper to normalize any raw sector name into our 10 canonical categories
  const canonicalSector = (rawName: string): string => {
    const norm = String(rawName || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    if (!norm) return "";

    // 1. CONFINADOS - BEBIDAS (Check first to avoid split matching)
    if (norm.includes("confinado") && norm.includes("bebida")) {
      return "CONFINADOS - BEBIDAS";
    }
    // 2. BEBIDAS
    if (norm.includes("bebida")) {
      return "BEBIDAS";
    }
    // 3. FRACIONADOS
    if (norm.includes("fracionado")) {
      return "FRACIONADOS";
    }
    // 4. HIGIENE, SAUDE E BELEZA
    if (norm.includes("higiene") || norm.includes("saude") || norm.includes("beleza") || norm.includes("perfumaria") || norm.includes("cosmetico")) {
      return "HIGIENE, SAUDE E BELEZA";
    }
    // 5. MERCEARIA SECA
    if (norm.includes("mercearia") || norm.includes("mercear")) {
      return "MERCEARIA SECA";
    }
    // 6. LIMPEZA E LAVANDERIA
    if (norm.includes("limpeza") || norm.includes("lavanderia")) {
      return "LIMPEZA E LAVANDERIA";
    }
    // 7. CONFINADOS
    if (norm.includes("confinado")) {
      return "CONFINADOS";
    }
    // 8. BAZAR, ELETRO E TEXTIL
    if (norm.includes("bazar") || norm.includes("eletro") || norm.includes("textil")) {
      return "BAZAR, ELETRO E TEXTIL";
    }
    // 9. AEROSOL
    if (norm.includes("aerosol") || norm.includes("aerossol")) {
      return "AEROSOL";
    }
    // 10. FEFO
    if (norm.includes("fefo")) {
      return "FEFO";
    }

    return ""; // Exclude other unrequested sectors
  };

  // Safe sector lookup from Google Sheets "Setores" layout mapped to allowed canonical sectors
  const getCellSector = (rNum: number, pos: number, lvl: number): string => {
    if (!data || !data.setoresLayout) return "";
    const item = data.setoresLayout.find(
      (x: any) => x.rua === rNum && x.predio === pos && x.andar === lvl
    );
    return item ? canonicalSector(item.setor) : "";
  };

  // Dynamic sector parsing for the 10 strictly specified sectors
  const parsedSectors = useMemo(() => {
    // Standard color palettes for the 10 authorized sectors
    const colorTemplates: { [key: string]: { bg: string; border: string; text: string } } = {
      "BEBIDAS": { bg: "bg-green-500", border: "border-green-600", text: "text-black" },
      "CONFINADOS - BEBIDAS": { bg: "bg-violet-500", border: "border-violet-600", text: "text-white" }, // Custom beautiful color
      "FRACIONADOS": { bg: "bg-red-600", border: "border-red-700", text: "text-white" },
      "HIGIENE, SAUDE E BELEZA": { bg: "bg-pink-500", border: "border-pink-600", text: "text-white" },
      "MERCEARIA SECA": { bg: "bg-[#ffd966]", border: "border-yellow-600", text: "text-black" },
      "LIMPEZA E LAVANDERIA": { bg: "bg-blue-600", border: "border-blue-700", text: "text-white" },
      "CONFINADOS": { bg: "bg-neutral-700", border: "border-neutral-800", text: "text-white" },
      "BAZAR, ELETRO E TEXTIL": { bg: "bg-amber-800", border: "border-amber-900", text: "text-white" },
      "AEROSOL": { bg: "bg-cyan-500", border: "border-cyan-600", text: "text-black" },
      "FEFO": { bg: "bg-orange-500", border: "border-orange-600", text: "text-white" }
    };

    const countsMap: { [key: string]: number } = {
      "BEBIDAS": 0,
      "CONFINADOS - BEBIDAS": 0,
      "FRACIONADOS": 0,
      "HIGIENE, SAUDE E BELEZA": 0,
      "MERCEARIA SECA": 0,
      "LIMPEZA E LAVANDERIA": 0,
      "CONFINADOS": 0,
      "BAZAR, ELETRO E TEXTIL": 0,
      "AEROSOL": 0,
      "FEFO": 0
    };

    if (data && data.setoresLayout) {
      data.setoresLayout.forEach((item: any) => {
        const canonical = canonicalSector(item.setor);
        if (canonical) {
          countsMap[canonical] = (countsMap[canonical] || 0) + 1;
        }
      });
    }

    const predefinedKeys = [
      "BEBIDAS",
      "CONFINADOS - BEBIDAS",
      "FRACIONADOS",
      "HIGIENE, SAUDE E BELEZA",
      "MERCEARIA SECA",
      "LIMPEZA E LAVANDERIA",
      "CONFINADOS",
      "BAZAR, ELETRO E TEXTIL",
      "AEROSOL",
      "FEFO"
    ];

    const sectorsAr = predefinedKeys.map((sectorName) => {
      const count = countsMap[sectorName] || 0;
      const style = colorTemplates[sectorName] || { bg: "bg-purple-600", border: "border-purple-700", text: "text-white" };

      return {
        norm: sectorName,
        displayName: sectorName,
        count,
        style
      };
    });

    // Order by quantity (highest first!)
    sectorsAr.sort((a, b) => b.count - a.count);

    // Number sequentially based on quantity rank
    return sectorsAr.map((item, index) => ({
      ...item,
      id: index + 1
    }));
  }, [data]);

  // Maps sector strings to specified dynamic colors and sequence number
  const getSectorStyle = (sectorName: string) => {
    if (!sectorName) {
      return {
        bg: "bg-white",
        text: "text-zinc-400 border-zinc-200/60 hover:bg-zinc-50",
        border: "border-zinc-250",
        id: "0"
      };
    }

    const found = parsedSectors.find((s) => s.norm === sectorName);

    if (found) {
      return {
        bg: found.style.bg,
        text: found.style.text,
        border: found.style.border,
        id: String(found.id)
      };
    }

    return { bg: "bg-purple-600", text: "text-white font-bold", border: "border-purple-700", id: "?" };
  };

  const ruaSequence = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <div className="flex flex-col items-center justify-start p-4 bg-zinc-950 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden w-full gap-4">
      
      {/* Legend Header Panel linked to Google Sheets sectores */}
      <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 shadow-inner flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2">
          <div className="flex flex-col">
            <h4 className="text-xs font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
              Legenda de Setores do CD
            </h4>
            <p className="text-[10px] text-zinc-400">Classificação colorida conforme aba "Setores" da planilha do Google Sheets</p>
          </div>
          {data?.setoresLayout && (
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-850 px-2.5 py-1 rounded-md border border-zinc-800 flex items-center gap-1.5 Self-start sm:self-auto">
              Total Mapeado: <strong className="text-yellow-500">{data.setoresLayout.length}</strong> posições
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-2 w-full">
          {parsedSectors.map((sec) => (
            <div key={sec.norm} className="bg-zinc-950/50 border border-zinc-800/80 p-2 rounded-lg flex items-center gap-2">
              <div className={cn("w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shadow-sm border", sec.style.bg, sec.style.border, sec.style.text)}>
                {sec.id}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-semibold text-zinc-300 truncate uppercase select-none">{sec.displayName}</span>
                <span className="text-[9px] text-zinc-500 font-mono leading-none">{sec.count} pos.</span>
              </div>
            </div>
          ))}

          {/* Sem Setor */}
          <div className="bg-zinc-950/50 border border-zinc-800/80 p-2 rounded-lg flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-white flex items-center justify-center text-[9px] font-black text-zinc-800 border border-zinc-400 shadow-sm">0</div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-semibold text-zinc-300 truncate uppercase select-none">Sem Setor</span>
              <span className="text-[9px] text-zinc-500 font-mono leading-none">
                {useMemo(() => {
                  const mappedCount = data?.setoresLayout?.length || 0;
                  return Math.max(0, 11088 - mappedCount);
                }, [data])} pos.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Layout strictly holding only the Street Matrices from 17 to 1 */}
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[74vh] custom-scrollbar rounded-xl bg-zinc-900/10 p-1">
        <div className="flex gap-2 p-1 justify-start items-start select-none min-w-max">
          
          {ruaSequence.map((rNum) => {
            const isRua1 = rNum === 1;
            const sideTextOdd = "LADO IMPAR".split("");
            const sideTextEven = "LADO PAR".split("");

            return (
              <div key={rNum} className="flex flex-col items-center gap-1.5 min-w-max">
                
                {/* Minimal Street designation label */}
                <div className="bg-zinc-900 border border-zinc-700 text-[#cca21a] font-mono font-bold text-[9px] px-2.5 py-0.5 rounded shadow-sm uppercase tracking-wider text-center w-full">
                  Rua {rNum}
                </div>

                {/* Minimalist physical grid block */}
                <div className="flex items-stretch bg-white border border-black/80 text-black font-sans shadow-md rounded-sm">
                  
                  {/* Left Yellow Sidebar: Lado Ímpar */}
                  <div 
                    className="bg-[#ffd966] text-black font-extrabold flex flex-col items-center justify-center border-r border-black select-none gap-0.5 py-2"
                    style={{
                      width: `${sidebarColWidth}px`,
                      fontSize: `${txtSize * 0.85}px`
                    }}
                  >
                    {sideTextOdd.map((char, idx) => (
                      <span key={idx} className="leading-none">{char}</span>
                    ))}
                  </div>

                  {/* Core layout grid */}
                  <div className="flex flex-col bg-white">
                    
                    {/* RECEBIMENTO Top Header Bar */}
                    <div 
                      className="bg-[#f9cb9c] text-black font-extrabold text-center uppercase flex items-center justify-center border-b border-black select-none"
                      style={{
                        height: `${rowCellHeight * 1.3}px`,
                        fontSize: `${txtSize * 0.9}px`
                      }}
                    >
                      {isRua1 ? "RECEB" : "RECEBIMENTO"}
                    </div>

                    {/* 56 vertical rows container */}
                    <div className="flex flex-col">
                      {rows.map((row) => (
                        <div 
                          key={row.idx}
                          className="flex items-center border-b border-black select-none"
                          style={{
                            height: `${rowCellHeight}px`
                          }}
                        >
                          
                          {/* Module Odd Number Label */}
                          <div 
                            className="bg-[#efefef] text-black font-semibold text-center border-r border-black flex items-center justify-center h-full"
                            style={{
                              width: `${modCellWidth}px`,
                              fontSize: `${txtSize}px`
                            }}
                          >
                            {row.posOdd}
                          </div>

                          {/* Level slots 6 down to 1 */}
                          {[6, 5, 4, 3, 2, 1].map((lvl) => {
                            const sector = getCellSector(rNum, row.posOdd, lvl);
                            const style = getSectorStyle(sector);

                            return (
                              <div 
                                key={lvl}
                                className={cn(
                                  "border-r border-black h-full transition-colors flex items-center justify-center select-none leading-none",
                                  style.bg,
                                  style.text
                                )}
                                style={{
                                  width: `${lvlCellSize}px`,
                                  fontSize: `${txtSize * 0.95}px`
                                }}
                                title={`Rua ${rNum} • Mód: ${row.posOdd} • Nível: ${lvl}${
                                  sector ? ` • Setor: #${style.id} - ${sector}` : " • (Sem Setor)"
                                }`}
                              >
                                {lvl}
                              </div>
                            );
                          })}

                          {/* Wider middle corridor */}
                          {!isRua1 && (
                            <div 
                              className="bg-zinc-100 border-r border-black h-full flex items-center justify-center shadow-inner"
                              style={{
                                width: `${corrWidth}px`
                              }}
                            />
                          )}

                          {/* Level slots 1 up to 6 for even positions */}
                          {!isRua1 && [1, 2, 3, 4, 5, 6].map((lvl) => {
                            const sector = getCellSector(rNum, row.posEven, lvl);
                            const style = getSectorStyle(sector);

                            return (
                              <div 
                                key={lvl}
                                className={cn(
                                  "border-r border-black h-full transition-colors flex items-center justify-center select-none leading-none",
                                  style.bg,
                                  style.text
                                )}
                                style={{
                                  width: `${lvlCellSize}px`,
                                  fontSize: `${txtSize * 0.95}px`
                                }}
                                title={`Rua ${rNum} • Mód: ${row.posEven} • Nível: ${lvl}${
                                  sector ? ` • Setor: #${style.id} - ${sector}` : " • (Sem Setor)"
                                }`}
                              >
                                {lvl}
                              </div>
                            );
                          })}

                          {/* Module Even Number Label */}
                          {!isRua1 && (
                            <div 
                              className="bg-[#efefef] text-black font-semibold text-center flex items-center justify-center h-full"
                              style={{
                                width: `${modCellWidth}px`,
                                fontSize: `${txtSize}px`
                              }}
                            >
                              {row.posEven}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>

                    {/* EXPEDIÇÃO Bottom Footer Bar */}
                    <div 
                      className="bg-[#4a86e8] text-black font-extrabold text-center uppercase flex items-center justify-center select-none"
                      style={{
                        height: `${rowCellHeight * 1.3}px`,
                        fontSize: `${txtSize * 0.9}px`
                      }}
                    >
                      {isRua1 ? "EXPED" : "EXPEDIÇÃO"}
                    </div>

                  </div>

                  {/* Right Yellow Sidebar: Lado Par (Hidden on Rua 1) */}
                  {!isRua1 && (
                    <div 
                      className="bg-[#ffd966] text-black font-extrabold flex flex-col items-center justify-center border-l border-black select-none gap-0.5 py-2"
                      style={{
                        width: `${sidebarColWidth}px`,
                        fontSize: `${txtSize * 0.85}px`
                      }}
                    >
                      {sideTextEven.map((char, idx) => (
                        <span key={idx} className="leading-none">{char}</span>
                      ))}
                    </div>
                  )}

                </div>
              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}
