import { supabase } from '../../lib/supabase';

export const pubsubService = {
    subscribeToTable(channelName, table, callback) {
        return supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
            .subscribe();
    },
    subscribeGlobal(channelName, filter, callback) {
        return supabase
            .channel(channelName)
            .on('postgres_changes', filter, callback)
            .subscribe();
    },
    unsubscribe(channel) {
        if (channel) supabase.removeChannel(channel);
    }
};
