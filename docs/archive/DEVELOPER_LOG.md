# 📓 DEVELOPER LOG: Errori & Apprendimenti

Documentazione degli errori tecnici riscontrati per evitarne la ripetizione.

## ⚠️ Errori Critici (Never Again)

### 1. Regressione Geofencing (Radius vs Polygon)
- **Data**: 23 Mar 2026
- **Errore**: La migrazione `013` ha riportato il trigger DB all'uso di `ST_DWithin` (radius), ignorando i poligoni (`polygon_coords`) già pronti nelle Edge Functions.
- **Conseguenza**: Perdita di precisione e perdita di fiducia dell'utente.
- **Soluzione**: Implementare SEMPRE controlli poligonali in PostGIS.

### 2. Duplicazione Workflow
- **Errore**: Creazione di cartelle `.agent` e `.agents` simultanee.
- **Soluzione**: Usare esclusivamente `.agent/workflows/`.

## 💡 Apprendimenti Tecnici
- **Supabase Edge Functions**: Usano l'algoritmo Ray Casting in JS per i poligoni.
- **PostGIS**: Preferito per i trigger DB per performance ed efficienza.
- **Context Limit**: Quando la chat diventa troppo lunga, il riepilogo in `MISSION_CONTROL.md` è l'unico modo per non perdere l'obiettivo.
