# SQLite Workflow - Full Matchup Rankings

Kompletny workflow generowania pełnych rankingów w formacie SQLite dla iOS.

## 🎯 Dlaczego SQLite?

| Format | Rozmiar | RAM Usage | iOS Performance |
|--------|---------|-----------|-----------------|
| **JSON** | 104 MB | 💀 104 MB | Crash/OOM |
| **SQLite** | 20 MB | ✅ ~0 MB | Perfect! |
| **SQLite.gz** | **8 MB** | ✅ ~0 MB | **Best!** ⭐ |

SQLite pozwala na:
- ✅ **Zero RAM** - query on-demand bez ładowania całości
- ✅ **Szybkie queries** - indexed, < 1ms
- ✅ **Małe pliki** - 13x mniejsze niż JSON
- ✅ **Perfect dla team building** - JOINy, agregacje

---

## 📋 Kompletny Workflow

### 1️⃣ Generuj rankingi (w przeglądarce)

```bash
# Uruchom serwer
cd /Users/pawelsikora/pvpoke
./START_SERVER.sh

# Otwórz w przeglądarce
open http://localhost:8000/rankerfull.php
```

1. Wybierz cup (np. "Aurora Cup")
2. Kliknij "Simulate Full Rankings"
3. Poczekaj 1-3 minuty
4. Plik pobierze się do `~/Downloads/aurora-full-rankings-1500.json`

### 2️⃣ Przetwórz do SQLite

```bash
cd /Users/pawelsikora/pvpoke

./PROCESS_RANKINGS.sh ~/Downloads/aurora-full-rankings-1500.json
```

**Output:**
```
🔄 Full Matchup Rankings Processor
==================================

📥 Input file: /Users/pawelsikora/Downloads/aurora-full-rankings-1500.json
🏆 Cup: aurora
💪 CP: 1500

1️⃣  Moving JSON...
   ✅ src/data/rankings/aurora/full/rankings-1500.json

2️⃣  Converting to SQLite...
📖 Loading JSON... ✅ Loaded 558 Pokemon
🗄️  Creating SQLite database... ✅
📋 Creating schema... ✅
🗺️  Building species map... ✅ 558 species
⚔️  Inserting matchups... ✅ 311,364 total
💾 Committing transaction... ✅
🗜️  Optimizing database... ✅

📊 Statistics:
   Pokemon: 558
   Matchups: 311,364
   JSON size: 27.7 MB
   DB size: 856 KB
   Compression: 96.9%

3️⃣  Compressing SQLite...
   ✅ src/data/rankings/aurora/full/rankings-1500.db.gz

📊 Results:
   JSON:       28M  (for debugging)
   SQLite:     856K  (uncompressed)
   SQLite.gz:  304K  (for deployment) ⭐
```

### 3️⃣ Commit & Deploy

```bash
# Dodaj pliki
git add src/data/rankings/aurora/full/

# Commit
git commit -m "Add full matchup rankings for Aurora Cup (1500 CP)

- JSON: 27.7 MB (for debugging)
- SQLite: 856 KB (optimized, 96.9% smaller)
- SQLite.gz: 304 KB (for iOS deployment)"

# Push
git push origin master
```

### 4️⃣ GitHub Actions deployment

Po push, GitHub Actions automatycznie:
1. Deploy pliki do GitHub Pages (~2 min)
2. Dostępne na: `https://sikora-pawel.github.io/pvpoke/rankings/aurora/full/`

### 5️⃣ Test w iOS

```swift
let url = URL(string: "https://sikora-pawel.github.io/pvpoke/rankings/aurora/full/rankings-1500.db.gz")!
let (gzData, _) = try await URLSession.shared.data(from: url)
// Downloads 304 KB instead of 27.7 MB! 🚀
```

---

## 📁 Struktura plików

Po przetworzeniu:

```
src/data/rankings/aurora/full/
├── rankings-1500.json       # 27.7 MB - dla debugowania
├── rankings-1500.db          # 856 KB - SQLite uncompressed
└── rankings-1500.db.gz       # 304 KB - dla iOS (deploy) ⭐
```

Na GitHub Pages dostępne:
- `https://.../aurora/full/rankings-1500.json` (opcjonalnie)
- `https://.../aurora/full/rankings-1500.db.gz` ⭐ (główny endpoint)

---

## 🗄️ Struktura bazy SQLite

```sql
-- Mapa Pokemon
CREATE TABLE species_map (
    id INTEGER PRIMARY KEY,
    species_id TEXT UNIQUE  -- "azumarill", "cradily_b", "ninetales_shadow"
);

-- Matchupy
CREATE TABLE matchups (
    pokemon_id INTEGER,
    opponent_id INTEGER,
    rating INTEGER,      -- 0-1000
    op_rating INTEGER,
    PRIMARY KEY (pokemon_id, opponent_id)
);

-- Indexes (automatycznie tworzone)
CREATE INDEX idx_pokemon_rating ON matchups(pokemon_id, rating DESC);
CREATE INDEX idx_opponent ON matchups(opponent_id, pokemon_id);
```

---

## 💡 Przykłady użycia w iOS

Zobacz pełną dokumentację: [IOS_SQLITE_GUIDE.md](IOS_SQLITE_GUIDE.md)

### Podstawowe query

```swift
// Znajdź matchup
let matchup = try db.getMatchup(pokemon: "azumarill", opponent: "registeel")
// rating: 245 (Azumarill przegrywa)

// Wszystkie matchupy
let allMatchups = try db.getAllMatchups(for: "azumarill")
// Returns 558 matchups (Aurora Cup)
```

### Team building

```swift
// Znajdź Pokemon który pokrywa słabości
let suggestions = try db.findBestThirdPokemon(
    team: ["azumarill", "registeel"],
    threats: metaThreats
)
// Returns Pokemon ranked by coverage
```

---

## 📊 Rozmiary dla różnych cupów

| Cup | Pokemon | JSON | SQLite | SQLite.gz |
|-----|---------|------|--------|-----------|
| **Great League** | 1088 | 104 MB | 20 MB | **8 MB** |
| **Aurora Cup** | 558 | 28 MB | 856 KB | **304 KB** |
| **Ascension Cup** | 35 | 4 MB | 25 KB | **8 KB** |
| **Ultra League** | 890 | 85 MB | 16 MB | **6.5 MB** |

---

## 🔧 Troubleshooting

### JSON nie generuje się

**Problem**: Console pokazuje błędy POST

**Rozwiązanie**: Już naprawione! PHP ma 256MB limit.

### PROCESS_RANKINGS.sh nie działa

**Problem**: `permission denied`

**Rozwiązanie**:
```bash
chmod +x PROCESS_RANKINGS.sh
```

### SQLite za duży (>100 MB)

**Problem**: GitHub limit

**Rozwiązanie**: Powinno być OK dla wszystkich cupów. Great League = 20 MB < 100 MB.

---

## 🎯 Best Practices

### 1. Commituj tylko .db.gz

```bash
# Opcjonalnie dodaj do .gitignore:
src/data/rankings/*/full/*.json
src/data/rankings/*/full/*.db

# Commituj tylko compressed:
git add src/data/rankings/*/full/*.db.gz
```

### 2. Generuj tylko potrzebne cupy

Nie musisz generować dla każdego cupu - tylko dla:
- Main leagues (Great, Ultra, Master)
- Aktywne specialty cupy

### 3. Update gdy potrzeba

Aktualizuj rankingi gdy:
- Nowe Pokemon
- Move rebalancing
- Nowy cup/season

---

## 📚 Dokumentacja

- **Ten guide**: Workflow generowania
- **[IOS_SQLITE_GUIDE.md](IOS_SQLITE_GUIDE.md)**: Jak używać w iOS
- **[FULL_MATCHUPS.md](FULL_MATCHUPS.md)**: Techniczna dokumentacja
- **[FULL_MATCHUPS_QUICKSTART.md](FULL_MATCHUPS_QUICKSTART.md)**: Quick start

---

**Gotowe!** 🎉 Teraz masz kompletny system do generowania i używania pełnych rankingów w iOS! 🚀

