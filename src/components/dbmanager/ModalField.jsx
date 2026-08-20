/**
 * ModalField.jsx — Shared input field component for DBManager modals.
 * Supports text, number, color picker and any standard HTML input type.
 * Extracted from DBManager.jsx to enable per-tab modal file splitting.
 */

export const ModalField = ({ label, value, onChange, icon: Icon, type = "text" }) => {
    const isColor = type === "color";
    return (
        <div className="flex flex-col">
            <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest mb-2 px-1">{label}</label>
            <div className="relative flex items-center">
                {Icon && !isColor && <Icon size={16} className="absolute left-5 text-on-surface/20 pointer-events-none" />}
                {isColor ? (
                    <div className="flex items-center gap-4 w-full bg-surface-low/20 border-none rounded-2xl px-5 py-3">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                            <input
                                type="color"
                                className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer p-0 m-0 border-none appearance-none"
                                value={value || '#3b82f6'}
                                onChange={e => onChange(e.target.value)}
                            />
                        </div>
                        <input
                            type="text"
                            className="bg-transparent border-none text-sm font-extrabold text-on-surface uppercase outline-none w-full"
                            value={value || '#3b82f6'}
                            onChange={e => onChange(e.target.value)}
                        />
                    </div>
                ) : (
                    <input
                        type={type}
                        className={`w-full bg-surface-low/20 border-none rounded-2xl ${Icon ? 'pl-12' : 'px-5'} py-4 text-sm font-extrabold text-on-surface placeholder:text-on-surface/10 outline-none focus:ring-2 ring-primary/20 transition-all`}
                        value={value || ''}
                        onChange={e => onChange(e.target.value)}
                    />
                )}
            </div>
        </div>
    );
};

export const DatabaseIcon = (props) => (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>
    </svg>
);
