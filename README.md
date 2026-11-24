# Nelve AI

Place discovery based on your mood. Tell Nelve how you feel and where you are, and it recommends places that fit.

Live: https://fascinating-pastelito-e2859e.netlify.app/authentication.html (landing page: https://spot-discover-engine.lovable.app)

## What it does

- Takes a **mood + location** and returns matching place recommendations.
- Learns from your **likes, dislikes and views**, so results get more personal over time.
- Shows **driving distances** to each recommended place.

## Demo of the application  

<div style="position: relative; padding-bottom: 53.125%; height: 0;"><iframe src="https://www.loom.com/embed/4784a192ea5241c6a77d26d8e62b6507" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>


## How the AI/ML works

Nelve is a content-based recommender built on semantic search.

1. **Embeddings:** `all-MiniLM-L6-v2` (via `@xenova/transformers`) turns place descriptions and your query into 384-dim vectors. It runs inside the Node backend, with no external API.
2. **Vector search:** vectors are stored in Postgres with `pgvector`. Places closest to your query (cosine similarity) are returned.
3. **Personalization:** your query vector is blended with your history. Likes pull results closer, dislikes push them away, and views count as a weaker signal.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend / landing page | Lovable |
| Backend | Express + TypeScript |
| Database | Postgres + pgvector |
| Auth | JWT + bcrypt |
| Embeddings | @xenova/transformers (all-MiniLM-L6-v2) |
| Geocoding | Nominatim |
| Driving distances | OpenRouteService |
| Hosting | Render |

## Request flow

1. User sends a mood + location.
2. Location is geocoded with Nominatim.
3. The mood text is embedded into a vector.
4. The vector is adjusted using the user's like/dislike/view history.
5. pgvector returns the nearest places.
6. OpenRouteService adds driving distances.
7. Results are sent back to the user.

## Getting started

```bash
git clone <your-repo-url>
cd <repo-folder>
npm install
```

Create a `.env` file:

```env
DATABASE_URL=postgres://user:password@localhost:5432/nelve
JWT_SECRET=your_secret
ORS_API_KEY=your_openrouteservice_key
```

Run the backend:

```bash
npm run dev
```

> Postgres needs the `pgvector` extension enabled: `CREATE EXTENSION vector;`

## Limitations

- Recommendation quality depends on the quality of the place descriptions.
- Little history for new users means results are mostly query-driven at first.

## Roadmap

- Add a reranking step for better result ordering.
- Add evaluation of recommendation quality.

## Author

Built by [miacodehub](https://github.com/miacodehub)
