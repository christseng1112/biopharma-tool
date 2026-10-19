import { useState, useEffect } from 'react';

/**
 * Editable quantity for an existing assignment. Previously a wrong quantity
 * could only be fixed by deleting the row and adding it again.
 *
 * The field keeps its own text while it is being typed in, so it can be
 * cleared on the way to a new number, but only a positive integer is ever
 * committed (same rule as the Add form). Anything else is flagged and, on
 * blur, replaced by the last committed value.
 */
export const QtyCell = ({ value, onCommit }) => {
    const [text, setText] = useState(String(value));
    useEffect(() => { setText(String(value)); }, [value]);

    const parsed = Number(text);
    const isValid = text.trim() !== "" && Number.isInteger(parsed) && parsed > 0;

    const handleChange = (e) => {
        const next = e.target.value;
        setText(next);
        const n = Number(next);
        if (next.trim() !== "" && Number.isInteger(n) && n > 0 && n !== value) onCommit(n);
    };

    return (
        <input
            type="number" min="1" step="1" aria-label="Qty"
            className={`w-20 border p-1 rounded ${isValid ? '' : 'border-red-400 bg-red-50'}`}
            title={isValid ? '' : '請輸入大於 0 的整數'}
            value={text}
            onChange={handleChange}
            onBlur={() => { if (!isValid) setText(String(value)); }}
        />
    );
};

export default QtyCell;
