# iOS SQLite Integration Guide

Jak używać full matchup rankings w formacie SQLite w aplikacji pogo_teambuilder.

## 📦 Struktura bazy danych

```sql
-- Mapa Pokemon (species_id → numeric ID)
CREATE TABLE species_map (
    id INTEGER PRIMARY KEY,
    species_id TEXT NOT NULL UNIQUE  -- "azumarill", "cradily_b", "ninetales_shadow"
);

-- Matchupy (wszystkie pojedynki)
CREATE TABLE matchups (
    pokemon_id INTEGER NOT NULL,
    opponent_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,      -- 0-1000 (500 = tie)
    op_rating INTEGER NOT NULL,   -- Opponent's rating
    PRIMARY KEY (pokemon_id, opponent_id)
);
```

---

## 🚀 Setup w iOS

### Opcja 1: SQLite.swift (zalecane)

```swift
import SQLite

// 1. Dodaj dependency
// Package: https://github.com/stephencelis/SQLite.swift
```

**Package.swift:**
```swift
dependencies: [
    .package(url: "https://github.com/stephencelis/SQLite.swift", from: "0.15.0")
]
```

### Opcja 2: Native SQLite3 (wbudowane w iOS)

```swift
import SQLite3
// Już dostępne, nie trzeba dodawać dependency!
```

---

## 📥 Download & Setup

### 1. Pobierz bazę danych

```swift
func downloadRankingsDatabase(cup: String, cp: Int) async throws -> URL {
    let urlString = "https://sikora-pawel.github.io/pvpoke/rankings/\(cup)/full/rankings-\(cp).db.gz"
    let url = URL(string: urlString)!
    
    // Download .gz file
    let (gzData, _) = try await URLSession.shared.data(from: url)
    
    // Decompress
    let dbData = try (gzData as NSData).decompressed(using: .zlib) as Data
    
    // Save to app storage
    let dbURL = FileManager.default
        .urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("rankings-\(cup)-\(cp).db")
    
    try dbData.write(to: dbURL)
    
    return dbURL
}
```

### 2. Inicjalizacja

```swift
class MatchupDatabase {
    private var db: Connection!
    
    // Tables
    private let speciesMap = Table("species_map")
    private let matchups = Table("matchups")
    
    // Columns
    private let id = Expression<Int64>("id")
    private let speciesId = Expression<String>("species_id")
    private let pokemonId = Expression<Int64>("pokemon_id")
    private let opponentId = Expression<Int64>("opponent_id")
    private let rating = Expression<Int64>("rating")
    private let opRating = Expression<Int64>("op_rating")
    
    init(dbURL: URL) throws {
        db = try Connection(dbURL.path)
    }
}
```

---

## 🎯 Podstawowe Queries

### Znajdź matchup dla konkretnej pary

```swift
func getMatchup(pokemon: String, opponent: String) throws -> Matchup? {
    let query = """
        SELECT m.rating, m.op_rating
        FROM matchups m
        JOIN species_map p ON m.pokemon_id = p.id
        JOIN species_map o ON m.opponent_id = o.id
        WHERE p.species_id = ? AND o.species_id = ?
    """
    
    let stmt = try db.prepare(query, pokemon, opponent)
    
    guard let row = stmt.first(where: { _ in true }) else {
        return nil
    }
    
    return Matchup(
        pokemon: pokemon,
        opponent: opponent,
        rating: row[0] as! Int64,
        opRating: row[1] as! Int64
    )
}

// Usage:
let matchup = try getMatchup(pokemon: "azumarill", opponent: "registeel")
// rating: 245, opRating: 754 → Azumarill loses badly
```

### Znajdź wszystkie matchupy dla Pokemon

```swift
func getAllMatchups(for pokemon: String) throws -> [Matchup] {
    let query = """
        SELECT o.species_id, m.rating, m.op_rating
        FROM matchups m
        JOIN species_map p ON m.pokemon_id = p.id
        JOIN species_map o ON m.opponent_id = o.id
        WHERE p.species_id = ?
        ORDER BY m.rating DESC
    """
    
    let stmt = try db.prepare(query, pokemon)
    
    return stmt.map { row in
        Matchup(
            pokemon: pokemon,
            opponent: row[0] as! String,
            rating: row[1] as! Int64,
            opRating: row[2] as! Int64
        )
    }
}

// Usage:
let matchups = try getAllMatchups(for: "azumarill")
// Returns all 1088 matchups for Azumarill in Great League
```

### Znajdź counters (rating < 500)

```swift
func getCounters(for pokemon: String, limit: Int = 10) throws -> [Counter] {
    let query = """
        SELECT o.species_id, m.rating
        FROM matchups m
        JOIN species_map p ON m.pokemon_id = p.id
        JOIN species_map o ON m.opponent_id = o.id
        WHERE p.species_id = ? AND m.rating < 500
        ORDER BY m.rating ASC
        LIMIT ?
    """
    
    let stmt = try db.prepare(query, pokemon, limit)
    
    return stmt.map { row in
        Counter(
            opponent: row[0] as! String,
            rating: row[1] as! Int64
        )
    }
}
```

### Znajdź wins (rating > 500)

```swift
func getWins(for pokemon: String, minRating: Int = 500) throws -> [String] {
    let query = """
        SELECT o.species_id
        FROM matchups m
        JOIN species_map p ON m.pokemon_id = p.id
        JOIN species_map o ON m.opponent_id = o.id
        WHERE p.species_id = ? AND m.rating > ?
        ORDER BY m.rating DESC
    """
    
    let stmt = try db.prepare(query, pokemon, minRating)
    
    return stmt.map { $0[0] as! String }
}
```

---

## 🔥 Advanced: Team Coverage Analysis

### Znajdź Pokemon który pokrywa słabości zespołu

```swift
func findBestThirdPokemon(
    team: [String],  // ["azumarill", "registeel"]
    threats: [String]  // Known meta threats
) throws -> [TeammateSuggestion] {
    
    // Build threat list
    let threatList = threats.map { "'\($0)'" }.joined(separator: ",")
    
    let query = """
        SELECT 
            p.species_id,
            AVG(m.rating) as avg_coverage,
            COUNT(CASE WHEN m.rating > 600 THEN 1 END) as strong_wins,
            COUNT(CASE WHEN m.rating < 400 THEN 1 END) as bad_losses
        FROM species_map p
        JOIN matchups m ON m.pokemon_id = p.id
        JOIN species_map t ON m.opponent_id = t.id
        WHERE t.species_id IN (\(threatList))
          AND p.species_id NOT IN (\(team.map { "'\($0)'" }.joined(separator: ",")))
        GROUP BY p.id
        HAVING avg_coverage > 550
        ORDER BY avg_coverage DESC, bad_losses ASC
        LIMIT 20
    """
    
    let stmt = try db.prepare(query)
    
    return stmt.map { row in
        TeammateSuggestion(
            pokemon: row[0] as! String,
            avgCoverage: row[1] as! Double,
            strongWins: row[2] as! Int64,
            badLosses: row[3] as! Int64
        )
    }
}
```

### Analyze team synergy

```swift
func analyzeTeamSynergy(team: [String]) throws -> TeamAnalysis {
    var coverage: [String: [Int]] = [:]  // threat → [ratings from each team member]
    
    // Get all Pokemon in meta
    let allPokemon = try getAllSpecies()
    
    for threat in allPokemon {
        var ratings: [Int] = []
        
        for teamMember in team {
            if let matchup = try getMatchup(pokemon: teamMember, opponent: threat) {
                ratings.append(Int(matchup.rating))
            }
        }
        
        coverage[threat] = ratings
    }
    
    // Find threats where ALL team members lose
    let commonWeaknesses = coverage.filter { threat, ratings in
        ratings.allSatisfy { $0 < 500 }
    }
    
    // Find threats where at least one team member wins solidly
    let coveredThreats = coverage.filter { threat, ratings in
        ratings.contains(where: { $0 > 600 })
    }
    
    return TeamAnalysis(
        commonWeaknesses: Array(commonWeaknesses.keys),
        coveredThreats: Array(coveredThreats.keys),
        coveragePercentage: Double(coveredThreats.count) / Double(allPokemon.count)
    )
}
```

---

## 💾 Caching & Performance

### Cache species map w pamięci

```swift
class MatchupDatabase {
    private var speciesCache: [String: Int64] = [:]
    
    init(dbURL: URL) throws {
        db = try Connection(dbURL.path)
        try loadSpeciesCache()
    }
    
    private func loadSpeciesCache() throws {
        let query = "SELECT species_id, id FROM species_map"
        let stmt = try db.prepare(query)
        
        for row in stmt {
            speciesCache[row[0] as! String] = row[1] as! Int64
        }
        
        print("✅ Loaded \(speciesCache.count) species into cache")
    }
    
    // Szybsze query bez JOIN
    func getMatchupFast(pokemonId: Int64, opponentId: Int64) throws -> (Int, Int)? {
        let query = "SELECT rating, op_rating FROM matchups WHERE pokemon_id = ? AND opponent_id = ?"
        let stmt = try db.prepare(query, pokemonId, opponentId)
        
        guard let row = stmt.first(where: { _ in true }) else {
            return nil
        }
        
        return (row[0] as! Int, row[1] as! Int)
    }
}
```

---

## 📊 Model Definitions

```swift
struct Matchup {
    let pokemon: String
    let opponent: String
    let rating: Int      // 0-1000
    let opRating: Int    // 0-1000
    
    var isPokemonWin: Bool { rating > 500 }
    var isOpponentWin: Bool { opRating > 500 }
    
    var winMargin: Int { rating - 500 }
}

struct Counter {
    let opponent: String
    let rating: Int
}

struct TeammateSuggestion {
    let pokemon: String
    let avgCoverage: Double
    let strongWins: Int
    let badLosses: Int
}

struct TeamAnalysis {
    let commonWeaknesses: [String]
    let coveredThreats: [String]
    let coveragePercentage: Double
}
```

---

## 🎯 Tips & Best Practices

### 1. Lazy Loading
```swift
// Nie ładuj całej bazy do pamięci!
// SQLite automatycznie cache'uje często używane dane
```

### 2. Batch Queries
```swift
// Zamiast 1000 pojedynczych queries:
for pokemon in team {
    let matchups = try getAllMatchups(for: pokemon)  // ❌ Wolne
}

// Użyj jednego query:
let allMatchups = try getMatchupsForTeam(team)  // ✅ Szybkie
```

### 3. Indexes są już utworzone
```sql
-- Te indexy już istnieją w bazie:
CREATE INDEX idx_pokemon_rating ON matchups(pokemon_id, rating DESC);
CREATE INDEX idx_opponent ON matchups(opponent_id, pokemon_id);
```

### 4. File Management
```swift
// Trzymaj DB w Documents (persistent)
let dbURL = FileManager.default
    .urls(for: .documentDirectory, in: .userDomainMask)[0]
    .appendingPathComponent("rankings-\(cup)-\(cp).db")

// Nie w Cache (może być usunięty przez system)
```

---

## 🔗 Resources

- **SQLite.swift**: https://github.com/stephencelis/SQLite.swift
- **SQLite Documentation**: https://www.sqlite.org/docs.html
- **pvpoke Full Matchups**: https://sikora-pawel.github.io/pvpoke/rankings/

---

## ❓ FAQ

**Q: Jak często aktualizować bazę?**  
A: Gdy pvpoke zaktualizuje dane (nowe Pokemon, move changes). Check raz w miesiącu.

**Q: Czy mogę mieć wiele baz (różne cupy)?**  
A: Tak! Każdy cup ma osobną bazę: `rankings-aurora-1500.db`, `rankings-all-1500.db`

**Q: Jak duża jest baza?**  
A: Great League: ~8 MB (.gz), ~20 MB (rozpakowany). Specialty cupy: 0.3-1 MB (.gz)

**Q: Czy SQLite jest thread-safe?**  
A: Tak, ale używaj jednej Connection per thread lub serial queue.

---

**Gotowe do implementacji!** 🚀

