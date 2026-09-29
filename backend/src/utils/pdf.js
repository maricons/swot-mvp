const PDFDocument = require('pdfkit');

// Streams a simple table as a PDF download.
// columns = [{ header, key, width (relative), align }]; rows = objects with those keys already formatted as text.
const sendTablePdf = (res, { filename, title, subtitle, columns, rows }) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const usable = doc.page.width - left - doc.page.margins.right;
    const totalWeight = columns.reduce((sum, c) => sum + (c.width || 1), 0);
    const widths = columns.map((c) => ((c.width || 1) / totalWeight) * usable);
    const bottom = () => doc.page.height - doc.page.margins.bottom - 20;

    const drawRow = (values, { bold = false, fill } = {}) => {
        const y = doc.y;
        const height = 20;
        if (fill) doc.rect(left, y - 4, usable, height).fill(fill);
        doc.fillColor(bold ? '#ffffff' : '#1f2d33').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        let x = left;
        values.forEach((value, i) => {
            doc.text(String(value ?? ''), x + 4, y, { width: widths[i] - 8, align: columns[i].align || 'left', lineBreak: false, ellipsis: true });
            x += widths[i];
        });
        doc.y = y + height;
    };

    const drawHeader = () => drawRow(columns.map((c) => c.header), { bold: true, fill: '#114c5f' });

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#114c5f').text(title);
    doc.font('Helvetica').fontSize(10).fillColor('#6b7a80').text(subtitle);
    doc.moveDown();
    drawHeader();

    rows.forEach((row, index) => {
        if (doc.y > bottom()) {
            doc.addPage();
            drawHeader();
        }
        drawRow(columns.map((c) => row[c.key]), { fill: index % 2 ? '#f9f6ef' : undefined });
    });

    if (!rows.length) doc.fillColor('#6b7a80').text('Sin resultados.', left, doc.y + 6);
    doc.end();
};

// "2026-09-28" -> "28-09-2026"
const formatDay = (day) => (day ? day.split('-').reverse().join('-') : '');

module.exports = { sendTablePdf, formatDay };
