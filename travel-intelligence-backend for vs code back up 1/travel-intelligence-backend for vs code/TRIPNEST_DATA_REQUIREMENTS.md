# TripNest Data Requirements & POI Dataset Specification

**Document Version:** 1.0  
**Status:** Approved Read-Only Architecture Reference  
**Scope:** TripNest Recommendation & Optimization Engine Data Interface  

---

## 1. Executive Summary

This document defines the exact data interface and schema requirements for the TripNest backend recommendation engine and route optimizer. Any dataset intended for ingestion, cleaning, or merging into TripNest must conform strictly to these specifications to ensure mathematical stability, time-budget feasibility, and high-quality itinerary generation.

---

## 2. End-to-End System Pipeline Flow

Understanding how TripNest processes POIs is essential for preparing clean data:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. QUESTIONNAIRE INPUT (User Preferences & Constraints)                     │
│    • Province, Starting City / Coordinates (start_lat, start_lon)           │
│    • Maximum Budget (PKR), Maximum Travel Time (Hours)                      │
│    • Travel Style (Adventure, Cultural, Relaxation, Mixed)                  │
│    • Environment Preference (Mountains, Nature, City, Historical)           │
│    • Preferred Categories (e.g. ['lake', 'fort', 'museum'])                 │
│    • Crowd Preference (Avoid crowds vs. Don't mind)                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. CANDIDATE FILTERING (Hard Spatial & Categorical Pruning)                 │
│    • Province Filter: `loc['province'] == user_province`                    │
│    • Budget Filter: `loc['cost'] <= max_budget`                             │
│    • Distance Filter: `haversine(start, loc) <= max_distance_km (default 50)`│
│    • Preference Match Tagging: Compares `category` against user profile     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. RECOMMENDATION SCORING (Multi-Criteria Decision Analysis)                │
│    • Score (0–100) = 25% Preference + 20% Rating + 15% Popularity           │
│                      + 10% Importance + 15% Affordability + 15% Proximity   │
│    • Generates evidence-based `why_selected` explanation tags               │
│    • Sorts candidate POIs by descending score                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. CONSTRAINT SOLVER & SELECTION (Knapsack Time & Budget Packing)           │
│    • Spatial Clustering (K-Means/DBSCAN) selects dense POI cluster          │
│    • Greedy Selection respects:                                             │
│      - Cumulative cost <= `max_budget`                                      │
│      - Cumulative (visit_duration + travel_time) <= `max_travel_hours`      │
│      - Maximum location cap based on available hours                        │
│      - Category diversity limits (prevents redundant attraction types)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. ROUTE OPTIMIZATION (TSP & Road Network Sequencing)                       │
│    • Computes real road travel times and distances via OSRM Matrix API      │
│    • Solves Travelling Salesperson Problem (TSP) using 2-Opt heuristic     │
│    • Outputs optimized visit sequence starting and ending at base location  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. ITINERARY TIMELINE GENERATION                                            │
│    • Computes arrival times, visit windows, departure times, and road legs  │
│    • Renders interactive map polylines, markers, and day-by-day schedule    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Field-by-Field Usage in TripNest

Below is how the TripNest engine consumes each field in [`app/recommendation.py`](file:///c:/Users/Arslan/Desktop/SEPERATE%20WORKSPACE%20FOR%20FYP/travel-intelligence-backend%20for%20vs%20code%20back%20up%201/travel-intelligence-backend%20for%20vs%20code/app/recommendation.py), [`app/data_loader.py`](file:///c:/Users/Arslan/Desktop/SEPERATE%20WORKSPACE%20FOR%20FYP/travel-intelligence-backend%20for%20vs%20code%20back%20up%201/travel-intelligence-backend%20for%20vs%20code/app/data_loader.py), and [`app/optimizer.py`](file:///c:/Users/Arslan/Desktop/SEPERATE%20WORKSPACE%20FOR%20FYP/travel-intelligence-backend%20for%20vs%20code%20back%20up%201/travel-intelligence-backend%20for%20vs%20code/app/optimizer.py):

| Field Name | Data Type | Usage in TripNest Pipeline | What Happens If Missing / Invalid |
| :--- | :--- | :--- | :--- |
| **`name`** | `string` | Displayed in itinerary, used for duplicate detection and explanation tags. | POI cannot be identified or displayed. Record must be discarded. |
| **`latitude`** | `float` | Used for spatial filtering, proximity scoring ($S_{\text{prox}}$), clustering, and OSRM TSP routing. | Spatial math fails; OSRM routing errors out. Discard record. |
| **`longitude`** | `float` | Used alongside latitude for all spatial, distance, and routing algorithms. | Spatial math fails; OSRM routing errors out. Discard record. |
| **`province`** | `string` | Primary hard filter in `app/main.py`. Non-matching POIs are dropped before scoring. | POI will never appear in any provincial trip query. |
| **`city`** | `string` | Displayed on UI cards, used for city-level trip matching and search. | Defaults to empty string or province name. |
| **`category`** | `string` | Used for preference similarity scoring ($S_{\text{pref}}$), travel style matching, environment matching, and visit duration lookup. | Falls back to generic "attraction"; scores poorly on preference matching; defaults visit duration to 1.5h. |
| **`rating`** | `float` | Evaluated in $S_{\text{rate}} = \min(1.0, \text{rating} / 5.0)$. Contributes 20% to total recommendation score. | Defaults to `0.0`, unfairly penalizing the place by reducing total score by up to 20 points. |
| **`popularity_score`** | `float` | Evaluated in $S_{\text{pop}} = \min(1.0, \text{popularity} / 10.0)$. Contributes 15% to total recommendation score. | Defaults to `0.0`, reducing total score by up to 15 points. |
| **`importance_level`** | `int` | Evaluated in $S_{\text{imp}} = (\text{importance} - 1.0) / 2.0$. Contributes 10% to total recommendation score. | Defaults to `1` (lowest importance, 0 points bonus). |
| **`average_cost`** / **`cost`** | `float` | Used in hard budget filter, affordability scoring ($S_{\text{afford}}$), and Knapsack budget solver. | Defaults to district baseline (PKR 150–500) or generic fallback (PKR 250). |
| **`visit_duration`** | `float` | Critical for time feasibility constraint: cumulative visit duration cannot exceed `max_travel_hours`. | Deterministically derived from `category` via `get_visit_duration(category)` (1.0h to 3.0h). |

---

## 4. Controlled Category Taxonomy & Engine Mappings

TripNest's recommendation engine contains explicit internal keyword mappings that evaluate category strings. A clean dataset must use category terms that align with these structures:

### A. Travel Style Keyword Mappings (`STYLE_CATEGORY_MAP`)
* **`adventure`:** `scenic`, `mountain`, `valley`, `lake`, `waterfall`, `national park`, `glacier`, `hiking`, `trek`
* **`cultural`:** `historical`, `mosque`, `fort`, `museum`, `tomb`, `temple`, `monument`, `ruins`, `heritage`, `shrine`
* **`relaxation`:** `park`, `lake`, `resort`, `hill station`, `scenic`, `garden`, `beach`

### B. Environment Keyword Mappings (`ENVIRONMENT_CATEGORY_MAP`)
* **`mountains`:** `mountain`, `scenic`, `valley`, `pass`, `glacier`, `peak`, `hill station`
* **`nature`:** `park`, `lake`, `waterfall`, `national park`, `forest`, `scenic`, `valley`
* **`city`:** `urban`, `mall`, `market`, `museum`, `monument`, `food`, `attraction`
* **`historical`:** `historical`, `fort`, `mosque`, `tomb`, `temple`, `ruins`, `monument`, `museum`

### C. Visit Duration Mapping Table (`get_visit_duration`)
* **3.0 Hours:** `mountain`, `trek`, `hiking`
* **2.5 Hours:** `national park`, `valley`, `amusement`, `theme_park`, `water_park`
* **2.0 Hours:** `lake`, `zoo`, `safari`
* **1.5 Hours:** `waterfall`, `museum`, `gallery`, `fort`, `palace`, `market`, `bazaar`, `mall`, `shopping`
* **1.0 Hour:** `park`, `garden`, `playground`, `mosque`, `shrine`, `church`, `temple`, `hill`, `scenic`, `viewpoint`, `monument`, `historical`, `heritage`, `ruins`
* **Fallback Default:** `1.5 Hours` for unknown categories.

### D. Crowd Detection Keywords (`is_crowded_place`)
* `market`, `bazaar`, `mall`, `stadium`, `food street`

---

## 5. Expected Ranges, Formats, and Validations

To prevent runtime exceptions, scoring skew, or infinite loops in the optimizer, datasets must satisfy these validation boundaries:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ATTRIBUTE BOUNDS & FORMAT SPECIFICATION                                     │
├────────────────────┬──────────────┬───────────────┬─────────────────────────┤
│ Field              │ Type         │ Expected Range│ Normalization Required  │
├────────────────────┼──────────────┼───────────────┼─────────────────────────┤
│ Latitude           │ Float (deg)  │ 23.5 to 37.5  │ WGS84 decimal degrees   │
│ Longitude          │ Float (deg)  │ 60.5 to 78.5  │ WGS84 decimal degrees   │
│ Rating             │ Float        │ 0.0 to 5.0    │ Clamped to [0.0, 5.0]   │
│ Popularity Score   │ Float        │ 0.0 to 10.0   │ Clamped to [0.0, 10.0]  │
│ Importance Level   │ Integer      │ 1, 2, or 3    │ 1=Standard, 2=Regional, │
│                    │              │               │ 3=National/UNESCO Anchor│
│ Average Cost (PKR) │ Float        │ >= 0.0        │ Free = 0.0; No negative │
│ Visit Duration     │ Float (hrs)  │ 0.5 to 6.0    │ Realistic single-stop h │
│ Province           │ String       │ Exact List    │ "Punjab", "Sindh",      │
│                    │              │               │ "Khyber Pakhtunkhwa",   │
│                    │              │               │ "Balochistan",          │
│                    │              │               │ "Gilgit-Baltistan",     │
│                    │              │               │ "Azad Kashmir",         │
│                    │              │               │ "Islamabad"             │
└────────────────────┴──────────────┴───────────────┴─────────────────────────┘
```

---

## 6. Field Categorization: Essential vs. Optional

### Essential Fields (Must be present for every record)
1. **`name`** (Non-empty string, min 3 chars)
2. **`latitude`** & **`longitude`** (Valid coordinates inside Pakistan)
3. **`province`** (Standardized province name)
4. **`category`** (Mapped lowercase string)
5. **`average_cost`** / **`cost`** (Numeric value in PKR)
6. **`visit_duration`** (Numeric hours)

### Strongly Recommended Fields (Required for optimal recommendation quality)
1. **`rating`** (Verified average user rating 1.0–5.0)
2. **`rating_count`** (Number of user reviews to compute confidence)
3. **`popularity_score`** (Derived footfall metric 0.0–10.0)
4. **`importance_level`** (Cultural/heritage weight 1, 2, or 3)
5. **`city`** / **`district`** (Local administrative grouping)

### Future / Optional Fields (Graceful Degradation)
1. **`name_ur`** (Urdu name for bilingual display)
2. **`best_season`** (Seasonality tags: `winter`, `spring`, `summer`, `autumn`)
3. **`indoor_outdoor`** (`indoor`, `outdoor`, `mixed`)
4. **`opening_time`** & **`closing_time`** (`HH:MM` format)
5. **`tags`** (Granular activity tags e.g. `['photography', 'family', 'hiking']`)

---

## 7. High-Value Additional Fields (Zero-Refactor Enablers)

These fields can be added to the clean dataset immediately without requiring core code changes, as the existing scoring models and dictionaries can ingest extra metadata fields seamlessly:

1. **`rating_count`:** Allows computing statistical confidence (preventing a place with 1 review of 5.0 stars from outscoring a landmark with 45,000 reviews of 4.8 stars).
2. **`subcategories` (List of strings):** Enforces category diversity during selection (e.g. max 2 museums per day).
3. **`is_verified` (Boolean):** Gives a deterministic 5% score boost to curated national landmarks over raw API POIs.
4. **`indoor_outdoor` (String):** Enables weather-adaptive recommendations during extreme summer heat or monsoon rain.

---

## 8. Exact Target Schema for a Clean TripNest POI Dataset

### A. CSV Target Format (`tripnest_master_pois.csv`)
```csv
id,name,name_ur,city,district,province,latitude,longitude,category,subcategories,rating,rating_count,popularity_score,importance_level,average_cost,visit_duration_hours,best_season,indoor_outdoor,is_verified,source
poi_pun_lah_001,Lahore Fort,شاہی قلعہ,Lahore,Lahore,Punjab,31.5880,74.3152,historical,"fort;monument;unesco",4.6,42500,9.8,3,50,2.5,"winter;spring;autumn",outdoor,true,master_curated
poi_isl_isl_002,Faisal Mosque,فیصل مسجد,Islamabad,Islamabad,Islamabad,33.7294,73.0372,religious,"mosque;monument",4.9,78000,10.0,3,0,1.5,"all",mixed,true,master_curated
poi_kpk_swa_003,Malam Jabba Ski Resort,ملم جبہ,Malam Jabba,Swat,Khyber Pakhtunkhwa,34.7994,72.5714,adventure,"resort;mountain;ski",4.4,12400,8.7,2,500,3.0,"winter;summer",outdoor,true,google_places
```

### B. JSON Target Format (`tripnest_master_pois.json`)
```json
[
  {
    "id": "poi_pun_lah_001",
    "name": "Lahore Fort",
    "name_ur": "شاہی قلعہ",
    "city": "Lahore",
    "district": "Lahore",
    "province": "Punjab",
    "latitude": 31.5880,
    "longitude": 74.3152,
    "category": "historical",
    "subcategories": ["fort", "monument", "unesco"],
    "rating": 4.6,
    "rating_count": 42500,
    "popularity_score": 9.8,
    "importance_level": 3,
    "average_cost": 50.0,
    "visit_duration_hours": 2.5,
    "best_season": ["winter", "spring", "autumn"],
    "indoor_outdoor": "outdoor",
    "is_verified": true,
    "source": "master_curated"
  }
]
```

---

## 9. Compatibility Risks When Merging External Datasets

When integrating external data (Google Places, HOTOSM, Gazetteers), the following risks must be prevented by the cleaning pipeline:

1. **The 0-Rating Score Distortion Risk:**
   * *Problem:* Ingesting OSM POIs with missing ratings sets `rating = 0.0`. In `app/recommendation.py`, rating contributes 20% of the total score. A world-class unrated viewpoint would lose 20 full points and be discarded.
   * *Mitigation:* Unrated places must receive a normalized baseline rating ($3.5/5.0 \implies 0.70$) rather than $0.0$.

2. **The Synthetic Cost Distortion Risk:**
   * *Problem:* Raw API datasets do not contain ticket entrance costs. Assigning a generic fallback of PKR 2,000 causes budget-conscious trips (e.g. PKR 3,000 budget) to reject all places after selecting only 1 item.
   * *Mitigation:* Maintain verified curated costs for master monuments (e.g. Lahore Fort = 50 PKR, Faisal Mosque = 0 PKR) and realistic district admission defaults (PKR 100–250).

3. **The Preemption Bug Risk (Forensic Audit Finding):**
   * *Problem:* Loading an incomplete small dataset first (e.g. 36-row `v2.xlsx`) causes `load_master_dataset()` to exit early, ignoring the 524 curated destinations.
   * *Mitigation:* Ingestion must merge into a single unified authoritative dataset where the 524 curated records have absolute precedence.

4. **Duplicate Entity Duplication in Itinerary:**
   * *Problem:* `Lahore Fort` (from curated master) and `Shahi Qila Lahore` (from Google Places) are $80\text{m}$ apart. Without spatial deduplication, the optimizer will schedule both on the same day, causing the user to visit the same attraction twice.
   * *Mitigation:* Deduplicate using a 300m spatial proximity radius + fuzzy name matching, giving priority to the curated record.

5. **Commercial Non-Tourist Noise Ingestion:**
   * *Problem:* HOTOSM contains 3,500 bank branches, 3,193 schools, and 2,609 fuel stations. Ingesting raw files causes the engine to recommend ATMs and high schools as tourist stops.
   * *Mitigation:* Apply strict category inclusion whitelists.

---

## 10. Verification of Safety & Non-Modification

* **TripNest Source Code Files Modified:** `0`
* **Dataset Files Modified / Overwritten:** `0`
* **MongoDB Database Modifications:** `0`
* **LAB / Optimization Engine LAB Files Modified:** `0`
* **Backup Files Modified:** `0`
* **Frontend / UI Changes:** `0`
* **Backend Runtime Status:** Active, stable, all 11 backend unit and integration tests passing.

---
*Report Generated for TripNest Engineering Architecture Review.*
