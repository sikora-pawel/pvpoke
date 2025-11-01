# Batch Generation Guide - Full Matchup Rankings

Jak wygenerować **wszystkie** full matchup rankings jednym kliknięciem.

---

## 🚀 Quick Start

### 1️⃣ Uruchom serwer (z 256MB limitem)

```bash
cd /Users/pawelsikora/pvpoke
./START_SERVER.sh
```

Zobaczysz:
```
🚀 Starting pvpoke development server on http://localhost:8000
⚙️  Using custom PHP config (256MB POST limit)
```

### 2️⃣ Otwórz rankerfull.php

```bash
open http://localhost:8000/rankerfull.php
```

### 3️⃣ Kliknij "🚀 Generate All Cups (Batch)"

1. **Poczekaj** aż dropdown się załaduje (~2 sekundy)
2. **Kliknij pomarańczowy przycisk**: "🚀 Generate All Cups (Batch)"
3. **Confirm dialog**:
   ```
   This will generate full matchup rankings for ALL 13 cups.
   
   Estimated time: 20 minutes
   
   The process will run automatically. Do NOT close this page!
   
   Continue?
   ```
4. **Kliknij OK**

### 4️⃣ Obserwuj postęp

**Progress bar** pokaże:
```
Batch Progress:
██████░░░░░░░░░░░░ 30%

Processing cup 4 of 13...
🏆 Halloween Cup (1500 CP)
```

**Console** (Cmd + Option + J):
```
═══════════════════════════════════════════════════
🏆 CUP 1/13: Great League
═══════════════════════════════════════════════════

🎯 Full Matchups mode - using only first scenario: leads
pokemonList [1088] generated...
total battles 1183744
💾 Saving to: /all/full/rankings-1500.json (104 MB)
✅ File saved successfully!
🗄️  Converting to SQLite...
✅ SQLite conversion complete!
   DB: 20 MB
   Compressed: 8 MB
✅ Cup complete: all

═══════════════════════════════════════════════════
🏆 CUP 2/13: Ultra League
═══════════════════════════════════════════════════
...
```

### 5️⃣ Poczekaj na zakończenie (~15-25 min)

Console pokaże:
```
🎉 BATCH COMPLETE! All cups processed!
📦 Generated 13 full matchup rankings

Next steps:
  cd /Users/pawelsikora/pvpoke
  git add src/data/rankings/*/full/
  git commit -m "Add full matchup rankings for all active cups"
  git push origin master
```

### 6️⃣ Commit wszystko jednym razem

```bash
cd /Users/pawelsikora/pvpoke

# Sprawdź co zostało wygenerowane
ls -lh src/data/rankings/*/full/*.db.gz

# Dodaj wszystko
git add src/data/rankings/*/full/

# Commit
git commit -m "Add full matchup rankings for all active cups

Generated SQLite databases with complete matchup matrices:
- Great League: 8 MB
- Ultra League: 6.5 MB  
- Master League: 4 MB
- 10 specialty cups: 0.3-1 MB each

Total download size: ~25 MB compressed"

# Push
git push origin master
```

---

## 📊 Co zostanie wygenerowane?

### Main Leagues (3):
```
src/data/rankings/all/full/
├── rankings-1500.json       (104 MB)
├── rankings-1500.db         (20 MB)
├── rankings-1500.db.gz      (8 MB) ⭐

├── rankings-2500.json       (85 MB)
├── rankings-2500.db         (16 MB)
├── rankings-2500.db.gz      (6.5 MB) ⭐

├── rankings-10000.json      (65 MB)
├── rankings-10000.db        (12 MB)
└── rankings-10000.db.gz     (4 MB) ⭐
```

### Specialty Cups (~10):
```
src/data/rankings/halloween/full/
├── rankings-1500.json       (15 MB)
├── rankings-1500.db         (256 KB)
└── rankings-1500.db.gz      (85 KB) ⭐

src/data/rankings/jungle/full/
├── rankings-1500.json       (12 MB)
├── rankings-1500.db         (220 KB)
└── rankings-1500.db.gz      (75 KB) ⭐

... etc dla każdego aktywnego cupu
```

---

## ⏱️ Estimated Times

| Cup | Pokemon | Battles | Time |
|-----|---------|---------|------|
| **Great League** | 1,088 | 1,183,744 | ~5 min |
| **Ultra League** | 890 | 792,100 | ~4 min |
| **Master League** | 650 | 422,500 | ~3 min |
| **Specialty Cup** | 30-60 | 900-3,600 | ~30-60 sec |

**Total: 15-25 minutes** (zależy od liczby specialty cupów)

---

## 🎯 Features

### ✅ Fully Automatic

- ✅ Wybiera cup z dropdownu
- ✅ Uruchamia symulację
- ✅ Zapisuje JSON do właściwego katalogu
- ✅ Konwertuje do SQLite
- ✅ Kompresuje gzipem
- ✅ Przechodzi do następnego cupu
- ✅ Progress bar i status updates
- ✅ Timeout protection (10 min max per cup)

### ✅ Smart Features

- Pomija "custom" cup (nie potrzebny)
- Generuje 3 wersje: JSON, SQLite, SQLite.gz
- Real-time progress tracking
- Error handling z fallback
- Końcowe instrukcje w console

---

## ⚠️ Ważne!

### DO:
- ✅ Zostaw stronę otwartą przez cały czas
- ✅ Nie zamykaj przeglądarki
- ✅ Możesz przełączyć się na inną kartę (ale nie zamykaj)
- ✅ Obserwuj console dla szczegółów

### DON'T:
- ❌ Nie zamykaj strony/przeglądarki
- ❌ Nie odświeżaj strony (F5)
- ❌ Nie wyłączaj komputera
- ❌ Nie klikaj przycisku drugi raz (jest disabled podczas procesu)

---

## 🐛 Troubleshooting

### Batch się zatrzymał

**Sprawdź console** - czy są błędy?

**Restart**:
1. Odśwież stronę (F5)
2. Kliknij "Generate All" ponownie
3. Już wygenerowane cupy zostaną nadpisane (to OK)

### Niektóre cupy się nie wygenerowały

**Sprawdź które**:
```bash
ls -la src/data/rankings/*/full/*.db.gz
```

**Wygeneruj ręcznie** brakujące:
1. Wybierz cup z dropdownu
2. Kliknij "Simulate Selected Cup"

### PHP timeout

Jeśli cup trwa >10 min (bardzo rzadkie):
- Batch automatycznie przejdzie dalej
- Możesz potem wygenerować ten cup osobno

---

## 💡 Tips

### Generuj w nocy

Batch processing zajmuje 15-25 min:
1. Uruchom wieczorem
2. Zostaw komputer włączony
3. Rano wszystko gotowe!

### Generuj tylko gdy potrzeba

Nie musisz generować za każdym razem wszystkich cupów:

**Często (co tydzień)**:
- Great League
- Ultra League
- Aktywny specialty cup (np. Halloween podczas eventu)

**Rzadko (co miesiąc)**:
- Master League
- Inne specialty cupy

**Gdy zmienią się dane**:
- Nowe Pokemon
- Move rebalancing
- Pull z upstream pvpoke

---

## 📦 File Organization

Po batch generation:

```
src/data/rankings/
├── all/full/
│   ├── rankings-1500.db.gz    (8 MB) ⭐ Great
│   ├── rankings-2500.db.gz    (6.5 MB) ⭐ Ultra
│   └── rankings-10000.db.gz   (4 MB) ⭐ Master
├── halloween/full/
│   └── rankings-1500.db.gz    (85 KB) ⭐
├── jungle/full/
│   └── rankings-1500.db.gz    (75 KB) ⭐
└── ... wszystkie inne aktywne cupy
```

---

## ✅ Finał

**Jeden przycisk** → **wszystkie dane** → **zero ręcznej pracy** → **commit i push** → **deployed!** 🎉

Total download dla iOS: **~25-30 MB** (wszystkie cupy)  
Vs JSON: **~400 MB** ❌

**Kompresja: 92%** 🚀

---

**Gotowe!** Możesz teraz wygenerować wszystkie rankingi naraz! 💪

