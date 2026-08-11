import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVesselStore } from '../useVesselStore';

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: vi.fn()
    }
}));

describe('useVesselStore', () => {
    beforeEach(() => {
        // Pulisce lo store prima di ogni test
        useVesselStore.setState({ vessels: [], vesselPositions: [], loading: false, error: null });
    });

    it('dovrebbe inizializzare le vessels come array vuoto', () => {
        const state = useVesselStore.getState();
        expect(state.vessels).toEqual([]);
        expect(state.loading).toBe(false);
    });

    it('dovrebbe aggiornare lo stato quando si fa setVessels', () => {
        const testVessels = [{ id: '1', name: 'Nave A' }, { id: '2', name: 'Nave B' }];
        
        // Esegui l'azione
        useVesselStore.getState().setVessels(testVessels);
        
        // Verifica
        const state = useVesselStore.getState();
        expect(state.vessels).toHaveLength(2);
        expect(state.vessels[0].name).toBe('Nave A');
    });
});
