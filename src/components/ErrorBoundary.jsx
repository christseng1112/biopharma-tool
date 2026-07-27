import { Component } from 'react';

/**
 * Catches render-time errors so a single bad record cannot leave the operator
 * staring at a blank page with no idea what happened. The global handler in
 * lib/globalErrorHandler.js covers everything outside React's tree; this covers
 * everything inside it.
 */
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Render error:', error, info?.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="p-8 max-w-3xl mx-auto text-gray-800">
                <h1 className="text-2xl font-bold text-red-700 mb-2">⚠️ 畫面渲染失敗 (Render error)</h1>
                <p className="mb-4 text-sm">
                    工具遇到未預期的錯誤而無法顯示。您的資料仍保存在瀏覽器的自動存檔中，尚未遺失。
                </p>
                <pre className="bg-red-50 border border-red-200 rounded p-3 text-xs whitespace-pre-wrap break-words mb-4">
                    {String(this.state.error?.stack || this.state.error)}
                </pre>
                <div className="flex gap-2 flex-wrap">
                    <button className="st-btn" onClick={() => this.setState({ error: null })}>重試 (Retry)</button>
                    <button className="st-btn" onClick={() => window.location.reload()}>重新載入 (Reload)</button>
                </div>
                <p className="mt-4 text-xs text-gray-500">
                    若重新載入後仍然失敗，可能是自動存檔的資料有問題。
                    請先用 Export 備份，再於 Sidebar 使用 Reset Defaults 還原預設值。
                </p>
            </div>
        );
    }
}

export default ErrorBoundary;
