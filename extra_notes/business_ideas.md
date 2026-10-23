Good instinct — a clean outline is worth having, both for your own clarity and if you ever need to explain this in an interview. Here's a v1 product spec pulled from everything actually built and decided tonight:

---

**Nomad — v1 Product Outline**

**One-liner:** Vibe-based discovery of lesser-known historic/cultural places, with a feedback loop that personalizes future recommendations.

**Core loop:**
1. User enters a location + a vibe
2. App returns matching places, ranked by semantic similarity (not keyword match)
3. Optional toggle: rank least-known-first instead of best-match-first
4. User likes/dislikes results
5. Feedback improves future "Recommended for you" results

**What's built (v1, working):**
- Database: Postgres + pgvector, 4 tables (`users`, `places`, `user_feedback`, `saved_places`)
- Recommendation engine: local embedding model (`all-MiniLM-L6-v2`) turns vibe text and place descriptions into vectors, ranked by cosine similarity
- Backend (Express/TS): `/search`, `/feedback`, `/profile/:userId`, `/recommendations/:userId`
- Frontend: plain TypeScript + HTML, styled card UI, thumbs up/down feedback buttons
- Data: 80 real places hand-curated across 11 cities (historic sites, nature spots, hidden cultural landmarks — explicitly not restaurants/cafes, to stay differentiated from generic discovery apps)

**Scope boundaries (decided deliberately):**
- Historic/cultural/nature only — not a general place-discovery app (that space is crowded: Google Maps, Yelp, TripAdvisor)
- No live data-fetching yet — seed data is hand-curated after Overpass/Wikipedia/Wikivoyage APIs proved unreliable
- Single hardcoded test user — no real auth yet

**Known next steps, not yet built:**
- User-submitted places (lets the dataset grow without manual curation)
- More cities / broader categories
- Real authentication
- Mobile frontend
- Richer ranking factors (safety, historical significance as separate signals) — flagged as a real ML modeling problem, not a quick add

---

Want me to save this as the canonical outline, replacing the scattered notes in `/areas/business-ideas.md`?
---------------------------------------------------------------------------------------------------------------------

you can always be improving the product so having an ongoing thing is always beneficial.