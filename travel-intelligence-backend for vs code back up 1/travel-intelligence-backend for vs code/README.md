# Travel Intelligence Backend

Layered travel optimization system.
TRAE AI PROJECT COMMAND DOCUMENT
📌 PROJECT TITLE

Spatially Cohesive Multi-Constraint Travel Optimization Engine
(Final Year Project – Computer Science)

🎯 PROJECT CORE OBJECTIVE

Build a backend-driven intelligent travel itinerary generation system that:

Selects optimal tourist locations under budget constraint

Optimizes route using TSP heuristic

Accounts for visit duration + travel time

Maximizes user satisfaction score

Supports weighted user preferences

Produces structured itinerary output (not text paragraphs)

This is NOT a booking platform.
This is NOT a static listing app.
This is NOT a simple recommendation system.

This is a constrained optimization engine.

🧠 SYSTEM PHILOSOPHY

Architecture > UI
Mathematics > Cosmetics
Optimization > CRUD

The backend logic is the core contribution.

Frontend is secondary and must reflect backend intelligence.

🏗 CURRENT ARCHITECTURE (DO NOT BREAK)
Backend Stack

Python

FastAPI

Modular structure

Heuristic selection algorithm

Nearest Neighbor TSP

Haversine distance

Utility-based evaluation

📦 CURRENT PROJECT STRUCTURE
travel-intelligence-backend/
│
├── app/
│   ├── main.py
│   ├── data_loader.py
│   ├── constraints.py
│   ├── optimizer.py
│   ├── utils.py
│
├── data/
│   ├── travel_intelligence_dataset_v2.xlsx
│
├── requirements.txt
└── README.md
🔬 OPTIMIZATION PIPELINE

Load dataset

Filter by province

Apply preference boosting

Spatial + Budget selection (greedy cohesive heuristic)

Route optimization (TSP)

Travel time + visit time calculation

Hard max_travel_hours constraint validation

Utility calculation

Return structured itinerary

📐 MATHEMATICAL MODEL
Selection Utility (Marginal)

marginal_utility =
score_weight × score
− cost_weight × cost
− α × normalized_spatial_distance

Subject to:

cost ≤ remaining_budget

Travel Time

travel_time = total_distance / 40 km/h

Total Time

total_time = travel_time + Σ visit_duration

Constraint:
total_time ≤ max_travel_hours

Final Utility

U =
score_weight × total_score
− time_weight × total_time
− cost_weight × total_cost

❌ WHAT TRAE AI MUST NOT DO

Do NOT replace selection with random ML

Do NOT replace routing with external APIs

Do NOT redesign architecture

Do NOT merge selection + routing into single black-box

Do NOT turn this into booking CRUD system

Do NOT remove utility formula

Do NOT remove spatial cohesion logic

Do NOT introduce unnecessary OR-Tools unless explicitly asked

Do NOT simplify optimization logic

This is an optimization research project.

✅ WHAT TRAE AI IS ALLOWED TO DO

Improve code structure

Improve folder organization

Improve error handling

Improve API validation

Improve documentation

Improve test coverage

Add logging

Add explainability layer

Improve dataset integration

Build frontend that reflects optimization output

Create GitHub workflow

Add containerization (optional)

📊 DATASET UPGRADE TASK

We are migrating from old CSV to:

travel_intelligence_dataset_v2.xlsx

New dataset includes:

name

province

city

category

latitude

longitude

average_cost

visit_duration

peak_season

safety_rating

transport_access

popularity_score

Task:

Map dataset to internal location structure:

{
    name,
    lat,
    lon,
    category,
    score,
    cost,
    visit_duration,
    province
}

Score should incorporate:

popularity_score

category weight

optional safety influence

Cost should use:

average_cost directly

Visit duration should use:

visit_duration column directly

Province should use:

province column directly (no more district hack)

🚀 NEXT DEVELOPMENT PHASES
Phase 1 (Immediate)

Integrate v2 dataset

Keep architecture intact

Validate optimization behavior

Ensure province filtering works properly

Ensure budget + time constraints behave realistically

Phase 2

Integrate time constraint into selection layer

Improve cohesion penalty normalization

Improve utility explanation output

Phase 3

Multi-day itinerary extension

Context-aware seasonal scoring

Preference weight UI sliders

Explainable optimization breakdown

Phase 4

Flutter or React frontend

Map visualization

Route drawing

Real-time replanning capability

🎓 FYP DEFENSE POSITIONING

This project demonstrates:

Combinatorial optimization

Heuristic design

Multi-objective scalarization

Route optimization (TSP)

Context-aware scoring

Modular backend design

Scalable architecture

It is NOT a generic travel app.

It is an optimization engine with extendable intelligence.

🧭 WORKING MODE INSTRUCTIONS FOR TRAE AI

When making changes:

Preserve modular separation

Preserve function signatures

Preserve utility formula

Preserve optimization logic

Avoid drastic redesign

Always propose changes before implementing major structural shifts.

🧠 IMPORTANT FINAL INSTRUCTION

The developer values:

Structured evolution

Mathematical clarity

Stability

Architectural integrity

Research-level depth

Avoid beginner-level simplifications.

Focus on system-level engineering.

🔒 FINAL CONTROL STATEMENT

This project must evolve incrementally.

No full rewrites.

No drastic paradigm shifts.

Optimization core is sacred.

Now listen carefully.

When you paste this into Trae AI:

Paste this document.

Then paste your current backend code.

Then say:

“Integrate v2 dataset safely without breaking optimization pipeline.”

Do NOT immediately ask it to redesign frontend.

Control the direction.