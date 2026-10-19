import { downloadHtml, printHtml } from '../lib/download.js';

/**
 * A generated report with its Print and Download buttons.
 *
 * `render` is called for the preview and again on each click, so a printed or
 * downloaded copy carries its own generation time rather than the preview's.
 * `disabled` covers reports whose source is still being recalculated: the
 * buttons must not hand out a copy that disagrees with the screen.
 */
export const ReportPanel = ({ render, filename, disabled = false, labelSuffix = '' }) => {
    const btn = 'st-btn disabled:opacity-40 disabled:cursor-not-allowed';
    return (
        <div>
            <div dangerouslySetInnerHTML={{ __html: render() }} />
            <div className="mt-4 text-right">
                <button className={`${btn} mr-2`} disabled={disabled} onClick={() => { if (!disabled) printHtml(render()); }}>
                    🖨️ Print{labelSuffix}
                </button>
                <button className={btn} disabled={disabled} onClick={() => { if (!disabled) downloadHtml(render(), filename); }}>
                    📥 Download{labelSuffix}
                </button>
            </div>
        </div>
    );
};

export default ReportPanel;
