import React, { useState } from 'react';
import { 
    Briefcase, Search, Plus, Edit2, Trash2, 
    Globe, MapPin, Building, Palette, Activity
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';

export default function ProjectRegistryTab() {
    const { projects, createProject, updateProject, deleteProject } = useProjectStore();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        customer_name: '',
        color_hex: '#10b981'
    });

    const filteredProjects = (projects || []).filter(p => 
        p.name?.toLowerCase().includes(search.toLowerCase()) || 
        p.customer_name?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editingProject) {
            await updateProject(editingProject.id, formData);
        } else {
            await createProject({ ...formData, is_active: true });
        }
        setIsModalOpen(false);
        setEditingProject(null);
        setFormData({ name: '', location: '', customer_name: '', color_hex: '#10b981' });
    };

    const handleEdit = (project) => {
        setEditingProject(project);
        setFormData({
            name: project.name,
            location: project.location,
            customer_name: project.customer_name,
            color_hex: project.color_hex
        });
        setIsModalOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]/50 p-8 space-y-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-accent/10 rounded-3xl">
                        <Briefcase className="text-accent" size={32} />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-white uppercase tracking-tighter">Project Registry</h1>
                        <p className="text-white/40 text-sm font-bold uppercase tracking-widest mt-1">Master configuration and industrial site metadata</p>
                    </div>
                </div>

                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-3 bg-accent hover:bg-accent-light text-black px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-accent/20 active:scale-95 uppercase"
                >
                    <Plus size={20} />
                    New Project
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-6">
                <StatCard icon={Activity} label="Active Sites" value={projects?.length || 0} color="accent" />
                <StatCard icon={Globe} label="Locations" value={new Set(projects?.map(p => p.location)).size || 0} color="emerald" />
                <StatCard icon={Building} label="Customers" value={new Set(projects?.map(p => p.customer_name)).size || 0} color="blue" />
                <StatCard icon={Palette} label="Aesthetics" value="Synced" color="purple" />
            </div>

            {/* Search & Table */}
            <div className="bg-white/[0.03] border border-white/10 rounded-[32px] overflow-hidden backdrop-blur-3xl shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search projects or customers..."
                            className="w-full bg-[#111] border border-white/5 rounded-2xl pl-14 pr-6 py-4 text-sm font-bold text-white placeholder:text-white/20 outline-none focus:ring-2 ring-accent/20 transition-all uppercase tracking-tight"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.01]">
                                <th className="px-8 py-6 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Project Name</th>
                                <th className="px-8 py-6 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Location</th>
                                <th className="px-8 py-6 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Customer</th>
                                <th className="px-8 py-6 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Visual ID</th>
                                <th className="px-8 py-6 text-right text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProjects.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center text-white/20 font-bold uppercase tracking-widest">
                                        No projects found in the registry
                                    </td>
                                </tr>
                            ) : filteredProjects.map(project => (
                                <tr key={project.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ backgroundColor: project.color_hex }} />
                                            <span className="font-black text-white uppercase tracking-tight text-base">{project.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-white/60 font-bold text-sm">
                                            <MapPin size={14} className="text-accent/50" />
                                            {project.location}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                                            {project.customer_name}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex gap-1.5">
                                            {[1,2,3,4].map(i => (
                                                <div key={i} className="w-4 h-1 rounded-full opacity-20" style={{ backgroundColor: project.color_hex }} />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleEdit(project)}
                                                className="p-2.5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => deleteProject(project.id)}
                                                className="p-2.5 hover:bg-red-500/10 rounded-xl text-white/40 hover:text-red-500 transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-2xl bg-black/60">
                    <div className="bg-[#111] border border-white/10 w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                                    {editingProject ? 'Edit Project' : 'New Project'}
                                </h2>
                                <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Registry Configuration</p>
                            </div>
                            <div className="p-3 bg-accent/10 rounded-2xl">
                                <Briefcase className="text-accent" size={24} />
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-10 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <ModalInputField 
                                    label="Project Name"
                                    value={formData.name}
                                    onChange={v => setFormData({...formData, name: v})}
                                    placeholder="e.g. Diga Genova"
                                    icon={Building}
                                />
                                <ModalInputField 
                                    label="Customer Name"
                                    value={formData.customer_name}
                                    onChange={v => setFormData({...formData, customer_name: v})}
                                    placeholder="e.g. Autorità Portuale"
                                    icon={Briefcase}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <ModalInputField 
                                    label="Location"
                                    value={formData.location}
                                    onChange={v => setFormData({...formData, location: v})}
                                    placeholder="e.g. Genova, IT"
                                    icon={MapPin}
                                />
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Site Color Identifier</label>
                                    <div className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl px-6 py-4">
                                        <input 
                                            type="color" 
                                            value={formData.color_hex}
                                            onChange={e => setFormData({...formData, color_hex: e.target.value})}
                                            className="w-8 h-8 rounded-full border-none bg-transparent cursor-pointer"
                                        />
                                        <span className="text-sm font-mono font-black text-white/60 tracking-wider">
                                            {formData.color_hex.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white py-5 rounded-2xl font-black text-sm transition-all uppercase"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-[2] bg-accent hover:bg-accent-light text-black py-5 rounded-2xl font-black text-sm transition-all shadow-xl shadow-accent/20 uppercase"
                                >
                                    {editingProject ? 'Save Changes' : 'Register Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const StatCard = ({ icon: Icon, label, value, color }) => {
    const colors = {
        accent: 'bg-accent/10 text-accent border-accent/20',
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    };

    return (
        <div className={`p-6 bg-white/[0.03] border border-white/10 rounded-[28px] space-y-4 backdrop-blur-md`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[color]} border shadow-inner`}>
                <Icon size={24} />
            </div>
            <div>
                <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{label}</div>
                <div className="text-3xl font-black text-white mt-1 uppercase tracking-tight">{value}</div>
            </div>
        </div>
    );
}

const ModalInputField = ({ label, value, onChange, icon: Icon, placeholder }) => (
    <div className="flex flex-col">
        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 px-1">{label}</label>
        <div className="relative flex items-center">
            {Icon && <Icon size={16} className="absolute left-6 text-accent/40" />}
            <input 
                type="text" 
                className={`w-full bg-white/5 border border-white/5 rounded-2xl ${Icon ? 'pl-14' : 'px-6'} py-4 text-sm font-black text-white placeholder:text-white/10 outline-none focus:ring-2 ring-accent/20 transition-all shadow-inner uppercase tracking-tight`}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    </div>
);
