import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

      const supabase = createClient(
        "https://sxwsoslpymbfwotvtrgl.supabase.co",
        "sb_publishable_tAaqXngWru59zAnvkxPwbQ_RvJII5VT",
        { auth: { autoRefreshToken: true, detectSessionInUrl: true, persistSession: true } },
      );
      const url = new URL(location.href);
      const authorizationId = url.searchParams.get("authorization_id") ??
        sessionStorage.getItem("taskbloom_authorization_id");
      const status = document.querySelector("#status");
      const details = document.querySelector("#details");
      const actions = document.querySelector("#actions");
      const emailForm = document.querySelector("#email-form");
      const emailInput = document.querySelector("#email");
      const passwordInput = document.querySelector("#password");
      const emailSubmit = document.querySelector("#email-submit");

      const showError = (message) => {
        status.textContent = message;
        status.style.color = "#a32d2d";
      };

      const addDetail = (label, value) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value || "Not provided";
        details.append(term, description);
      };

      const decide = async (decision) => {
        actions.querySelectorAll("button").forEach((button) => button.disabled = true);
        status.textContent = decision === "approve" ? "Approving…" : "Denying…";
        const method = decision === "approve" ? "approveAuthorization" : "denyAuthorization";
        const { data, error } = await supabase.auth.oauth[method](authorizationId);
        if (error || !data?.redirect_url) {
          showError(error?.message ?? "The authorization response was incomplete.");
          actions.querySelectorAll("button").forEach((button) => button.disabled = false);
          return;
        }
        sessionStorage.removeItem("taskbloom_authorization_id");
        location.replace(data.redirect_url);
      };

      const renderSignIn = () => {
        status.textContent = "Sign in to review the TaskBloom access request.";
        actions.replaceChildren();
        const googleSignIn = document.createElement("button");
        googleSignIn.id = "approve";
        googleSignIn.type = "button";
        googleSignIn.textContent = "Continue with Google";
        googleSignIn.addEventListener("click", async () => {
          googleSignIn.disabled = true;
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: location.href },
          });
          if (error) {
            showError(error.message);
            googleSignIn.disabled = false;
          }
        });
        const emailToggle = document.createElement("button");
        emailToggle.id = "email-toggle";
        emailToggle.type = "button";
        emailToggle.textContent = "Use email and password";
        emailToggle.addEventListener("click", () => {
          emailForm.hidden = !emailForm.hidden;
          emailToggle.textContent = emailForm.hidden
            ? "Use email and password"
            : "Use Google instead";
          if (!emailForm.hidden) emailInput.focus();
        });
        actions.append(googleSignIn, emailToggle);
        emailForm.hidden = true;
        emailForm.onsubmit = async (event) => {
          event.preventDefault();
          emailSubmit.disabled = true;
          status.textContent = "Signing in…";
          const { error } = await supabase.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passwordInput.value,
          });
          if (error) {
            showError("Email/password sign-in failed. Check the supplied credentials.");
            passwordInput.value = "";
            emailSubmit.disabled = false;
            return;
          }
          location.reload();
        };
      };

      const main = async () => {
        if (!authorizationId) {
          showError("This authorization link is missing its request id.");
          return;
        }
        sessionStorage.setItem("taskbloom_authorization_id", authorizationId);

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          renderSignIn();
          return;
        }

        const { data: authorization, error } =
          await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
        if (error || !authorization) {
          showError(error?.message ?? "This authorization request is invalid or expired.");
          return;
        }
        if (!("authorization_id" in authorization) && authorization.redirect_url) {
          location.replace(authorization.redirect_url);
          return;
        }

        status.textContent = "Review the requested access before continuing.";
        details.hidden = false;
        addDetail("Client", authorization.client?.name);
        addDetail("Redirect URI", authorization.redirect_uri);
        addDetail("Requested scopes", authorization.scope);

        const approve = document.createElement("button");
        approve.id = "approve";
        approve.textContent = "Approve";
        approve.addEventListener("click", () => decide("approve"));
        const deny = document.createElement("button");
        deny.id = "deny";
        deny.textContent = "Deny";
        deny.addEventListener("click", () => decide("deny"));
        actions.append(approve, deny);
      };

      main().catch((error) => showError(error?.message ?? "Unable to load the authorization request."));
