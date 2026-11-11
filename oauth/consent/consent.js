import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://sxwsoslpymbfwotvtrgl.supabase.co",
  "sb_publishable_tAaqXngWru59zAnvkxPwbQ_RvJII5VT",
  { auth: { autoRefreshToken: true, detectSessionInUrl: true, persistSession: true } },
);

const AUTHORIZATION_ID_KEY = "bloom_authorization_id";
const PENDING_LOGIN_KEY = "bloom_authorization_login_method";
const url = new URL(location.href);
const authorizationId = url.searchParams.get("authorization_id") ??
  sessionStorage.getItem(AUTHORIZATION_ID_KEY);
const heading = document.querySelector("#page-title");
const status = document.querySelector("#status");
const loginMethods = document.querySelector("#login-methods");
const googleLogin = document.querySelector("#google-login");
const emailLogin = document.querySelector("#email-login");
const emailForm = document.querySelector("#email-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const emailSubmit = document.querySelector("#email-submit");
const backToMethods = document.querySelector("#back-to-methods");
const authorization = document.querySelector("#authorization");
const clientName = document.querySelector("#client-name");
const permissionSummary = document.querySelector("#permission-summary");
const approveButton = document.querySelector("#approve");
const denyButton = document.querySelector("#deny");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.error = String(isError);
}

function renderLoginChoices(message = "Choose how you'd like to sign in.") {
  heading.textContent = "Connect your Bloom account";
  document.title = "Bloom Apps · Connect your account";
  setStatus(message);
  loginMethods.hidden = false;
  emailForm.hidden = true;
  authorization.hidden = true;
  googleLogin.disabled = false;
  emailLogin.disabled = false;
  emailSubmit.disabled = false;
}

function showEmailForm() {
  loginMethods.hidden = true;
  emailForm.hidden = false;
  authorization.hidden = true;
  setStatus("Sign in with your email and password.");
  emailInput.focus();
}

async function signOutCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return;
  const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
  if (signOutError) throw signOutError;
}

function getProductName(name) {
  const normalized = String(name ?? "").toLowerCase();
  if (normalized.includes("taskbloom")) return "TaskBloom";
  if (normalized.includes("weekbloom") || normalized.includes("weekweave")) {
    return "WeekBloom";
  }
  return "Bloom Apps";
}

function getPermissionSummary(productName, clientName) {
  if (productName === "TaskBloom") {
    return `${clientName} can view your tasks and projects and help you manage them.`;
  }
  if (productName === "WeekBloom") {
    return `${clientName} can view your weekly schedule and help you manage events you choose.`;
  }
  return `${clientName} can use your Bloom account to help with your requests.`;
}

async function renderAuthorization() {
  setStatus("Checking this connection…");
  const { data: request, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !request) {
    setStatus("This connection request has expired. Return to ChatGPT and try again.", true);
    loginMethods.hidden = true;
    emailForm.hidden = true;
    return;
  }
  if (!("authorization_id" in request) && request.redirect_url) {
    sessionStorage.removeItem(AUTHORIZATION_ID_KEY);
    location.replace(request.redirect_url);
    return;
  }

  const name = String(request.client?.name ?? "").trim() || "ChatGPT";
  heading.textContent = "Review this connection";
  document.title = "Review connection · Bloom Apps";
  clientName.textContent = name;
  permissionSummary.textContent = getPermissionSummary(getProductName(name), name);
  loginMethods.hidden = true;
  emailForm.hidden = true;
  authorization.hidden = false;
  setStatus("Review this connection before allowing it.");
  approveButton.disabled = false;
  denyButton.disabled = false;
  approveButton.focus();
}

async function decide(decision) {
  approveButton.disabled = true;
  denyButton.disabled = true;
  setStatus(decision === "approve" ? "Connecting your account…" : "Returning to ChatGPT…");
  const method = decision === "approve" ? "approveAuthorization" : "denyAuthorization";
  try {
    const { data, error } = await supabase.auth.oauth[method](authorizationId);
    if (error || !data?.redirect_url) throw error ?? new Error("Missing redirect");
    sessionStorage.removeItem(AUTHORIZATION_ID_KEY);
    sessionStorage.removeItem(PENDING_LOGIN_KEY);
    location.replace(data.redirect_url);
  } catch {
    setStatus("We couldn't finish this connection. Return to ChatGPT and try again.", true);
    approveButton.disabled = false;
    denyButton.disabled = false;
  }
}

googleLogin.addEventListener("click", async () => {
  googleLogin.disabled = true;
  emailLogin.disabled = true;
  setStatus("Opening Google sign-in…");
  try {
    await signOutCurrentSession();
    sessionStorage.setItem(PENDING_LOGIN_KEY, "google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.href },
    });
    if (error) throw error;
  } catch {
    sessionStorage.removeItem(PENDING_LOGIN_KEY);
    renderLoginChoices("Google sign-in couldn't start. Try again or choose email.");
  }
});

emailLogin.addEventListener("click", showEmailForm);
backToMethods.addEventListener("click", () => renderLoginChoices());

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  emailSubmit.disabled = true;
  setStatus("Signing in…");
  try {
    await signOutCurrentSession();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });
    if (error) throw error;
    passwordInput.value = "";
  } catch {
    passwordInput.value = "";
    emailSubmit.disabled = false;
    setStatus("Sign-in didn't work. Check your details and try again.", true);
    return;
  }
  await renderAuthorization();
});

approveButton.addEventListener("click", () => decide("approve"));
denyButton.addEventListener("click", () => decide("deny"));

async function main() {
  if (!authorizationId) {
    setStatus("This connection request is missing or expired. Return to ChatGPT and try again.", true);
    loginMethods.hidden = true;
    return;
  }
  sessionStorage.setItem(AUTHORIZATION_ID_KEY, authorizationId);
  const pendingLogin = sessionStorage.getItem(PENDING_LOGIN_KEY);
  const { data: sessionData } = await supabase.auth.getSession();
  if (pendingLogin === "google" && sessionData.session) {
    sessionStorage.removeItem(PENDING_LOGIN_KEY);
    await renderAuthorization();
    return;
  }
  sessionStorage.removeItem(PENDING_LOGIN_KEY);
  const message = url.searchParams.has("error")
    ? "Google sign-in wasn't completed. Choose a sign-in method to try again."
    : "Choose how you'd like to sign in.";
  renderLoginChoices(message);
}

main().catch(() => {
  setStatus("Something went wrong. Return to ChatGPT and try again.", true);
});
