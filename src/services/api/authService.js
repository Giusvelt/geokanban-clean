import { supabase } from '../../lib/supabase';

export const authService = {
    signIn: async ({ email, password }) => {
        return await supabase.auth.signInWithPassword({ email, password });
    },
    signOut: async () => {
        return await supabase.auth.signOut();
    },
    getUser: async () => {
        return await supabase.auth.getUser();
    },
    getSession: async () => {
        return await supabase.auth.getSession();
    },
    onAuthStateChange: (callback) => {
        return supabase.auth.onAuthStateChange(callback);
    },
    mfa: {
        listFactors: async () => supabase.auth.mfa.listFactors(),
        enroll: async (params) => supabase.auth.mfa.enroll(params),
        challenge: async (params) => supabase.auth.mfa.challenge(params),
        verify: async (params) => supabase.auth.mfa.verify(params)
    },
    getProfile: async (userId) => {
        return await supabase.from('user_profiles').select('*').eq('id', userId).single();
    }
};
