import { create } from 'zustand';

export const useUIStore = create((set) => ({
    is3DActive: false,
    focusCoords: null, // { lat, lon }
    
    set3DActive: (active) => set({ is3DActive: active }),
    setFocusCoords: (coords) => set({ focusCoords: coords }),
    
    toggle3D: () => set((state) => ({ is3DActive: !state.is3DActive })),
    
    close3D: () => set({ is3DActive: false, focusCoords: null })
}));
