(() => {
  'use strict';

  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN = 92;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  function safeFilename(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'tanulo';
  }

  function wrapLines(ctx, text, maxWidth) {
    const paragraphs = String(text ?? '').split(/\n/);
    const lines = [];
    paragraphs.forEach((p, pi) => {
      const words = p.split(/\s+/).filter(Boolean);
      if (!words.length) lines.push('');
      else {
        let line = words.shift();
        for (const word of words) {
          const test = `${line} ${word}`;
          if (ctx.measureText(test).width <= maxWidth) line = test;
          else { lines.push(line); line = word; }
        }
        lines.push(line);
      }
      if (pi < paragraphs.length - 1) lines.push('');
    });
    return lines;
  }

  class ReportCanvas {
    constructor() {
      this.pages = [];
      this.newPage();
    }
    newPage() {
      const canvas = document.createElement('canvas');
      canvas.width = PAGE_W;
      canvas.height = PAGE_H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      ctx.textBaseline = 'top';
      this.pages.push({ canvas, ctx });
      this.ctx = ctx;
      this.y = MARGIN;
      this.drawFooterPlaceholder();
    }
    drawFooterPlaceholder() {}
    ensure(height) {
      if (this.y + height > PAGE_H - MARGIN - 60) this.newPage();
    }
    text(text, opts = {}) {
      const size = opts.size || 28;
      const weight = opts.weight || '400';
      const color = opts.color || '#1b2430';
      const maxWidth = opts.maxWidth || CONTENT_W;
      const lineHeight = opts.lineHeight || Math.round(size * 1.38);
      this.ctx.font = `${weight} ${size}px Arial, Segoe UI, sans-serif`;
      this.ctx.fillStyle = color;
      const lines = wrapLines(this.ctx, text, maxWidth);
      this.ensure(lines.length * lineHeight + (opts.after || 0));
      for (const line of lines) {
        this.ctx.fillText(line, MARGIN, this.y);
        this.y += lineHeight;
      }
      this.y += opts.after || 0;
      return lines.length * lineHeight;
    }
    rule(gap = 20) {
      this.ensure(gap + 2);
      this.y += Math.floor(gap / 2);
      this.ctx.fillStyle = '#dfe5ec';
      this.ctx.fillRect(MARGIN, this.y, CONTENT_W, 2);
      this.y += Math.ceil(gap / 2);
    }
    summaryBox(label, value, x, y, w) {
      const ctx = this.ctx;
      ctx.fillStyle = '#f6f9ff';
      ctx.strokeStyle = '#cbdcf7';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, 120, 18);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#667085'; ctx.font = '600 22px Arial'; ctx.fillText(label, x + 20, y + 20);
      ctx.fillStyle = '#1b2430'; ctx.font = '700 34px Arial'; ctx.fillText(value, x + 20, y + 56);
    }
    finalizeFooters() {
      this.pages.forEach((p, i) => {
        const ctx = p.ctx;
        ctx.fillStyle = '#98a2b3';
        ctx.font = '18px Arial';
        ctx.fillText('Munkavállalói ismeretek - eredménylap', MARGIN, PAGE_H - 62);
        const pageText = `${i + 1} / ${this.pages.length}. oldal`;
        const width = ctx.measureText(pageText).width;
        ctx.fillText(pageText, PAGE_W - MARGIN - width, PAGE_H - 62);
      });
    }
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function formatSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function buildReport(result) {
    const r = new ReportCanvas();
    r.text('MUNKAVÁLLALÓI ISMERETEK', { size: 22, weight: '700', color: '#1f6feb', after: 8 });
    r.text('Tudásellenőrzés - egyéni eredménylap', { size: 42, weight: '700', after: 18 });
    r.text(`Tanuló: ${result.student_name}`, { size: 28, weight: '700', after: 5 });
    r.text(`Osztály: ${result.class_name}`, { size: 24, color: '#667085', after: 4 });
    r.text(`Kitöltés: ${result.finished_at}    Azonosító: ${result.attempt_id}`, { size: 20, color: '#667085', after: 28 });

    const boxGap = 22;
    const boxW = (CONTENT_W - boxGap * 2) / 3;
    r.summaryBox('Pontszám', `${result.score} / ${result.max_score}`, MARGIN, r.y, boxW);
    r.summaryBox('Eredmény', `${Number(result.percent).toFixed(1)}% - ${result.grade}`, MARGIN + boxW + boxGap, r.y, boxW);
    r.summaryBox('Idő / ablakváltás', `${formatSeconds(result.elapsed_seconds)} / ${result.incidents}`, MARGIN + (boxW + boxGap) * 2, r.y, boxW);
    r.y += 152;

    r.text('Részletes értékelés', { size: 32, weight: '700', after: 18 });
    if (!result.correct_answers_revealed) {
      r.text('A helyes válaszok a tanári beállítás miatt nem jelennek meg ezen az eredménylapon.', { size: 20, color: '#667085', after: 18 });
    }

    result.details.forEach((d, idx) => {
      const qText = `${idx + 1}. ${d.question}`;
      r.ctx.font = '700 24px Arial';
      const qLines = wrapLines(r.ctx, qText, CONTENT_W);
      r.ctx.font = '400 21px Arial';
      const aText = d.answer?.length ? d.answer.join(' | ') : 'Nem adott választ';
      const aLines = wrapLines(r.ctx, `Saját válasz: ${aText}`, CONTENT_W - 24);
      const cText = d.correct_answer ? `Helyes válasz: ${d.correct_answer.join(' | ')}` : '';
      const cLines = cText ? wrapLines(r.ctx, cText, CONTENT_W - 24) : [];
      const needed = qLines.length * 34 + aLines.length * 30 + cLines.length * 30 + 105;
      r.ensure(needed);

      r.ctx.fillStyle = d.is_correct ? '#eaf7f0' : '#fff1f0';
      r.ctx.strokeStyle = d.is_correct ? '#84d6ad' : '#f0a39d';
      r.ctx.lineWidth = 2;
      const boxY = r.y;
      const boxH = needed - 16;
      roundRect(r.ctx, MARGIN, boxY, CONTENT_W, boxH, 16);
      r.ctx.fill(); r.ctx.stroke();

      let y = boxY + 20;
      r.ctx.fillStyle = '#1b2430';
      r.ctx.font = '700 24px Arial';
      qLines.forEach(line => { r.ctx.fillText(line, MARGIN + 22, y); y += 34; });
      y += 8;
      r.ctx.font = '400 21px Arial';
      r.ctx.fillStyle = '#475467';
      aLines.forEach(line => { r.ctx.fillText(line, MARGIN + 22, y); y += 30; });
      if (cLines.length) {
        y += 5;
        cLines.forEach(line => { r.ctx.fillText(line, MARGIN + 22, y); y += 30; });
      }
      y += 8;
      r.ctx.font = '700 21px Arial';
      r.ctx.fillStyle = d.is_correct ? '#16794d' : '#b42318';
      r.ctx.fillText(`${d.points} / ${d.max_points} pont - ${d.is_correct ? 'HELYES' : 'NEM TELJESEN HELYES'}`, MARGIN + 22, y);
      r.y = boxY + boxH + 18;
    });

    r.finalizeFooters();
    return r.pages.map(p => p.canvas);
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function asciiBytes(s) { return new TextEncoder().encode(s); }

  function concatBytes(chunks) {
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    return out;
  }

  async function canvasesToPdf(canvases) {
    const jpgs = canvases.map(c => dataUrlToBytes(c.toDataURL('image/jpeg', 0.9)));
    const objects = new Map();
    const pageRefs = [];

    const catalogObj = 1, pagesObj = 2;
    canvases.forEach((canvas, i) => {
      const pageObj = 3 + i * 3;
      const imageObj = 4 + i * 3;
      const contentObj = 5 + i * 3;
      pageRefs.push(`${pageObj} 0 R`);

      const content = `q\n595 0 0 842 0 0 cm\n/Im${i + 1} Do\nQ\n`;
      const contentBytes = asciiBytes(content);
      objects.set(pageObj, asciiBytes(`${pageObj} 0 obj\n<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${i + 1} ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`));

      const imgHeader = asciiBytes(`${imageObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgs[i].length} >>\nstream\n`);
      const imgFooter = asciiBytes(`\nendstream\nendobj\n`);
      objects.set(imageObj, concatBytes([imgHeader, jpgs[i], imgFooter]));

      objects.set(contentObj, concatBytes([
        asciiBytes(`${contentObj} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
        contentBytes,
        asciiBytes(`endstream\nendobj\n`),
      ]));
    });

    objects.set(catalogObj, asciiBytes(`${catalogObj} 0 obj\n<< /Type /Catalog /Pages ${pagesObj} 0 R >>\nendobj\n`));
    objects.set(pagesObj, asciiBytes(`${pagesObj} 0 obj\n<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${canvases.length} >>\nendobj\n`));

    const header = asciiBytes('%PDF-1.4\n');
    const maxObj = 2 + canvases.length * 3;
    const chunks = [header];
    const offsets = new Array(maxObj + 1).fill(0);
    let length = header.length;
    for (let n = 1; n <= maxObj; n++) {
      const obj = objects.get(n);
      if (!obj) throw new Error(`Hiányzó PDF objektum: ${n}`);
      offsets[n] = length;
      chunks.push(obj);
      length += obj.length;
    }

    const xrefOffset = length;
    let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= maxObj; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(asciiBytes(xref));
    return new Blob(chunks, { type: 'application/pdf' });
  }

  async function download(result) {
    const canvases = buildReport(result);
    const blob = await canvasesToPdf(canvases);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = String(result.finished_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    a.download = `munkavallaloi_eredmeny_${safeFilename(result.student_name)}_${date}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  window.TestReportPDF = { download, buildReport, canvasesToPdf };
})();
