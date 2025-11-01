# Full Matchup Data Generation

This document describes how to generate and use **full matchup matrices** for Pokemon GO PvP cups.

## Overview

The standard pvpoke rankings only include:
- Top 5 best matchups
- Top 5 worst matchups (counters)

For building advanced team-building tools like **pogo_teambuilder**, we need **complete matchup data** showing how every Pokemon performs against every other Pokemon in a cup.

## What's Different?

### Standard Rankings (`/rankings/{cup}/{category}/rankings-{cp}.json`)

```json
{
  "speciesId": "ninetales",
  "matchups": [
    // Only top 5 winning matchups
  ],
  "counters": [
    // Only top 5 losing matchups
  ]
}
```

### Full Rankings (`/rankings/{cup}/full/rankings-{cp}.json`)

```json
{
  "speciesId": "ninetales",
  "matchups": [
    // Top 5 for backward compatibility
  ],
  "counters": [
    // Top 5 for backward compatibility  
  ],
  "allMatches": [
    // ✨ ALL matchups against all Pokemon in the cup!
    {"opponent": "electrode_hisuian", "rating": 757, "opRating": 242},
    {"opponent": "galvantula", "rating": 662, "opRating": 337},
    {"opponent": "vikavolt", "rating": 662, "opRating": 337},
    // ... hundreds more ...
  ]
}
```

## File Structure

Full matchup data is saved in a separate `/full/` directory:

```
src/data/rankings/
├── all/
│   ├── overall/
│   │   └── rankings-1500.json       # Standard (top 5 only)
│   ├── leads/
│   │   └── rankings-1500.json       # Standard
│   └── full/
│       └── rankings-1500.json       # ✨ FULL matchup data
├── ascension/
│   ├── overall/
│   │   └── rankings-1500.json       # Standard
│   └── full/
│       └── rankings-1500.json       # ✨ FULL matchup data
└── ...
```

## Generating Full Rankings

### Method 1: Web Interface (Recommended)

1. **Start local PHP server** (see main README.md for setup)

2. **Open browser** and navigate to:
   ```
   http://localhost:8000/rankerfull.php
   ```

3. **Select format**:
   - Choose your cup (e.g., "Great League", "Ascension Cup")
   - Select CP limit

4. **Run simulation**:
   - Click "Simulate Full Rankings"
   - Open browser developer console (F12)
   - Watch progress - this takes 2-5 minutes depending on cup size

5. **Verify output**:
   - Check console for: `/{cup}/full/rankings-{cp}.json (FULL MATCHUPS)`
   - Files are saved to `src/data/rankings/{cup}/full/`

### Method 2: Modify Existing Ranker

If you want to integrate into existing workflow:

1. Copy `RankerFull.js` usage into your build process
2. Or modify `ranker.php` to use `RankerFull.js` temporarily

## Data Format

### allMatches Array

Each entry in `allMatches` contains:

```javascript
{
  "opponent": "string",      // Species ID of opponent
  "rating": number,          // Battle rating (0-1000)
                             // > 500 = win, < 500 = loss
  "opRating": number         // Opponent's rating in this matchup
}
```

### Rating Scale

- **1000**: Perfect win (100% HP remaining, opponent at 0%)
- **700-900**: Strong win
- **550-700**: Moderate win
- **500**: Exact tie
- **300-500**: Moderate loss
- **100-300**: Strong loss
- **0**: Perfect loss

## File Size Comparison

| Cup | Standard Rankings | Full Rankings | Increase |
|-----|------------------|---------------|----------|
| Great League (All) | ~150 KB | ~5-8 MB | ~50x |
| Ascension Cup | ~45 KB | ~1-2 MB | ~40x |
| Little Cup | ~30 KB | ~800 KB | ~25x |

⚠️ **Note**: Full rankings are significantly larger. This is intentional - we're storing complete matchup matrices.

## Using Full Rankings in Applications

### Example: pogo_teambuilder Integration

```swift
struct CupRankingEntry: Codable {
    let speciesId: String
    let speciesName: String
    let rating: Int
    let score: Double
    
    // Standard fields
    let matchups: [Matchup]      // Top 5
    let counters: [Counter]       // Top 5
    
    // ✨ NEW: Full matchup data
    let allMatches: [FullMatchup]?  // ALL matchups
}

struct FullMatchup: Codable {
    let opponent: String
    let rating: Int
    let opRating: Int
}
```

### Fetching Full Rankings

```swift
// Standard rankings (lightweight)
let url = "https://sikora-pawel.github.io/pvpoke/rankings/ascension/overall/rankings-1500.json"

// Full rankings (complete matchup data)
let url = "https://sikora-pawel.github.io/pvpoke/rankings/ascension/full/rankings-1500.json"
```

## Deployment

### GitHub Pages

Full rankings are automatically deployed via GitHub Actions:

1. Generate rankings locally using `rankerfull.php`
2. Commit files to git:
   ```bash
   git add src/data/rankings/*/full/
   git commit -m "Add full matchup rankings for [cup name]"
   git push origin master
   ```
3. GitHub Actions deploys to Pages automatically
4. Available at: `https://sikora-pawel.github.io/pvpoke/rankings/{cup}/full/rankings-{cp}.json`

## Performance Considerations

### Generation Time

- **Great League**: 3-5 minutes (150+ Pokemon)
- **Specialty Cup**: 1-2 minutes (30-60 Pokemon)
- **Little Cup**: 30-60 seconds (20-40 Pokemon)

### Network/Download

- Full rankings are larger but compress well with gzip
- GitHub Pages serves with gzip automatically
- Typical download: 1-2 MB → 200-400 KB compressed

### Processing

Example for Great League:
- 150 Pokemon × 150 opponents = 22,500 battles
- Each battle simulated with move selection
- Results stored in `allMatches` array

## Best Practices

### 1. Generate Strategically

Don't generate full rankings for every cup/category combination:

✅ **DO generate for**:
- Main leagues (Great, Ultra, Master)
- Active cups for team building
- Cups needed by your application

❌ **DON'T generate for**:
- Archived/historical cups
- Every ranking category (leads, switches, etc.)
- Custom test cups

### 2. Update Frequency

Full rankings should be updated when:
- New Pokemon are released
- Move rebalancing occurs
- Cup rules change
- You pull from upstream pvpoke

### 3. Storage

Full rankings are in gitignore by default for main pvpoke repo. For your fork:

```bash
# .gitignore
# COMMENT OUT this line to commit full rankings:
# src/data/rankings/*/full/
```

## Troubleshooting

### "full" directory not found

Create it manually:
```bash
mkdir -p src/data/rankings/{cup}/full/
```

Or modify `write.php` to create directories automatically.

### File size too large for GitHub

GitHub has 100 MB file limit. If a single ranking file exceeds this:
- Consider splitting by CP tier
- Use Git LFS
- Or host on alternative CDN

### Simulation takes too long

For testing, modify cup to include fewer Pokemon:
```javascript
// In rankerfull.php or modify cup definition
cup.include = ["ninetales", "grumpig", "pachirisu", ...]; // Smaller set
```

## Implementation Details

### RankerFull.js Modifications

Key changes from standard `Ranker.js`:

1. **Lines 577-582**: Create `allMatches` field with complete data
2. **Line 586**: DON'T delete `rankings[i].matches`
3. **Line 605**: Category hardcoded to `"full"`

### Backward Compatibility

Full rankings still include `matchups` and `counters` fields (top 5 each) for tools expecting standard format.

## Examples

### Generate Great League Full Rankings

```bash
# 1. Start server
cd pvpoke/src
php -S localhost:8000

# 2. Open browser
open http://localhost:8000/rankerfull.php

# 3. Select format
- Format: "Great League"
- CP: 1500

# 4. Click "Simulate Full Rankings"

# 5. Verify
ls -lh data/rankings/all/full/rankings-1500.json
```

### Use in API Call

```bash
# Standard rankings
curl https://sikora-pawel.github.io/pvpoke/rankings/all/overall/rankings-1500.json | jq '.[0].matchups | length'
# Output: 5

# Full rankings
curl https://sikora-pawel.github.io/pvpoke/rankings/all/full/rankings-1500.json | jq '.[0].allMatches | length'
# Output: 150+
```

## Future Enhancements

Potential improvements for full ranking system:

- [ ] Automated generation script
- [ ] CLI tool for bulk generation
- [ ] Compressed format (binary, protobuf, etc.)
- [ ] Incremental updates (only changed matchups)
- [ ] API endpoint for on-demand generation

## Questions?

See also:
- [DEPLOYMENT.md](DEPLOYMENT.md) - GitHub Pages deployment
- [QUICKSTART.md](QUICKSTART.md) - Setup guide
- [README.md](README.md) - General pvpoke documentation

---

**Generated for pogo_teambuilder** - Advanced team building requires advanced data! 🚀

