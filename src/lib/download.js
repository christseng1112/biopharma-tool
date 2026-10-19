import { CSS_STRING } from './reports.js';

const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/** A report fragment as a standalone document, styled the same downloaded or printed. */
const wrapReportHtml = (content) =>
    `<!DOCTYPE html><html><head><meta charset="UTF-8">${CSS_STRING}</head><body>${content}</body></html>`;

export function downloadHtml(content, filename) {
    triggerDownload(new Blob([wrapReportHtml(content)], { type: 'text/html' }), filename);
}

/**
 * Print a report on its own, without the app's sidebar and tabs around it.
 *
 * Uses a hidden srcdoc iframe rather than a new window: it needs no popup
 * permission, works from file://, and makes no request of any kind. The
 * iframe is removed once the print dialog closes.
 */
export function printHtml(content) {
    const frame = document.createElement('iframe');
    frame.setAttribute('data-print-frame', '');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.onload = () => {
        const win = frame.contentWindow;
        if (!win) { frame.remove(); return; }
        win.addEventListener('afterprint', () => frame.remove());
        win.focus();
        win.print();
    };
    frame.srcdoc = wrapReportHtml(content);
    document.body.appendChild(frame);
}

export function downloadJson(data, filename) {
    triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}
