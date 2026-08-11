import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle, Database, FileText, MessageSquare, Download, BarChart2 } from 'lucide-react';
import { askDigitalTwinCopilot, fetchCopilotChatHistory, saveCopilotChatMessage, clearCopilotChatHistory } from '../services/api/copilotService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { useData } from '../context/DataContext';

export default function DigitalTwinCopilotTab() {
  const { vessels, user } = useData();
  const username = user?.username || user?.email || 'guest';
  const tenantId = user?.tenant_id || 'default';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [vesselFilter, setVesselFilter] = useState('All');
  
  const messagesEndRef = useRef(null);

  // Caricamento della cronologia chat isolata per l'utente all'avvio
  useEffect(() => {
    async function loadHistory() {
      const savedHistory = await fetchCopilotChatHistory(username, tenantId);
      if (savedHistory && savedHistory.length > 0) {
        setMessages(savedHistory.map(m => ({
          id: m.id,
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
          sources: m.sources || []
        })));
      } else {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: 'Ciao! Sono il Digital Twin Copilot di GeoKanban. Puoi interrogarmi su tutte le comunicazioni operative del cantiere, sui registri di bordo, sui dati di flotta e sull\'avanzamento dei lavori. Come posso assisterti oggi?',
            sources: []
          }
        ]);
      }
    }
    loadHistory();
  }, [username, tenantId]);

  const handleClearHistory = async () => {
    await clearCopilotChatHistory(username, tenantId);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Cronologia azzerata. Nuova conversazione avviata! Come posso assisterti?',
        sources: []
      }
    ]);
  };


  const suggestedQuestions = [
    "Quante tonnellate ha caricato Fabio Duò Z ieri?",
    "Quali navi hanno avuto ritardi per il vento a Scanno Diga?",
    "Cosa è stato detto nel gruppo Diga Team sul pescaggio di Maria Vittoria Z?",
    "Qual è il tonnellaggio totale scaricato a Pra questo mese?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e, customQuery = null) => {
    if (e) e.preventDefault();
    const query = customQuery || input;
    if (!query.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Salvataggio del messaggio utente nella cronologia isolata
    saveCopilotChatMessage(username, tenantId, 'user', query, []);

    try {
      const response = await askDigitalTwinCopilot(query, vesselFilter);
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources || []
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      // Salvataggio della risposta dell'assistente nella cronologia isolata
      saveCopilotChatMessage(username, tenantId, 'assistant', response.answer, response.sources || []);
    } catch (error) {
      console.error("Copilot Error:", error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Si è verificato un errore durante l'elaborazione della domanda. Riprova più tardi.",
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceIcon = (source) => {
    if (source.includes('KI:')) return <FileText size={12} className="text-blue-500" />;
    if (source.includes('WhatsApp')) return <MessageSquare size={12} className="text-green-500" />;
    if (source.includes('Live Activities')) return <Database size={12} className="text-orange-500" />;
    return <AlertCircle size={12} className="text-gray-500" />;
  };

  const MarkdownComponents = {
    table: ({ node, ...props }) => {
      const exportToExcel = () => {
        // Extract data from the table node
        const rows = [];
        node.children.forEach(theadOrTbody => {
          if (theadOrTbody.type === 'element' && (theadOrTbody.tagName === 'thead' || theadOrTbody.tagName === 'tbody')) {
            theadOrTbody.children.forEach(tr => {
              if (tr.type === 'element' && tr.tagName === 'tr') {
                const rowData = [];
                tr.children.forEach(tdOrTh => {
                  if (tdOrTh.type === 'element' && (tdOrTh.tagName === 'td' || tdOrTh.tagName === 'th')) {
                    // Get text content of the cell
                    const cellText = tdOrTh.children.map(c => c.value).join('');
                    rowData.push(cellText);
                  }
                });
                rows.push(rowData);
              }
            });
          }
        });
        
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Copilot_Data");
        XLSX.writeFile(workbook, "GeoKanban_Copilot_Export.xlsx");
      };

      return (
        <div className="my-4 overflow-hidden rounded-xl border border-surface-low/50 shadow-sm bg-white">
          <div className="flex justify-between items-center bg-surface-lowest px-3 py-2 border-b border-surface-low/50">
            <span className="text-xs font-bold text-on-surface/60">Dati Tabellari</span>
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
            >
              <Download size={12} />
              Esporta XLSX
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm" {...props} />
          </div>
        </div>
      );
    },
    th: ({ node, ...props }) => <th className="px-4 py-2 bg-surface-low/20 font-bold border-b border-surface-low/50" {...props} />,
    td: ({ node, ...props }) => <td className="px-4 py-2 border-b border-surface-low/20 last:border-b-0" {...props} />,
    code: ({ node, inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      
      if (!inline && match && match[1] === 'json') {
        try {
          const config = JSON.parse(codeString);
          if (config.type === 'chart') {
            const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
            
            const renderChart = () => {
              if (config.chartType === 'line') {
                return (
                  <LineChart data={config.data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey={config.xKey} angle={-45} textAnchor="end" height={60} tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Legend />
                    <Line type="monotone" dataKey={config.yKey} stroke="#8884d8" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                  </LineChart>
                );
              } else if (config.chartType === 'pie') {
                return (
                  <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <Pie data={config.data} cx="50%" cy="50%" labelLine={false} label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey={config.yKey}>
                      {config.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Legend />
                  </PieChart>
                );
              } else {
                // Default to bar chart
                return (
                  <BarChart data={config.data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey={config.xKey} angle={-45} textAnchor="end" height={60} tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Legend />
                    <Bar dataKey={config.yKey} fill="#0088FE" radius={[4, 4, 0, 0]} />
                  </BarChart>
                );
              }
            };

            return (
              <div className="my-4 overflow-hidden rounded-xl border border-surface-low/50 shadow-sm bg-white">
                <div className="flex items-center gap-2 bg-surface-lowest px-3 py-2 border-b border-surface-low/50">
                  <BarChart2 size={14} className="text-primary" />
                  <span className="text-xs font-bold text-on-surface/60">{config.title || 'Grafico Dati'}</span>
                </div>
                <div className="p-4 w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                  </ResponsiveContainer>
                </div>
              </div>
            );
          }
        } catch (e) {
          // If it fails to parse as our custom chart JSON, fall back to normal code block
        }
      }
      return <code className={`${className} bg-surface-low/30 px-1 py-0.5 rounded text-[13px] font-mono`} {...props}>{children}</code>;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[1200px] min-h-[600px] bg-white rounded-3xl shadow-sm border border-surface-low/30 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-surface-low/20 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Digital Twin Copilot</h2>
            <p className="text-xs font-semibold text-primary/60 uppercase tracking-wider">Assistente AI RAG Semantico</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={vesselFilter}
            onChange={(e) => setVesselFilter(e.target.value)}
            className="text-xs bg-surface-lowest border border-surface-low rounded-xl px-3 py-1.5 font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="All">Tutte le Navi</option>
            {vessels && vessels.map((v) => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
          
          <button
            onClick={handleClearHistory}
            className="text-xs bg-surface-lowest hover:bg-surface-low border border-surface-low rounded-xl px-3 py-1.5 font-bold text-on-surface/70 hover:text-on-surface transition-colors flex items-center gap-1.5"
            title="Azzera la cronologia chat per iniziare una nuova conversazione"
          >
            <Sparkles size={13} className="text-primary" />
            <span>Nuova Chat</span>
          </button>
        </div>
      </div>

      {/* Guida descrittiva sulle capacità del Copilot */}
      {messages.length === 1 && (
        <div className="p-4 sm:p-6 pb-0">
          <div className="p-4 sm:p-5 bg-gradient-to-br from-primary/5 via-surface-lowest to-primary/10 border border-primary/10 rounded-2xl">
            <h3 className="text-xs sm:text-sm font-extrabold text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
              <Sparkles size={16} /> Guida Operativa all'uso del Copilot AI
            </h3>
            <p className="text-xs sm:text-sm text-on-surface/80 leading-relaxed font-medium mb-3">
              Puoi rivolgere al Copilot quesiti tecnici ed operazionali riguardanti la flotta e le attività di cantiere:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-on-surface/70 font-semibold">
              <li className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-surface-low/30">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span><b>Tonnellaggi & Carichi:</b> Valori reali movimentati per nave o area.</span>
              </li>
              <li className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-surface-low/30">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span><b>Pescaggi AIS:</b> Immersione Inbound/Outbound (m) delle motonavi.</span>
              </li>
              <li className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-surface-low/30">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span><b>Stato Operativo:</b> Orari ATA/ATD, ritardi meteo o standby.</span>
              </li>
              <li className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-surface-low/30">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span><b>Servizi Nautici:</b> Piloti, ormeggiatori e rimorchiatori registrati.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Area Chat */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-surface-low">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-primary text-white shadow-md'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : msg.isError ? 'bg-red-50 text-red-600 border border-red-100 rounded-tl-none' : 'bg-surface-lowest border border-surface-low/30 text-on-surface rounded-tl-none shadow-sm'}`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm prose-p:leading-relaxed max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {msg.sources.map((src, i) => (
                        <div key={i} className="flex items-center gap-1 px-2 py-0.5 bg-surface-low/30 border border-surface-low/50 rounded-md text-[10px] font-bold text-on-surface/60">
                          {getSourceIcon(src)}
                          <span>{src.length > 30 ? src.substring(0, 30) + '...' : src}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-primary text-white shadow-md flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div className="px-5 py-4 bg-surface-lowest border border-surface-low/30 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-primary/80 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 sm:p-6 bg-surface-lowest border-t border-surface-low/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Chiedi qualcosa a GeoKanban..."
            className="flex-1 bg-white border border-surface-low/50 rounded-2xl px-5 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-1" />}
          </button>
        </form>
      </div>
    </div>
  );
}
