
const locationInput = document.getElementById("location") as HTMLInputElement;
const vibeInput = document.getElementById("vibe") as HTMLInputElement;
const searchButton = document.getElementById("searchBtn") as HTMLButtonElement;
const savedPlacesBtn = document.getElementById("savedPlacesBtn") as HTMLButtonElement;
const resultsList = document.getElementById("results") as HTMLUListElement;
const validationError = document.getElementById(
  "validationError"
) as HTMLParagraphElement;
const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;

// Authentication is handled by authentication.html and auth.ts.
const token = sessionStorage.getItem("nelveToken");

if (!token) {
  window.location.replace("authentication.html");
}

async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!token) {
    throw new Error("Please log in to continue.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

const savedPlaceIds = new Set<number>();
let showingSavedPlaces = false;

//const userId = 1;

let userFeedback = new Map<number, boolean>();

const viewedPlaceIds = new Set<number>(
  JSON.parse(sessionStorage.getItem("nelveViewedPlaces") || "[]")
);

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("nelveToken");
  window.location.replace("authentication.html");
});

async function refreshSavedPlaceIds() {
  const response = await authenticatedFetch(
    `https://nelve-ai.onrender.com/saved-places`
  );

  if (!response.ok) {
  const errorText = await response.text();
  console.error("Saved places error:", response.status, errorText);
  throw new Error(`Failed to load saved places: ${response.status}`);
  }

  const places = await response.json();

  savedPlaceIds.clear();

  for (const place of places) {
    savedPlaceIds.add(Number(place.id));
  }

  return places;
}

function renderPlaces(places: any[]) {
  resultsList.innerHTML = "";

  for (const p of places) {
    const li = document.createElement("li");
    li.className = "place-card";

    const info = document.createElement("div");
    info.className = "place-info";

    const name = document.createElement("span");
    name.className = "place-name";
    name.textContent = p.name;

    info.appendChild(name);
    const description = document.createElement("p");
    description.className = "place-description";
    description.textContent =
    p.description || "No description available.";
    description.hidden = true;

    info.appendChild(description);

    if (p.distanceMiles != null) {
      const distance = document.createElement("span");
      distance.className = "place-distance";

      const miles = Number(p.distanceMiles);

      distance.textContent =
        `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;

      info.appendChild(distance);
    }

    // Search results may have a match score; saved places may not.
    if (p.match != null) {
      const match = document.createElement("span");
      match.className = "place-match";
      // match.textContent = `match: ${(p.match * 100).toFixed(0)}%`;
      // info.appendChild(match);
    }

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "6px";

    const likeBtn = document.createElement("button");
    likeBtn.className = "like-btn";
    likeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 10v12H3V10h4ZM7 10l4-8c2 0 3 2 2 4l-1 4h6a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7"
          fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    likeBtn.title = "Like";
    likeBtn.setAttribute("aria-label", `Like ${p.name}`);

    const dislikeBtn = document.createElement("button");
    dislikeBtn.className = "dislike-btn";
    dislikeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <g transform="translate(24 24) rotate(180)">
          <path d="M7 10v12H3V10h4ZM7 10l4-8c2 0 3 2 2 4l-1 4h6a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7"
            fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>
    `;
    dislikeBtn.title = "Dislike";
    dislikeBtn.setAttribute("aria-label", `Dislike ${p.name}`);
    const previousFeedback = userFeedback.get(Number(p.id));

    if (previousFeedback === true) {
      likeBtn.classList.add("liked");
    } else if (previousFeedback === false) {
      dislikeBtn.classList.add("disliked");
    }

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-btn";
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"
          fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    function updateSaveButton() {
      const isSaved = savedPlaceIds.has(Number(p.id));

      saveBtn.classList.toggle("saved", isSaved);
      saveBtn.title = isSaved ? "Unsave place" : "Save place";
      saveBtn.setAttribute(
        "aria-label",
        isSaved ? `Unsave ${p.name}` : `Save ${p.name}`
      );
    }

    updateSaveButton();

    async function sendFeedback(liked: boolean) {
      const button = liked ? likeBtn : dislikeBtn;
      const className = liked ? "liked" : "disliked";

      // Clicking the selected button again clears the feedback.
      const wasSelected = button.classList.contains(className);
      const newLiked = wasSelected ? null : liked;

      try {
        const response = await authenticatedFetch(
          "https://nelve-ai.onrender.com/feedback",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              
              placeId: p.id,
              liked: newLiked,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Feedback request failed");
        }

        // Clear both selections before applying the new one.
        likeBtn.classList.remove("liked");
        dislikeBtn.classList.remove("disliked");

        if (newLiked === true) {
          likeBtn.classList.add("liked");
        } else if (newLiked === false) {
          dislikeBtn.classList.add("disliked");
        }

        if (newLiked === null) {
          userFeedback.delete(Number(p.id));
        } else {
          userFeedback.set(Number(p.id), newLiked);
        }
      } catch (error) {
        console.error(error);
        alert("Couldn't record feedback. Please try again.");
      }
    }

    likeBtn.addEventListener("click", () => sendFeedback(true));
    dislikeBtn.addEventListener("click", () => sendFeedback(false));

    saveBtn.addEventListener("click", async () => {
      const isSaved = savedPlaceIds.has(Number(p.id));

      try {
        const response = await authenticatedFetch(
          "https://nelve-ai.onrender.com/saved-places",
          {
            method: isSaved ? "DELETE" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
             
              placeId: p.id,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Save toggle failed");
        }

        if (isSaved) {
          savedPlaceIds.delete(Number(p.id));
        } else {
          savedPlaceIds.add(Number(p.id));
        }

        updateSaveButton();

        if (isSaved && showingSavedPlaces) {
          li.remove();

          if (resultsList.children.length === 0) {
            resultsList.innerHTML =
              '<li class="loading">No saved places yet.</li>';
          }
        }
      } catch (error) {
        console.error(error);
        alert("Couldn't update this saved place. Please try again.");
      }
    });

    btnGroup.appendChild(likeBtn);
    btnGroup.appendChild(dislikeBtn);
    btnGroup.appendChild(saveBtn);

    
li.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;

  if (target.closest("button")) {
    return;
  }

  // Always allow the description to expand or collapse.
  description.hidden = !description.hidden;

  const placeId = Number(p.id);

  // Only record the first view of this place in this session.
  if (viewedPlaceIds.has(placeId)) {
    return;
  }

  viewedPlaceIds.add(placeId);

  sessionStorage.setItem(
    "nelveViewedPlaces",
    JSON.stringify([...viewedPlaceIds])
  );

  authenticatedFetch("https://nelve-ai.onrender.com/view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId: p.id }),
  }).catch(console.error);
});


    li.appendChild(info);
    li.appendChild(btnGroup);
    resultsList.appendChild(li);
  }
}

savedPlacesBtn.addEventListener("click", async () => {
  try {
    showingSavedPlaces = true;

    const places = await refreshSavedPlaceIds();

    renderPlaces(places);

    if (places.length === 0) {
      resultsList.innerHTML =
        '<li class="loading">No saved places yet.</li>';
    }
  } catch (error) {
    console.error(error);
    alert("Couldn't load saved places. Is the backend running?");
  }
});

function validateInputs(): boolean {
  const loc = locationInput.value.trim();
  const q = vibeInput.value.trim();

  if (!loc && !q) {
    validationError.textContent = "Please enter location and vibe";
    validationError.hidden = false;
    return false;
  }

  if (!loc) {
    validationError.textContent = "Please enter location";
    validationError.hidden = false;
    return false;
  }

  if (!q) {
    validationError.textContent = "Please enter vibe";
    validationError.hidden = false;
    return false;
  }

  validationError.hidden = true;
  validationError.textContent = "";
  return true;
}

// Update validation messages as the user corrects their inputs.
locationInput.addEventListener("input", () => {
  if (!validationError.hidden) {
    validateInputs();
  }
});

vibeInput.addEventListener("input", () => {
  if (!validationError.hidden) {
    validateInputs();
  }
});

searchButton.addEventListener("click", async () => {
  if (!validateInputs()) {
    return;
  }

  try {
    const loc = locationInput.value.trim();
    const q = vibeInput.value.trim();

    const url =
      `https://nelve-ai.onrender.com/search?location=${encodeURIComponent(loc)}` +
      `&q=${encodeURIComponent(q)}`;

    const response = await authenticatedFetch(url);

    if (!response.ok) {
      throw new Error("Search failed");
    }

    const places = await response.json();

    await refreshSavedPlaceIds();
    showingSavedPlaces = false;
    const feedbackResponse = await authenticatedFetch(
  "https://nelve-ai.onrender.com/feedback"
);

  if (!feedbackResponse.ok) {
    throw new Error("Couldn't load your feedback");
  }

  const feedbackRows = await feedbackResponse.json();

  userFeedback = new Map<number, boolean>(
    feedbackRows.map((row: { placeId: number; liked: boolean }) => [
      Number(row.placeId),
      row.liked,
    ])
  );


  renderPlaces(places);
  } catch (error) {
    console.error(error);
    alert("Couldn't search for places. Is the backend running?");
  }
});
