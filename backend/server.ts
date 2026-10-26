
import express from "express";
import { Pool } from "pg";
import cors from "cors";
import "dotenv/config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


const app = express();
app.use(cors());
app.use(express.json());

/*
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
});
*/
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("Missing JWT_SECRET in .env");
}

// Register a new user
app.post("/register", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = req.body.password;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      [email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: "7d",
    });

    return res.status(201).json({
      message: "Account created",
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "An account with this email already exists",
      });
    }

    console.error("Registration error:", error);
    return res.status(500).json({ error: "Couldn't create account" });
  }
});

// Log in an existing user
app.post("/login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = req.body.password;

  if (!email || typeof password !== "string") {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash
       FROM users
       WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (
      !user ||
      !user.password_hash ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: "7d",
    });

    return res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Couldn't log in" });
  }
});


// MIDDLEWARE

function authenticateToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Please log in" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret!) as jwt.JwtPayload;

    if (typeof payload.userId !== "number") {
      return res.status(401).json({ error: "Invalid login token" });
    }

    res.locals.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired login token" });
  }
}



// the RECOMMENDATION engine so to speak
import { pipeline } from "@xenova/transformers";

let embedder: any;


async function getEmbedder() {
  if (!embedder) embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return embedder;
}

async function geocode(placeName: string) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`,
    { headers: { "User-Agent": "nomad-app" } }
  );
  const data = await res.json();
  if (data.length === 0) throw new Error("place not found");
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function getDrivingDistances(
  origin: { lat: number; lng: number },
  destinations: { lat: number; lng: number }[]
): Promise<(number | null)[]> {
  if (destinations.length === 0) return [];

  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ORS_API_KEY in .env");
  }

  const locations = [
    [origin.lng, origin.lat],
    ...destinations.map((place) => [place.lng, place.lat]),
  ];

  const response = await fetch(
    "https://api.openrouteservice.org/v2/matrix/driving-car",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locations,
        sources: [0],
        destinations: destinations.map((_, index) => index + 1),
        metrics: ["distance"],
        units: "mi",
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouteService error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  return data.distances[0].map(
    (distance: number | null) => distance
  );
}

function distanceInMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMiles *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


app.get("/search", authenticateToken, async (req, res) => {
  const location = String(req.query.location ?? "");
  const q = String(req.query.q ?? "");
  //const leastKnown = req.query.leastKnown === "true";
  const userId = res.locals.userId as number;
  let latFilter = "";
  let origin: { lat: number; lng: number } | null = null;
  let params: any[] = [];

  if (location) {
    const { lat, lng } = await geocode(location);
    origin = { lat, lng };

    const degrees = 2;
    latFilter = "WHERE lat BETWEEN $2 AND $3 AND lng BETWEEN $4 AND $5";
    params = [lat - degrees, lat + degrees, lng - degrees, lng + degrees];
  }

  const embed = await getEmbedder();
  const output = await embed(q, { pooling: "mean", normalize: true });
  let queryVector = Array.from(output.data) as number[];

  // blend in user's like history, if any
  
  // Use the user's feedback to personalize the search vector.
  // Keep only the latest signal per place and signal type.
  const feedback = await pool.query(
    `SELECT DISTINCT ON (f.place_id, f.signal_type)
       p.embedding, f.liked, f.signal_type
     FROM user_feedback f
     JOIN places p ON p.id = f.place_id
     WHERE f.user_id = $1
     ORDER BY f.place_id, f.signal_type, f.created_at DESC`,
    [userId]
  );

  const likes = feedback.rows.filter(
    (r) => r.signal_type !== "view" && r.liked === true
  );

  const dislikes = feedback.rows.filter(
    (r) => r.signal_type !== "view" && r.liked === false
  );

  const views = feedback.rows.filter(
    (r) => r.signal_type === "view"
  );

  // Average the embeddings for each type of feedback.
  const averageVector = (rows: any[]): number[] | null => {
    if (rows.length === 0) return null;

    const vectors = rows.map(
      (r) => JSON.parse(r.embedding) as number[]
    );

    return queryVector.map(
      (_, i) =>
        vectors.reduce((sum, vector) => sum + vector[i], 0) /
        vectors.length
    );
  };

  const avgLikes = averageVector(likes);
  const avgDislikes = averageVector(dislikes);
  const avgViews = averageVector(views);

  // Keep the search query dominant, reward likes, weakly reward views,
  // and move away from places similar to disliked places.
  queryVector = queryVector.map((value, i) => {
    let adjusted = value * 0.7;

    if (avgLikes) adjusted += avgLikes[i] * 0.3;
    if (avgViews) adjusted += avgViews[i] * 0.09;
    if (avgDislikes) adjusted -= avgDislikes[i] * 0.25;

    return adjusted;
  });


  const vectorParam = JSON.stringify(queryVector);
  params.unshift(vectorParam);

  const orderBy =  "embedding <=> $1";
  // leastKnown ? "popularity ASC" :
  const result = await pool.query(
    `SELECT id, name, description, lat, lng, popularity, 1 - (embedding <=> $1) AS match
     FROM places ${latFilter} ORDER BY ${orderBy} LIMIT 10`,
    params
  );


let places = result.rows.map((place: any) => ({
  ...place,
  distanceMiles: null as number | null,
}));

if (origin && places.length > 0) {
  const distances = await getDrivingDistances(
    origin,
    places.map((place: any) => ({
      lat: Number(place.lat),
      lng: Number(place.lng),
    }))
  );

  places = places.map((place: any, index: number) => ({
    ...place,
    distanceMiles: distances[index],
  }));
}

res.json(places);
});





// feedback endpoint
//enter feedback into places/user table


app.post("/feedback", authenticateToken, async (req, res) => {
  const userId = res.locals.userId as number;
  const { placeId, liked } = req.body;

  try {
    // If the user deselects Like/Dislike, clear their explicit feedback.
    if (liked === null) {
      await pool.query(
        `DELETE FROM user_feedback
         WHERE user_id = $1
           AND place_id = $2
           AND signal_type = 'explicit'`,
        [userId, placeId]
      );

      return res.json({ ok: true });
    }

    // Replace the user's previous explicit feedback for this place.
    await pool.query(
      `DELETE FROM user_feedback
       WHERE user_id = $1
         AND place_id = $2
         AND signal_type = 'explicit'`,
      [userId, placeId]
    );

    await pool.query(
      `INSERT INTO user_feedback (user_id, place_id, liked, signal_type)
       VALUES ($1, $2, $3, 'explicit')`,
      [userId, placeId, liked]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Feedback error:", error);
    res.status(500).json({ error: "Couldn't record feedback" });
  }
});

// Retrieve the logged-in user's explicit likes and dislikes.
app.get("/feedback", authenticateToken, async (req, res) => {
  const userId = res.locals.userId as number;

  try {
    const result = await pool.query(
      `SELECT place_id AS "placeId", liked
       FROM user_feedback
       WHERE user_id = $1
         AND signal_type = 'explicit'
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Feedback retrieval error:", error);
    res.status(500).json({ error: "Couldn't retrieve feedback" });
  }
});


app.post("/view", authenticateToken, async (req, res) => {
  const userId = res.locals.userId as number;
  const { placeId } = req.body;

  if (!placeId) {
    return res.status(400).json({ error: "placeId is required" });
  }

  try {
    await pool.query(
      `INSERT INTO user_feedback (user_id, place_id, liked, signal_type)
       VALUES ($1, $2, NULL, 'view')
       ON CONFLICT DO NOTHING`,
      [userId, placeId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("View tracking error:", error);
    res.status(500).json({ error: "Couldn't record place view" });
  }
});



// return saved places
app.get("/profile/:userId", authenticateToken, async (req, res) => {
  const userId = res.locals.userId as number;

  const liked = await pool.query(
    `SELECT p.name, p.description FROM user_feedback f
     JOIN places p ON p.id = f.place_id
     WHERE f.user_id = $1 AND f.liked = true`,
    [userId]
  );

  res.json({ liked: liked.rows });
});

app.get("/recommendations/:userId", authenticateToken, async (req, res) => {
  const userId = res.locals.userId as number;

  const liked = await pool.query(
    `SELECT embedding FROM user_feedback f
     JOIN places p ON p.id = f.place_id
     WHERE f.user_id = $1 AND f.liked = true`,
    [userId]
  );

  if (liked.rows.length === 0) {
    return res.json({ message: "no liked places yet" });
  }

  const vectors = liked.rows.map((r) => JSON.parse(r.embedding));
  const avg = vectors[0].map(
    (_: number, i: number) => vectors.reduce((sum, v) => sum + v[i], 0) / vectors.length
  );

  const result = await pool.query(
    `SELECT name, description, popularity, 1 - (embedding <=> $1) AS match
     FROM places ORDER BY embedding <=> $1 LIMIT 10`,
    [JSON.stringify(avg)]
  );

  res.json(result.rows);
});


// Save a place
app.post("/saved-places", authenticateToken, async (req, res) => {
  const userId = res.locals.userId as number;
  const { placeId } = req.body;

  try {
    await pool.query(
   `INSERT INTO saved_places (user_id, place_id)
    SELECT $1, $2
    WHERE NOT EXISTS (
    SELECT 1 FROM saved_places
    WHERE user_id = $1 AND place_id = $2);`,
      [userId, placeId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error saving place:", error);
    res.status(500).json({ error: "Failed to save place" });
  }
});

// Retrieve saved places
app.get("/saved-places", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.lat, p.lng,
              p.tags, p.popularity
       FROM saved_places s
       JOIN places p ON p.id = s.place_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
       [res.locals.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving saved places:", error);
    res.status(500).json({ error: "Failed to retrieve saved places" });
  }
});

app.listen(3000, () => console.log("running on https://nelve-ai.onrender.com"));



app.delete("/saved-places", authenticateToken, async (req, res) => {
  const userId = res.locals.userId as number;
  const { placeId } = req.body;

  try {
    await pool.query(
      `DELETE FROM saved_places
       WHERE user_id = $1 AND place_id = $2`,
      [userId, placeId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error removing saved place:", error);
    res.status(500).json({ error: "Failed to remove saved place" });
  }
});
