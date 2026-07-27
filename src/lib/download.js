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

export function downloadHtml(content, filename) {
    const fullHtml = `<html><head><meta charset="UTF-8">${CSS_STRING}</head><body>${content}</body></html>`;
    triggerDownload(new Blob([fullHtml], { type: 'text/html' }), filename);
}

export function downloadJson(data, filename) {
    triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}
