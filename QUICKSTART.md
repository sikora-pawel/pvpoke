# Quick Start Guide

Szybki przewodnik konfiguracji tego forka pvpoke dla hostowania danych przez GitHub Pages.

## Kroki do wykonania

### 1. Włącz GitHub Pages

1. Przejdź do https://github.com/sikora-pawel/pvpoke/settings/pages
2. W sekcji **"Build and deployment"**:
   - **Source**: Wybierz **GitHub Actions**
3. Zapisz ustawienia

### 2. Push zmian do repo

```bash
cd /Users/pawelsikora/pvpoke

# Sprawdź status
git status

# Dodaj nowe pliki
git add .github/workflows/deploy-pages.yml
git add DEPLOYMENT.md
git add QUICKSTART.md
git add README.md

# Commit
git commit -m "Add GitHub Pages deployment workflow and documentation"

# Push
git push origin master
```

### 3. Uruchom deployment

Po push'u do `master`:

1. Workflow automatycznie się uruchomi
2. Sprawdź status na: https://github.com/sikora-pawel/pvpoke/actions
3. Po zakończeniu (ok. 1-2 min), dane będą dostępne na:
   - https://sikora-pawel.github.io/pvpoke/

### 4. Test deployment

Sprawdź czy dane są dostępne:

```bash
# Test gamemaster
curl -I https://raw.githubusercontent.com/sikora-pawel/pvpoke/master/src/data/gamemaster.json

# Test rankingów (po deployment GitHub Pages)
curl -I https://sikora-pawel.github.io/pvpoke/rankings/ascension/overall/rankings-1500.json
```

### 5. Update pogo_teambuilder

W projekcie `pogo_teambuilder` już są zaktualizowane URLe:

- ✅ `GamemasterService.swift` - używa GitHub raw content
- ✅ `CupRankingService.swift` - używa GitHub Pages
- ✅ `CupRowView.swift` - przykład preview

Pozostało tylko:

```bash
cd /Users/pawelsikora/pogo_teambuilder

# Sprawdź zmiany
git status

# Commit i push
git add .
git commit -m "Switch to self-hosted pvpoke data via GitHub Pages"
git push
```

## Ważne URLe

### Dla gamemaster i statycznych plików (GitHub raw content):
```
https://raw.githubusercontent.com/sikora-pawel/pvpoke/master/src/data/gamemaster.json
https://raw.githubusercontent.com/sikora-pawel/pvpoke/master/src/data/gamemaster/cups/archive/cups.json
https://raw.githubusercontent.com/sikora-pawel/pvpoke/master/src/data/gamemaster/formats.json
```

### Dla rankingów (GitHub Pages):
```
https://sikora-pawel.github.io/pvpoke/rankings/{cup}/{category}/rankings-{cp}.json
```

#### Przykłady:
- Great League Overall: `https://sikora-pawel.github.io/pvpoke/rankings/all/overall/rankings-1500.json`
- Ascension Cup Overall: `https://sikora-pawel.github.io/pvpoke/rankings/ascension/overall/rankings-1500.json`
- Ultra League Leads: `https://sikora-pawel.github.io/pvpoke/rankings/all/leads/rankings-2500.json`

## Troubleshooting

### GitHub Pages zwraca 404

**Problem**: Po deployment nadal widzę 404 Not Found

**Rozwiązanie**:
1. Sprawdź czy workflow się wykonał: https://github.com/sikora-pawel/pvpoke/actions
2. GitHub Pages potrzebuje kilku minut na propagację po pierwszym deployment
3. Upewnij się że Source jest ustawiony na "GitHub Actions" w Settings → Pages

### Workflow się nie uruchamia

**Problem**: Po push nie widzę workflow w Actions

**Rozwiązanie**:
1. Sprawdź czy plik jest w `.github/workflows/deploy-pages.yml`
2. Sprawdź składnię YAML (musi być poprawnie sformatowany)
3. Sprawdź czy masz uprawnienia do uruchamiania Actions w repo

### Dane są stare

**Problem**: GitHub Pages pokazuje stare dane po aktualizacji

**Rozwiązanie**:
1. Push nową wersję do `master`
2. Poczekaj na zakończenie workflow
3. Wyczyść cache przeglądarki lub dodaj query parameter: `?v=timestamp`
4. GitHub Pages może cache'ować dane przez kilka minut

## Generowanie Pełnych Matchupów (Full Rankings)

### Czym są Full Rankings?

Standardowe rankingi zawierają tylko top 5 wygranych i top 5 przegranych matchupów.  
**Full rankings** zawierają WSZYSTKIE matchupy każdego Pokemona vs wszystkich innych!

### Jak wygenerować?

1. **Uruchom lokalny serwer PHP**:
   ```bash
   cd /Users/pawelsikora/pvpoke/src
   php -S localhost:8000
   ```

2. **Otwórz rankerfull.php**:
   ```bash
   open http://localhost:8000/rankerfull.php
   ```

3. **Wybierz format**:
   - Wybierz cup (np. "Ascension Cup", "Great League")
   - Wybierz CP limit (1500, 2500, etc.)

4. **Kliknij "Simulate Full Rankings"**:
   - Otwórz Developer Console (F12)
   - Obserwuj postęp (zajmie 2-5 min dla Great League)

5. **Sprawdź wynik**:
   ```bash
   ls -lh /Users/pawelsikora/pvpoke/src/data/rankings/all/full/rankings-1500.json
   ```

6. **Commit i push**:
   ```bash
   cd /Users/pawelsikora/pvpoke
   git add src/data/rankings/*/full/
   git commit -m "Add full matchup rankings for Great League"
   git push origin master
   ```

### Dostępne po deployment:

```
https://sikora-pawel.github.io/pvpoke/rankings/{cup}/full/rankings-{cp}.json
```

Więcej informacji: [FULL_MATCHUPS.md](FULL_MATCHUPS.md)

## Następne kroki

1. **Test w aplikacji**: Uruchom `pogo_teambuilder` i sprawdź czy dane się ładują
2. **Monitor deployment**: Obserwuj https://github.com/sikora-pawel/pvpoke/deployments
3. **Generuj full rankings**: Dla cupów których potrzebujesz w aplikacji
4. **Update danych**: Gdy pvpoke.com zaktualizuje dane, możesz:
   - Pull z upstream: `git pull https://github.com/pvpoke/pvpoke.git master`
   - Lub wygenerować rankingi lokalnie (patrz DEPLOYMENT.md)

## Dodatkowe informacje

- Pełna dokumentacja: [DEPLOYMENT.md](DEPLOYMENT.md)
- Original PvPoke: https://github.com/pvpoke/pvpoke
- GitHub Pages docs: https://docs.github.com/en/pages
- GitHub Actions docs: https://docs.github.com/en/actions

## Wsparcie

Jeśli masz problemy:

1. Sprawdź logi workflow: https://github.com/sikora-pawel/pvpoke/actions
2. Sprawdź deployment status: https://github.com/sikora-pawel/pvpoke/deployments
3. Zobacz czy GitHub Pages działa: https://www.githubstatus.com/

