import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useProjectStore = create((set, get) => ({
    projects: [],
    currentProject: null,
    loading: false,
    error: null,

    fetchProjects: async (userId, role) => {
        set({ loading: true });
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, location, customer_name, color_hex, is_active')
                .eq('is_active', true);

            if (error) throw error;
            
            // --- SINGLE PROJECT ENFORCEMENT ---
            // Forziamo Genova come unico cantiere operativo
            const genovaDefault = {
                id: 'diga-genova-default',
                name: 'DIGA FORANEA GENOVA',
                location: 'GENOVA, IT',
                color_hex: '#10b981',
                is_active: true
            };

            const projects = data?.length > 0 ? data : [genovaDefault];
            const currentProject = projects.find(p => p.name.includes('GENOVA')) || projects[0];

            set({ projects, currentProject });
            return projects;
        } catch (err) {
            set({ error: err.message });
        } finally {
            set({ loading: false });
        }
    },

    setCurrentProject: async (project) => {
        set({ currentProject: project });
    },

    initCurrentProject: (projectId, projectsList) => {
        const list = projectsList || get().projects;
        const found = list.find(p => p.id === projectId);
        if (found) {
            set({ currentProject: found });
        } else if (list.length > 0) {
            set({ currentProject: list[0] });
        }
    },

    createProject: async (projectData) => {
        set({ loading: true, error: null });
        try {
            const { data, error } = await supabase
                .from('projects')
                .insert([projectData])
                .select();

            if (error) throw error;
            set(state => ({ projects: [...state.projects, data[0]] }));
            return { success: true, data: data[0] };
        } catch (err) {
            set({ error: err.message });
            return { success: false, error: err.message };
        } finally {
            set({ loading: false });
        }
    },

    updateProject: async (projectId, updates) => {
        set({ loading: true, error: null });
        try {
            const { data, error } = await supabase
                .from('projects')
                .update(updates)
                .eq('id', projectId)
                .select();

            if (error) throw error;
            set(state => ({
                projects: state.projects.map(p => p.id === projectId ? data[0] : p),
                currentProject: state.currentProject?.id === projectId ? data[0] : state.currentProject
            }));
            return { success: true, data: data[0] };
        } catch (err) {
            set({ error: err.message });
            return { success: false, error: err.message };
        } finally {
            set({ loading: false });
        }
    },

    deleteProject: async (projectId) => {
        set({ loading: true, error: null });
        try {
            const { error } = await supabase
                .from('projects')
                .update({ is_active: false })
                .eq('id', projectId);

            if (error) throw error;
            set(state => ({
                projects: state.projects.filter(p => p.id !== projectId),
                currentProject: state.currentProject?.id === projectId ? (state.projects.find(p => p.id !== projectId) || null) : state.currentProject
            }));
            return { success: true };
        } catch (err) {
            set({ error: err.message });
            return { success: false, error: err.message };
        } finally {
            set({ loading: false });
        }
    }
}));
