import re

with open('src/hooks/useUserProfile.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("import { supabase } from '../lib/supabase';", "import { authService } from '../services/api/authService';\nimport { userService } from '../services/api/userService';")

c = c.replace("await supabase.auth.getUser()", "await authService.getUser()")

s1 = '''const { data, error } = await supabase
                .from('user_profiles')
                .select('*, companies(name), vessels(name)')
                .eq('id', user.id)
                .single();'''
c = c.replace(s1, "const { data, error } = await userService.fetchUserProfile(user.id);")

c = c.replace("await supabase.from('user_profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', profile.id);", "await userService.updateLastSeen(profile.id);")

c = c.replace("await supabase.from('user_profiles').update(mapped).eq('id', profile.id);", "await userService.updateUserProfile(profile.id, mapped);")

with open('src/hooks/useUserProfile.js', 'w', encoding='utf-8') as f:
    f.write(c)
