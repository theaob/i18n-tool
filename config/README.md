# codeNamespaces.json

List of translation-key namespace prefixes whose values are standardized
codes/designators (e.g. ADatP-3 / APP-6 abbreviations like `CORRTE`, `DZ`,
`TC`, `ASAP`, `TBD`) and must **never** be sent to the AI translator —
they're copied as-is into every locale instead.

A value only counts as a "code" if:
- its key contains one of the prefixes below, **and**
- it looks like a code: 2-8 characters, all caps/digits/`-`/`/`, no spaces
  (see `CODE_RE` in `src/services/aiService.js` / `electron/gemini.js`)

## Adding a namespace

Found a feature where a whole namespace is standardized abbreviations that
keep getting mistranslated? Add its prefix here — no code changes needed.

Prefixes are matched with `key.includes(prefix)` against the fully
flattened key (feature prefix included, e.g.
`RapTrackTranslation.propertyValue.latitude`).

**Two rules before adding one:**

1. **Don't add a namespace just because its values happen to be short and
   all-caps.** Plenty of real English words are (`RADAR`, `WEAPON`,
   `SETTINGS`, `TRANSMIT`, `ACTIVE`, `SECURE`...). Only add namespaces
   whose values are genuinely fixed abbreviations that must render
   identically in every locale (`TN`, `HDG`, `A4`, `PNG`, `AOR`...).
   Check every value in the namespace, not just a couple — one real word
   mixed in with real codes (e.g. `ACOTranslation.stopTimeQualifier` has
   both `AFTER`/`BEFORE` as plain words *and* `ASAP`/`TBD`/`NLT` as
   genuine abbreviations) means the namespace can't be added wholesale.

2. **Qualify generic segment names with their feature prefix.** Segment
   names like `shortLabels`, `columns`, or `propertyLabels` are reused
   across many features with completely different (and often
   translatable) content. `"shortLabels."` alone would also protect
   `ACMTranslation.shortLabels.state = "State"` — a real word — just
   because some *other* feature's `shortLabels` happens to hold codes.
   Write the full path instead: `"LandTrackTranslation.shortLabels."`.
   Only leave a prefix unqualified (like `acmTypeShort.`, `acmUsage.`)
   when you've confirmed no other feature reuses that exact segment name.

## Current entries (beyond ACM)

Found while scanning the full feature set — each namespace below was
checked value-by-value and every entry in it is a genuine fixed code,
not a real word that happens to be short/uppercase:

| Namespace | Example values |
|---|---|
| `RapTrackTranslation.indirectParticipantSiteKindType.` | FRU, PU, RU, JU, FJU, GU, NU |
| `RapTrackTranslation.propertyValue.` | ADG, DMS, LAT, LON |
| `CommonTranslation.coordinateUnit.` | ADG, DD, DMS |
| `RecordPlaybackTranslation.printing.pageSize.` | A3, A4, A5 |
| `TacticalControlTranslation.listColums.` / `.listColumns.` | TGTN, TN, BRAA (both spellings exist in the source data) |
| `C2ConfigTranslation.tabList.` | AOR, AOI |
| `CloseControlTranslation.point.shortLabel.` | HDG, ALT |
| `CommonTranslation.screenshotFormatType.` | PNG, JPEG |
| `ConnectionPointTranslation.connectionPointInterface.` | ASTERIX, AWCIES |
| `MapTranslation.globeProjection.` | 2D, 3D |

**Deliberately left out**, despite matching the all-caps shape, because the
values are real English words that need translating:

- `RapTrackTranslation.plssInformation.defensiveJammerSystemStatus` (TRANSMIT, RECEIVE, STANDBY, OFF)
- `RapTrackTranslation.plssInformation.equipmentStatus` (UP, DOWN, DEGRADED)
- `RapTrackTranslation.plssInformation.activityStatus` / `.amcmLazerStatus` (ACTIVE, INACTIVE)
- `RapTrackTranslation.plssInformation.secureRadioIndicator` (SECURE, UNSECURE)
- `ACOTranslation.stopTimeQualifier` — mixed: `ASAP`/`TBD`/`NLT`/`UFN`/`UNK` are genuine codes, but `AFTER`/`BEFORE` in the same namespace are plain words. Needs per-key handling, not a namespace prefix — flag it if this comes up in practice.
