/**
 * Last-resort safety net for errors that escape React entirely — a throw in an
 * event handler, a rejected promise, a failure before the app mounts.
 *
 * The original version used alert(), which an error inside a render loop turns
 * into an unclosable stream of dialogs. This renders one banner and appends
 * subsequent errors to it, so the page stays usable and the details stay
 * readable (and copyable) for whoever has to diagnose it.
 */

const BANNER_ID = '__global_error_banner';

const banner = () => {
    let el = document.getElementById(BANNER_ID);
    if (el) return el.querySelector('[data-list]');

    el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#fef2f2;border-bottom:2px solid #dc2626;color:#7f1d1d;font:13px/1.5 sans-serif;padding:12px 16px;max-height:40vh;overflow:auto';

    const heading = document.createElement('strong');
    heading.textContent = '⚠️ 程式發生未預期的錯誤 (Unexpected error)';
    heading.style.cssText = 'display:block;margin-bottom:6px';

    const dismiss = document.createElement('button');
    dismiss.textContent = '✕';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.style.cssText = 'position:absolute;top:8px;right:12px;background:none;border:0;color:#7f1d1d;cursor:pointer;font-size:16px';
    dismiss.onclick = () => el.remove();

    const list = document.createElement('ul');
    list.setAttribute('data-list', '');
    list.style.cssText = 'margin:0;padding-left:18px;white-space:pre-wrap;word-break:break-word';

    el.append(heading, dismiss, list);
    document.body.appendChild(el);
    return list;
};

const report = (message) => {
    const list = banner();
    // Cap the list so a render loop cannot grow the DOM without bound.
    if (list.children.length >= 20) return;
    const li = document.createElement('li');
    li.textContent = message;
    list.appendChild(li);
};

export const installGlobalErrorHandler = () => {
    window.addEventListener('error', (event) => {
        const where = event.lineno ? ` (line ${event.lineno}:${event.colno})` : '';
        console.error('Global error:', event.error || event.message);
        report(`${event.message}${where}`);
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled rejection:', event.reason);
        report(`Unhandled promise rejection: ${event.reason}`);
    });
};
