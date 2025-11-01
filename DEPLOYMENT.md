# PvPoke Data Deployment

Ten fork pvpoke jest używany do generowania i hostowania danych rankingowych dla aplikacji **pogo_teambuilder**.

## Architektura

### GitHub Actions + GitHub Pages

Dane są automatycznie deployowane na GitHub Pages przez workflow `.github/workflows/deploy-pages.yml`.

### Struktura URLi

Po deployment na GitHub Pages, dane są dostępne pod adresem:

- **Base URL**: `https://sikora-pawel.github.io/pvpoke/`
- **Rankingi (standard)**: `https://sikora-pawel.github.io/pvpoke/rankings/{cup}/{category}/rankings-{cp}.json`
- **Rankingi (full matchups)**: `https://sikora-pawel.github.io/pvpoke/rankings/{cup}/full/rankings-{cp}.json` ⭐ NEW
- **Gamemaster**: `https://raw.githubusercontent.com/sikora-pawel/pvpoke/master/src/data/gamemaster.json`
- **Cups Archive**: `https://raw.githubusercontent.com/sikora-pawel/pvpoke/master/src/data/gamemaster/cups/archive/cups.json`
- **Formats**: `https://raw.githubusercontent.com/sikora-pawel/pvpoke/master/src/data/gamemaster/formats.json`

### Przykłady

#### Standard Rankings (Top 5 matchups only)

- Ascension Cup (Great League, Overall): 
  ```
  https://sikora-pawel.github.io/pvpoke/rankings/ascension/overall/rankings-1500.json
  ```

- Great League (Overall):
  ```
  https://sikora-pawel.github.io/pvpoke/rankings/all/overall/rankings-1500.json
  ```

- Ultra League (Leads):
  ```
  https://sikora-pawel.github.io/pvpoke/rankings/all/leads/rankings-2500.json
  ```

#### Full Matchup Rankings (ALL matchups) ⭐ NEW

- Ascension Cup (Full matchups):
  ```
  https://sikora-pawel.github.io/pvpoke/rankings/ascension/full/rankings-1500.json
  ```

- Great League (Full matchups):
  ```
  https://sikora-pawel.github.io/pvpoke/rankings/all/full/rankings-1500.json
  ```

- Ultra League (Full matchups):
  ```
  https://sikora-pawel.github.io/pvpoke/rankings/all/full/rankings-2500.json
  ```

For detailed information about full matchup rankings, see [FULL_MATCHUPS.md](FULL_MATCHUPS.md).

## Deployment Process

### Automatyczny Deployment

1. Push do branch `master` automatycznie triggeruje workflow GitHub Actions
2. Workflow uploaduje katalog `src/data/` do GitHub Pages
3. Dane są dostępne pod adresem `https://sikora-pawel.github.io/pvpoke/`

### Manualny Deployment

Możesz również manualnie uruchomić workflow:

1. Przejdź do: https://github.com/sikora-pawel/pvpoke/actions
2. Wybierz workflow "Deploy to GitHub Pages"
3. Kliknij "Run workflow"

## Konfiguracja GitHub Pages

Aby włączyć GitHub Pages:

1. Przejdź do Settings → Pages
2. W sekcji "Build and deployment":
   - Source: **GitHub Actions**
3. Workflow automatycznie skonfiguruje deployment

## Generowanie Rankingów

Rankingi są już wygenerowane w katalogu `src/data/rankings/`. 

Jeśli chcesz wygenerować nowe rankingi lokalnie:

1. Uruchom lokalny serwer PHP (patrz README.md w repo pvpoke)
2. Odwiedź stronę `ranker.php` w przeglądarce
3. Otwórz developer console
4. Uruchom symulacje (to może potrwać kilka minut)
5. Rankingi zostaną zapisane do `/data/rankings/`
6. Dla overall rankings, odwiedź `rankersandbox.php` i kliknij "Simulate" dla każdej ligi

Więcej informacji: https://github.com/pvpoke/pvpoke#generating-rankings

## Struktura Danych

### Ranking JSON Format

Każdy plik rankingowy zawiera array obiektów Pokemon:

```json
[
  {
    "speciesId": "ninetales",
    "speciesName": "Ninetales",
    "rating": 748,
    "matchups": [...],
    "counters": [...],
    "moves": {...},
    "moveset": ["EMBER", "WEATHER_BALL_FIRE", "SCORCHING_SANDS"],
    "score": 95.1,
    "scores": [80.8, 93, 93.7, 92.9, 100, 91.5],
    "stats": {
      "product": 1954,
      "atk": 114.3,
      "def": 135.5,
      "hp": 126
    }
  }
]
```

### Kategorie Rankingów

- `overall` - Ogólny ranking
- `leads` - Najlepsi leaderzy
- `switches` - Najlepsi switchers
- `closers` - Najlepsi closers
- `attackers` - Najlepsi attackerzy
- `chargers` - Najlepsi chargers
- `consistency` - Najbardziej konsystentni

### CP Limits

- `1500` - Great League
- `2500` - Ultra League
- `10000` - Master League (unlimited)
- `500` - Little Cup

## Integracja z pogo_teambuilder

W projekcie `pogo_teambuilder` zaktualizowane zostały następujące pliki:

1. **GamemasterService.swift** - używa GitHub raw content dla gamemaster.json
2. **CupRankingService.swift** - używa GitHub Pages dla rankingów
3. **CupRowView.swift** - przykład użycia nowego URL

## Troubleshooting

### GitHub Pages nie działa

1. Sprawdź czy workflow się wykonał: https://github.com/sikora-pawel/pvpoke/actions
2. Sprawdź logi workflow jeśli był error
3. Sprawdź Settings → Pages czy Source jest ustawiony na "GitHub Actions"

### 404 Not Found

1. Upewnij się że workflow się wykonał pomyślnie
2. Sprawdź czy ścieżka do pliku jest poprawna (case-sensitive!)
3. GitHub Pages potrzebuje kilku minut na propagację po pierwszym deployment

### CORS Issues

GitHub Pages domyślnie obsługuje CORS, więc aplikacje mogą pobierać dane z innych domen.

## Maintenance

### Aktualizacja Danych

1. Sklonuj repo lokalnie
2. Wygeneruj nowe rankingi (patrz sekcja "Generowanie Rankingów")
3. Commit i push do `master`
4. GitHub Actions automatycznie zadeploy nowe dane

### Monitoring

- Sprawdzaj status deployment: https://github.com/sikora-pawel/pvpoke/deployments
- GitHub Pages status: https://www.githubstatus.com/

## Linki

- **Original PvPoke**: https://github.com/pvpoke/pvpoke
- **PvPoke Wiki**: https://github.com/pvpoke/pvpoke/wiki/
- **GitHub Pages Docs**: https://docs.github.com/en/pages
- **GitHub Actions Docs**: https://docs.github.com/en/actions

