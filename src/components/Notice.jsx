import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Inline status line for the editors, replacing alert().
 *
 * alert() blocks the page, cannot be styled or read back later, and — as the
 * global handler comment notes — becomes unusable when errors repeat. A short
 * message next to the control that produced it is both less intrusive and still
 * on screen when the operator looks back at it.
 */
export const useNotice = (timeoutMs = 4000) => {
    const [notice, setNotice] = useState(null);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    const show = useCallback((message, tone = 'success') => {
        clearTimeout(timer.current);
        setNotice({ message, tone });
        if (timeoutMs > 0) timer.current = setTimeout(() => setNotice(null), timeoutMs);
    }, [timeoutMs]);

    return [notice, show];
};

const TONES = {
    success: 'bg-green-50 text-green-800 border-green-300',
    error: 'bg-red-50 text-red-800 border-red-300',
    info: 'bg-blue-50 text-blue-800 border-blue-300'
};

export const Notice = ({ notice }) => {
    if (!notice) return null;
    return (
        <div role="status" className={`text-sm px-3 py-2 rounded border mb-2 ${TONES[notice.tone] || TONES.info}`}>
            {notice.message}
        </div>
    );
};

export default Notice;
