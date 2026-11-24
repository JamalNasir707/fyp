🧭 Constraint-Aware Hybrid Tourism Planning System

A layered, multi-objective travel planning engine that integrates personalized recommendation with mathematical optimization and adaptive itinerary recomputation.

📌 Overview

Traditional travel recommendation systems suggest places.

This system goes further.

It treats travel planning as a constrained optimization problem, not just a recommendation task.

Instead of generating text suggestions, the system:

Selects relevant attractions

Computes optimal visiting sequence (TSP)

Optimizes cost and time constraints

Structures multi-day itineraries

Recomputes plans when user constraints change

This creates a mathematically grounded, adaptive tourism planning engine.

🧠 Core Idea

Travel planning consists of multiple independent layers:

Selection Problem – Which places match the user?

Sequencing Problem – In what order should they be visited?

Constraint Problem – Budget and time limitations

Optimization Problem – Minimize distance & cost, maximize satisfaction

Adaptation Problem – Recompute when user preferences change

Most systems solve only Layer 1.

This system integrates all five.

🏗 System Architecture

1️⃣ Personalization Layer

Collects structured user input:

Budget

Duration

Interests

Travel style

Converts responses into numerical preference vectors.

Solves cold-start problem via structured modeling.

2️⃣ Recommendation Layer

Content-based filtering

Hybrid scoring logic

Candidate ranking generation

Output: Ranked list of relevant attractions.

This layer selects — it does not sequence.

3️⃣ Optimization Layer (TSP-Based Routing)

Given selected attractions:

Applies Traveling Salesman Problem (TSP) formulation.

Uses Google OR-Tools routing solver.

Minimizes total travel distance.

This transforms recommendation into structured planning.

4️⃣ Multi-Objective Optimization

Objective Function:

Minimize:

Total travel distance

Total cost

Maximize:

Preference satisfaction score

Formulated as a weighted multi-objective optimization problem.

5️⃣ Itinerary Structuring Layer

Applies daily time constraints

Incorporates visit duration per attraction

Distributes attractions across available days

Generates structured daily schedule

Output format:

Day 1

• 09:00 – Attraction A

• 12:00 – Attraction B

• 15:30 – Attraction C

6️⃣ Adaptive Replanning Engine

When user:

Removes an attraction

Adjusts budget

Changes duration

System:

Re-runs optimization

Recomputes route

Regenerates structured itinerary

This enables controlled agentic behavior.

🆚 Difference from LLM-Based Systems

Large Language Models:

Generate probabilistic text

Do not guarantee optimal routes

Do not solve constraint satisfaction mathematically

This system:

Defines explicit objective functions

Applies constraint solvers

Produces deterministic optimized results

Guarantees shortest-path computation (within model constraints)

🧪 Technologies Used

Backend

Python

FastAPI / Flask

Google OR-Tools

NumPy / Pandas

PostgreSQL / Firebase

Frontend

Flutter

REST API integration

Google Maps SDK

State management (Provider / Riverpod)

📊 Mathematical Formulation

Let:

( D ) = total travel distance

( C ) = total trip cost

( S ) = satisfaction score

Objective:

Minimize:

αD + βC − γS

Subject to:

Budget constraint

Daily time constraint

Visit duration constraints

🚀 Key Features

✔ Cold-start personalization

✔ Hybrid recommendation

✔ TSP-based route optimization

✔ Multi-objective constraint modeling

✔ Structured itinerary generation

✔ Adaptive recomputation

✔ Deterministic optimization backbone

📱 Application Flow

User inputs travel constraints.

System generates ranked attractions.

Optimization engine computes best visiting order.

Multi-day itinerary is structured.

User edits trigger automatic recomputation.

🎯 Research Contribution

This project demonstrates integration of:

Recommender Systems

Operations Research

Multi-objective Optimization

Constraint Satisfaction

Adaptive Planning Systems

It bridges machine learning with mathematical optimization for tourism planning.

📌 Future Enhancements

Real-time traffic integration

Weather-aware route adaptation

Reinforcement learning for dynamic weight tuning

Group preference aggregation modeling

Real-time pricing updates

📄 License

This project is developed for academic and research purposes.

If you'd like, I can now:

Make a short industry-style README

Make a research paper abstract

Or create a system architecture diagram explanation section

What do you need next?
