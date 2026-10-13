import ExcelJS from 'exceljs';
import type { Card } from '../shared/cardReview';
import { orderedNodes, type WebsitePlan } from '../shared/websitePlan';

export async function planWorkbook(plan: WebsitePlan, cards: Card[], offering: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Topic Gibbon'; workbook.created = new Date();
  const sheet = (name: string, headings: string[], widths: number[]) => {
    const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = headings.map((header, i) => ({ header, width: widths[i] ?? 32 }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF21634A' } };
    ws.getRow(1).height = 30;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headings.length } };
    return ws;
  };
  const structure = sheet('Website plan', ['ID', 'Parent ID', 'Level', 'Recommendation', 'Treatment', 'Priority', 'Demand', 'What to cover', 'Why this', 'Demand area IDs', 'Overlap or thin-page note'], [16, 16, 8, 38, 24, 14, 24, 60, 60, 32, 50]);
  for (const {node, depth} of orderedNodes(plan.nodes)) structure.addRow([node.id, node.parentId ?? '', depth + 1, node.label, node.treatment, node.priority, 'Insufficient evidence', node.coverage.join('\n'), node.rationale, node.clusterIds.join('\n'), node.riskNote]);
  const areas = sheet('Demand areas', ['Demand area ID', 'Label', 'Customer need', 'Demand'], [32, 40, 70, 24]);
  const evidence = sheet('Search evidence', ['Demand area ID', 'Query ID', 'Observed search', 'Provider', 'Source field', 'Source reference', 'Retrieved at'], [32, 20, 60, 18, 32, 65, 28]);
  for (const card of cards) {
    areas.addRow([card.groupId, card.label, card.need, 'Insufficient evidence']);
    for (const query of card.queries) for (const source of query.sources) evidence.addRow([card.groupId, query.id, query.query, source.provider, source.field, source.reference, source.retrievedAt]);
  }
  const notes = sheet('Context and limits', ['Item', 'Details'], [28, 100]);
  notes.addRow(['Offering', offering]); notes.addRow(['Summary', plan.summary]);
  notes.addRow(['Priority', 'First / Next / Later describes business fit, intent and importance, not search volume.']);
  notes.addRow(['Demand', 'Insufficient evidence: no reliable external search-volume measurements were available.']);
  for (const limitation of plan.limitations) notes.addRow(['Limitation', limitation]);
  for (const ws of workbook.worksheets) ws.eachRow((row, i) => {
    row.alignment = { vertical: 'top', wrapText: true };
    if (i > 1) {
      row.font = { name: 'Calibri', size: 11, color: { argb: 'FF1D2723' } };
      let lines = 1;
      row.eachCell((cell, column) => { const width = ws.getColumn(column).width ?? 32;
        lines = Math.max(lines, String(cell.value ?? '').split('\n').reduce((total, text) => total + Math.max(1, Math.ceil(text.length / (width * .9))), 0));
      });
      row.height = Math.min(409, Math.max(30, lines * 15 + 12));
    }
  });
  return workbook;
}

export async function downloadPlan(plan: WebsitePlan, cards: Card[], offering: string) {
  const workbook = await planWorkbook(plan, cards, offering);
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = 'topic-gibbon-website-plan.xlsx'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
