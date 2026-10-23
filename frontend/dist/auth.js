"use strict";
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authTitle = document.getElementById("authTitle");
const authMessage = document.getElementById("authMessage");
const authSubmit = document.getElementById("authSubmit");
const authToggle = document.getElementById("authToggle");
const authError = document.getElementById("authError");
let authMode = "login";
// If already logged in, go straight to the app.
if (sessionStorage.getItem("nelveToken")) {
    window.location.replace("index.html");
}
authToggle.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    authTitle.textContent =
        authMode === "login" ? "Welcome to Nelve" : "Create your account";
    authMessage.textContent =
        authMode === "login"
            ? "Sign in to discover places tailored to you."
            : "Join Nelve to discover places matched to your vibe.";
    authSubmit.textContent =
        authMode === "login" ? "Log in" : "Sign up";
    authToggle.textContent =
        authMode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Log in";
    authPassword.autocomplete =
        authMode === "login" ? "current-password" : "new-password";
    authError.hidden = true;
});
authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    authError.hidden = true;
    authSubmit.disabled = true;
    try {
        const endpoint = authMode === "login" ? "/login" : "/register";
        const response = await fetch(`http://localhost:3000${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: authEmail.value.trim(),
                password: authPassword.value,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Authentication failed");
        }
        if (typeof data.token !== "string" || !data.token) {
            throw new Error("The server did not return a valid login token.");
        }
        sessionStorage.setItem("nelveToken", data.token);
        // Navigate only after authentication succeeds.
        window.location.replace("index.html");
    }
    catch (error) {
        authError.textContent =
            error instanceof Error ? error.message : "Something went wrong";
        authError.hidden = false;
    }
    finally {
        authSubmit.disabled = false;
    }
});
//# sourceMappingURL=auth.js.map