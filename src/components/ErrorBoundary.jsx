import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("GeoKanban Error Captured:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 min-h-[400px] bg-slate-950/50 backdrop-blur-xl rounded-[3rem] border border-red-500/20 m-6 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-manrope font-black text-white uppercase tracking-tighter italic">System Interruption</h2>
          <p className="text-sm font-bold text-white/40 mt-2 max-w-md uppercase tracking-widest leading-relaxed">
            Un errore nel rendering ha bloccato questo componente. La stabilità del resto dell'app è garantita.
          </p>
          <div className="mt-8 p-4 bg-black/40 rounded-2xl border border-white/5 font-mono text-[10px] text-red-400/60 max-w-lg overflow-hidden">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-10 flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white/60 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <RefreshCw size={14} /> Re-initialize App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
