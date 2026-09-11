import re

with open('src/hooks/useSessionLock.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("import { supabase } from '../lib/supabase';", "import { userService } from '../services/api/userService';")

s1 = '''const { error } = await supabase
                .from('user_profiles')
                .update({
                    session_token: newToken,
                    session_device_id: deviceId
                })
                .eq('id', userId);'''
c = c.replace(s1, "const { error } = await userService.updateSessionLock(userId, newToken, deviceId);")

s2 = '''const { data, error } = await supabase
                .from('user_profiles')
                .select('session_token')
                .eq('id', userId)
                .single();'''
c = c.replace(s2, "const { data, error } = await userService.fetchSessionToken(userId);")

s3 = '''await supabase
                .from('user_profiles')
                .update({ session_token: null, session_device_id: null })
                .eq('id', userId);'''
c = c.replace(s3, "await userService.clearSession(userId);")

with open('src/hooks/useSessionLock.js', 'w', encoding='utf-8') as f:
    f.write(c)
