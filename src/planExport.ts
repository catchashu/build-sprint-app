import ExcelJS from 'exceljs';
import type { Card } from '../shared/cardReview';
import { orderedNodes, isStandalone, containingPage, planEvidence, type WebsitePlan } from '../shared/websitePlan';
import {demandSummary,volumeFor,VOLUME_NOTE,VOLUME_ENDPOINT,type VolumeSnapshot} from '../shared/searchVolume';

export async function planWorkbook(plan: WebsitePlan, cards: Card[], offering: string, volumes?:VolumeSnapshot|null) {
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
  const structure = sheet('Website pages', ['ID', 'Parent page ID', 'Page level', 'Page or resource', 'Treatment', 'Priority', 'Demand', 'What to cover', 'Why this treatment and priority', 'Mapped demand area IDs', 'Overlap or thin-page note'], [16, 20, 12, 38, 24, 14, 24, 60, 70, 32, 50]);
  const content = sheet('On-page content', ['ID', 'Containing page ID', 'Containing page', 'Content recommendation', 'Treatment', 'Priority', 'Demand', 'What to cover', 'Why this treatment and priority', 'Mapped demand area IDs', 'Overlap or thin-page note', 'Parent recommendation ID'], [16, 20, 38, 38, 24, 14, 24, 60, 70, 32, 50, 24]);
  for (const {node} of orderedNodes(plan.nodes)) {
    const owner = containingPage(node, plan.nodes);
    const demand=demandSummary(planEvidence(node,cards).queries,volumes);
    const details = [node.label, node.treatment, node.priority, demand.peak===null?'Insufficient evidence':demand.text, node.coverage.join('\n'), node.rationale, node.clusterIds.join('\n'), node.riskNote];
    if (isStandalone(node)) {
      let level = 1, ancestor = owner;
      while (ancestor) { level++; ancestor = containingPage(ancestor, plan.nodes); }
      structure.addRow([node.id, owner?.id ?? '', level, ...details]);
    } else content.addRow([node.id, owner?.id ?? '', owner?.label ?? '', ...details, node.parentId ?? '']);
  }
  const areas = sheet('Demand areas', ['Demand area ID', 'Label', 'Customer need', 'Demand'], [32, 40, 70, 24]);
  const evidence = sheet('Search evidence', ['Demand area ID', 'Query ID', 'Observed search', 'Provider', 'Source field', 'Source reference', 'Retrieved at'], [32, 20, 60, 18, 32, 65, 28]);
  for (const card of cards) {
    const demand=demandSummary(card.queries,volumes);
    areas.addRow([card.groupId, card.label, card.need, demand.peak===null?'Insufficient evidence':demand.text]);
    for (const query of card.queries) for (const source of query.sources) evidence.addRow([card.groupId, query.id, query.query, source.provider, source.field, source.reference, source.retrievedAt]);
  }
  const notes = sheet('Context and limits', ['Item', 'Details'], [28, 100]);
  notes.addRow(['Offering', offering]); notes.addRow(['Summary', plan.summary]);
  notes.addRow(['How to read this plan', 'Website pages lists separate pages and supporting resources. On-page content lists sections and FAQs that belong within those pages, with no separate URL. Page level counts only separate pages/resources.']);
  notes.addRow(['Evidence scope', 'Search evidence contains the full retained searches for each mapped demand area. These are area-level context; not every search supports every section or FAQ mapped to that area.']);
  notes.addRow(['Priority', 'First / Next / Later describes business fit, intent and importance, not search volume.']);
  notes.addRow(['Demand', VOLUME_NOTE]);
  notes.addRow(['Volume availability',volumes?`Saved lookup from ${volumes.retrievedAt}. Blank/unavailable values are unknown, not zero. Saved reasoning may predate this lookup.`:'No saved volume lookup is available.']);
  for (const limitation of plan.limitations) notes.addRow(['Limitation', limitation]);
  if(volumes){
    const metrics=sheet('Search volumes',['Observed search','Monthly searches (estimate)','Market','Language','Provider','Retrieved at','Task ID','Endpoint','Monthly history'],[60,26,14,14,28,28,40,65,65]);
    const queries=[...new Map(cards.flatMap(c=>c.queries).map(q=>[q.query.trim().toLowerCase(),q])).values()];
    for(const q of queries){const row=volumes.rows.find(r=>r.keyword===q.query.trim().toLowerCase().replace(/\s+/g,' '));
      metrics.addRow([q.query,volumeFor(q.query,volumes)??'Unavailable','India','English','DataForSEO / Google Ads',volumes.retrievedAt,volumes.taskId,VOLUME_ENDPOINT,row?.monthly.map(m=>`${m.year}-${String(m.month).padStart(2,'0')}: ${m.volume}`).join('\n')??'']);
    }
  }
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

export async function downloadPlan(plan: WebsitePlan, cards: Card[], offering: string,volumes?:VolumeSnapshot|null) {
  const workbook = await planWorkbook(plan, cards, offering,volumes);
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = 'topic-gibbon-website-plan.xlsx'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
