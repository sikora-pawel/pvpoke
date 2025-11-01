# Quick Start: Generating Full Matchup Data

Szybki przewodnik krok po kroku do wygenerowania pełnych macierzy matchupów.

## Czego potrzebujesz?

- PHP 7.0+ zainstalowane lokalnie
- Sklonowane repo pvpoke
- 5-10 minut czasu (dla jednego cupu)

## Krok 1: Uruchom lokalny serwer

```bash
cd /Users/pawelsikora/pvpoke/src
php -S localhost:8000
```

Zostaw ten terminal otwarty!

## Krok 2: Otwórz rankerfull.php

W przeglądarce:
```
http://localhost:8000/rankerfull.php
```

Lub z terminala:
```bash
open http://localhost:8000/rankerfull.php
```

## Krok 3: Wybierz format

Na stronie zobaczysz dropdown:

1. **Format**: Wybierz cup (przykład: "Ascension Cup")
2. **CP Limit**: Zostaw domyślny lub wybierz (1500 dla Great League)

## Krok 4: Uruchom symulację

1. **Otwórz Developer Console** (F12 lub Cmd+Option+J)
2. **Kliknij przycisk**: "Simulate Full Rankings"
3. **Obserwuj console**: 
   - Zobaczysz logi z postępem
   - Dla Ascension Cup (~30-40 Pokemon): ~30 sekund
   - Dla Great League (~150 Pokemon): ~3-5 minut

## Krok 5: Sprawdź wynik

W console zobaczysz:
```
/ascension/full/rankings-1500.json (FULL MATCHUPS)
```

Sprawdź plik:
```bash
ls -lh /Users/pawelsikora/pvpoke/src/data/rankings/ascension/full/rankings-1500.json
```

Podejrzyj zawartość:
```bash
cd /Users/pawelsikora/pvpoke/src/data/rankings/ascension/full
cat rankings-1500.json | jq '.[0] | {speciesId, allMatches: (.allMatches | length)}'
```

Output powinien pokazać:
```json
{
  "speciesId": "ninetales",
  "allMatches": 35  // lub więcej - WSZYSTKIE matchupy!
}
```

## Krok 6: Commit i Push

```bash
cd /Users/pawelsikora/pvpoke

# Dodaj wygenerowane pliki
git add src/data/rankings/ascension/full/rankings-1500.json

# Commit
git commit -m "Add full matchup rankings for Ascension Cup (Great League)"

# Push
git push origin master
```

## Krok 7: Sprawdź GitHub Actions

1. Przejdź do: https://github.com/sikora-pawel/pvpoke/actions
2. Znajdź najnowszy workflow run
3. Poczekaj aż się zakończy (1-2 min)

## Krok 8: Test endpoint

Po zakończeniu deployment:

```bash
# Standard rankings (top 5 only)
curl -s "https://sikora-pawel.github.io/pvpoke/rankings/ascension/overall/rankings-1500.json" \
  | jq '.[0].matchups | length'
# Output: 5

# Full rankings (ALL matchups)
curl -s "https://sikora-pawel.github.io/pvpoke/rankings/ascension/full/rankings-1500.json" \
  | jq '.[0].allMatches | length'
# Output: 35+ (wszystkie Pokemon w cupie!)
```

## Które cupy wygenerować?

### Priorytet 1: Aktywne ligi

```bash
# Great League
Format: "Great League" → all
CP: 1500

# Ultra League  
Format: "Ultra League" → all
CP: 2500

# Master League
Format: "Master League" → all
CP: 10000
```

### Priorytet 2: Aktualne specialty cupy

Sprawdź https://pvpoke.com jakie cupy są aktywne i wygeneruj dla nich.

Przykład dla Ascension Cup:
```bash
Format: "Ascension Cup" → ascension
CP: 1500
```

### Priorytet 3: Popularne historical cupy

Jeśli masz miejsce i czas:
- Fantasy Cup
- Kingdom Cup
- Jungle Cup
- etc.

## Rozwiązywanie problemów

### "Directory not found" error

Stwórz katalog ręcznie:
```bash
mkdir -p /Users/pawelsikora/pvpoke/src/data/rankings/{cup_name}/full
```

Np. dla Great League:
```bash
mkdir -p /Users/pawelsikora/pvpoke/src/data/rankings/all/full
```

### Symulacja się nie kończy

1. Sprawdź console - czy są błędy?
2. Odśwież stronę i spróbuj ponownie
3. Spróbuj z mniejszym cupem (np. Little Cup)

### Plik jest za duży (>100MB)

GitHub ma limit 100MB na plik. Jeśli plik jest większy:

1. Sprawdź rozmiar:
   ```bash
   ls -lh rankings-1500.json
   ```

2. Jeśli >100MB, rozważ:
   - Git LFS
   - Alternatywny hosting
   - Kontakt ze mną dla porady

### 404 po deployment

1. Poczekaj 5-10 minut - GitHub Pages potrzebuje czasu
2. Sprawdź czy workflow się zakończył sukcesem
3. Sprawdź czy ścieżka jest poprawna (case-sensitive!)

## Następne kroki

### W pogo_teambuilder

Dodaj wsparcie dla `allMatches`:

```swift
struct CupRankingEntry: Codable {
    let speciesId: String
    let speciesName: String
    let rating: Int
    let score: Double
    let matchups: [Matchup]
    let counters: [Counter]
    
    // ✨ NEW
    let allMatches: [FullMatchup]?
}

struct FullMatchup: Codable {
    let opponent: String
    let rating: Int
    let opRating: Int
}
```

Pobierz full rankings:
```swift
let url = URL(string: "https://sikora-pawel.github.io/pvpoke/rankings/ascension/full/rankings-1500.json")!
```

## Przykład użycia w aplikacji

```swift
// Znajdź matchup dla konkretnego pojedynku
func findMatchup(attacker: String, defender: String, rankings: [CupRankingEntry]) -> Int? {
    guard let attackerRanking = rankings.first(where: { $0.speciesId == attacker }),
          let allMatches = attackerRanking.allMatches,
          let matchup = allMatches.first(where: { $0.opponent == defender }) else {
        return nil
    }
    return matchup.rating
}

// Przykład: Jak Ninetales radzi sobie vs Talonflame?
let rating = findMatchup(attacker: "ninetales", defender: "talonflame", rankings: ascensionRankings)
// rating = 270 (słaba przegrana)
```

## Linki

- **Pełna dokumentacja**: [FULL_MATCHUPS.md](FULL_MATCHUPS.md)
- **Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **General setup**: [QUICKSTART.md](QUICKSTART.md)
- **pvpoke.com**: https://pvpoke.com

---

**Gotowe!** Teraz masz pełne macierze matchupów dla zaawansowanego team buildingu! 🚀

