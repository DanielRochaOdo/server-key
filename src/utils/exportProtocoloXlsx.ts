import * as XLSX from "xlsx-js-style";

type Prioridade = "BAIXA" | "MEDIA" | "ALTA";

type ExportItem = {
  loja: string;
  produto: string;
  prioridade: Prioridade;
  quantidade: number;
  valorUnit: number;
  frete: number;
  link: string;
};

export function exportProtocoloXlsx(params: { protocoloNome: string; itens: ExportItem[] }) {
  const { protocoloNome, itens } = params;

  const wb = XLSX.utils.book_new();

  const grupos: { prioridade: Prioridade; sheetName: string }[] = [
    { prioridade: "BAIXA", sheetName: "BAIXA" },
    { prioridade: "MEDIA", sheetName: "MEDIA" },
    { prioridade: "ALTA", sheetName: "ALTA" },
  ];

  for (const g of grupos) {
    const itensFiltrados = itens.filter((i) => normalizePrioridade(i.prioridade) === g.prioridade);

    const ws = buildSheet({
      titulo: `${protocoloNome} - ${g.sheetName}`,
      itens: itensFiltrados,
    });

    XLSX.utils.book_append_sheet(wb, ws, g.sheetName);
  }

  XLSX.writeFile(wb, `${protocoloNome}.xlsx`);
}

function buildSheet(params: { titulo: string; itens: ExportItem[] }) {
  const { titulo, itens } = params;

  // Linhas (A..H)
  const rows: any[][] = [];
  rows.push([titulo, null, null, null, null, null, null, null]); // A1:H1 (A1:G1 mesclado)
  rows.push([
    "Loja",
    "Produto - Descrição",
    "Prioridade",
    "Quant",
    "Valor Uni.",
    "Frete",
    "Valor Total + Frete",
    "LINK",
  ]);

  for (const it of itens) {
    const qtd = Number(it.quantidade || 0);
    const v = Number(it.valorUnit || 0);
    const frete = Number(it.frete || 0);
    const valorTotal = round2(qtd * v + frete);

    rows.push([
      it.loja,
      it.produto,
      normalizePrioridade(it.prioridade),
      qtd,
      v,
      frete,
      valorTotal,
      it.link || "",
    ]);
  }

  // Linha total (F = label, G = fórmula)
  rows.push([null, null, null, null, null, "Valor Total + Frete", null, null]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merge A1:G1 (igual seu template)
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

  // Larguras
  ws["!cols"] = [
    { wch: 18 }, // A Loja
    { wch: 70 }, // B Produto
    { wch: 14 }, // C Prioridade
    { wch: 8 },  // D Quant
    { wch: 14 }, // E Valor Uni
    { wch: 12 }, // F Frete
    { wch: 18 }, // G Valor Total
    { wch: 18 }, // H LINK
  ];

  // Styles
  const center = { horizontal: "center", vertical: "center" } as const;
  const right = { horizontal: "right", vertical: "center" } as const;

  const thinBorder = {
    top: { style: "thin", color: { rgb: "FFBFBFBF" } },
    bottom: { style: "thin", color: { rgb: "FFBFBFBF" } },
    left: { style: "thin", color: { rgb: "FFBFBFBF" } },
    right: { style: "thin", color: { rgb: "FFBFBFBF" } },
  } as const;

  // A1 título
  setCellStyle(ws, 0, 0, {
    font: { name: "Arial", bold: true, sz: 11 },
    alignment: center,
  });

  // Header row (row 2)
  for (let c = 0; c <= 7; c++) {
    setCellStyle(ws, 1, c, {
      font: { name: "Aptos Narrow", bold: true, sz: 12 },
      fill: { patternType: "solid", fgColor: { rgb: "FFF1A983" } }, // laranja
      alignment: center,
      border: { bottom: { style: "thin", color: { rgb: "FF000000" } } },
    });
  }

  // Body
  const bodyStartIdx = 2; // linha 3 (0-based)
  const bodyEndIdx = 1 + itens.length; // última linha de item (0-based). Se 0 itens, bodyEndIdx=1 e não entra no loop.

  for (let r = bodyStartIdx; r <= bodyEndIdx; r++) {
    for (let c = 0; c <= 7; c++) {
      const isMoney = c === 4 || c === 5 || c === 6;
      const isQty = c === 3;

      setCellStyle(ws, r, c, {
        font: { name: "Arial", sz: 11, color: { rgb: "FF222222" } },
        border: thinBorder,
        alignment:
          c === 0 || c === 1
            ? { horizontal: "left", vertical: "center", wrapText: true }
            : isMoney || isQty
              ? right
              : center,
        numFmt: isMoney
          ? '_-"R$"* #,##0.00_-;-"R$"* #,##0.00_-;_-"R$"* "-"??_-;_-@'
          : "General",
      });

      // Prioridade com cor
      if (c === 2) {
        const p = String(getCell(ws, r, c) || "").toUpperCase();
        const color = p === "BAIXA" ? "FFD9ECFF" : p === "MEDIA" ? "FFFFF2CC" : "FFFFD6D6";
        setCellStyle(ws, r, c, {
          fill: { patternType: "solid", fgColor: { rgb: color } },
        });
      }

      // Link com hyperlink
      if (c === 7) {
        const link = String(getCell(ws, r, c) || "").trim();
        if (link) {
          const addr = XLSX.utils.encode_cell({ r, c });
          (ws as any)[addr].l = { Target: link, Tooltip: "Abrir link" };
          setCellStyle(ws, r, c, { font: { color: { rgb: "FF0563C1" }, underline: true } });
        }
      }
    }
  }

  // Linha total
  const totalRowIdx = 2 + itens.length; // se 0 itens => 2
  setCellValue(ws, totalRowIdx, 5, "Valor Total + Frete");

  setCellStyle(ws, totalRowIdx, 5, {
    font: { name: "Aptos Narrow", bold: true, sz: 11, color: { rgb: "FFFFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "FF000000" } },
    alignment: right,
  });

  // Fórmula: SUM(G3:G{n})
  const sumFrom = 3; // primeira linha de item em 1-based
  const sumTo = 2 + itens.length; // última linha de item em 1-based
  const formula = itens.length ? `SUM(G${sumFrom}:G${sumTo})` : "0";

  setCellFormula(ws, totalRowIdx, 6, formula);
  setCellStyle(ws, totalRowIdx, 6, {
    font: { name: "Aptos Narrow", sz: 11, color: { rgb: "FFFFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "FF000000" } },
    alignment: right,
    numFmt: '_-"R$"* #,##0.00_-;-"R$"* #,##0.00_-;_-"R$"* "-"??_-;_-@',
  });

  return ws;
}

function normalizePrioridade(p: any): Prioridade {
  const u = String(p || "").toUpperCase();
  if (u === "BAIXA") return "BAIXA";
  if (u === "ALTA") return "ALTA";
  return "MEDIA";
}

function round2(n: number) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

// ===== helpers styles/cells =====

function setCellStyle(ws: XLSX.WorkSheet, r: number, c: number, style: XLSX.CellStyle) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) ws[addr] = { t: "s", v: "" } as any;
  (ws[addr] as any).s = { ...(ws[addr] as any).s, ...style };
}

function setCellValue(ws: XLSX.WorkSheet, r: number, c: number, v: any) {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = ws[addr] || ({} as any);
  (ws[addr] as any).v = v;
  (ws[addr] as any).t = typeof v === "number" ? "n" : "s";
}

function setCellFormula(ws: XLSX.WorkSheet, r: number, c: number, formula: string) {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = ws[addr] || ({} as any);
  (ws[addr] as any).f = formula;
  (ws[addr] as any).t = "n";
}

function getCell(ws: XLSX.WorkSheet, r: number, c: number) {
  const addr = XLSX.utils.encode_cell({ r, c });
  return (ws as any)[addr]?.v;
}
