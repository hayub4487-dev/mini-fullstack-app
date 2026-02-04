function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const result = document.getElementById("result");

  fetch("http://localhost:3000/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (ok && data.success) {
        sessionStorage.setItem("isLoggedIn", "true");
        window.location.href = "dashboard.html";
        return;
      }

      result.innerText = data.message || "Login failed";
    })
    .catch(err => {
      console.error(err);
      result.innerText = "Network error. Try again.";
    });
}

const hiddenClass = "is-hidden";
const cardLogin = document.getElementById("cardLogin");
const cardSignup = document.getElementById("cardSignup");
const heroLogin = document.getElementById("heroLogin");
const heroSignup = document.getElementById("heroSignup");
const switchToSignup = document.getElementById("switch-to-signup");
const switchToLogin = document.getElementById("switch-to-login");

function showLogin() {
  cardLogin.classList.remove(hiddenClass);
  heroLogin.classList.remove(hiddenClass);
  cardSignup.classList.add(hiddenClass);
  heroSignup.classList.add(hiddenClass);
  document.getElementById("result").innerText = "";
  document.getElementById("resultSignup").innerText = "";
}

function showSignup() {
  cardLogin.classList.add(hiddenClass);
  heroLogin.classList.add(hiddenClass);
  cardSignup.classList.remove(hiddenClass);
  heroSignup.classList.remove(hiddenClass);
  document.getElementById("result").innerText = "";
  document.getElementById("resultSignup").innerText = "";
}

if (switchToSignup) {
  switchToSignup.addEventListener("click", (event) => {
    event.preventDefault();
    showSignup();
  });
}

if (switchToLogin) {
  switchToLogin.addEventListener("click", (event) => {
    event.preventDefault();
    showLogin();
  });
}

function signup() {
  const name = document.getElementById("signupName").value;
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  const confirmPassword = document.getElementById("signupConfirmPassword").value;
  const resultSignup = document.getElementById("resultSignup");

  if (!name || !email || !password || !confirmPassword) {
    resultSignup.innerText = "All fields are required";
    return;
  }

  if (password !== confirmPassword) {
    resultSignup.innerText = "Passwords do not match";
    return;
  }

  fetch("http://localhost:3000/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, email, password, confirmPassword })
  })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (ok && data.success) {
        resultSignup.innerText = "Sign up successful! Now login...";
        document.getElementById("signupName").value = "";
        document.getElementById("signupEmail").value = "";
        document.getElementById("signupPassword").value = "";
        document.getElementById("signupConfirmPassword").value = "";

        setTimeout(() => {
          showLogin();
          document.getElementById("email").value = email;
        }, 1200);
        return;
      }
      resultSignup.innerText = data.message || "Sign up failed";
    })
    .catch(err => {
      console.error(err);
      resultSignup.innerText = "Network error. Try again.";
    });
}

const forgotBtn = document.getElementById("forgot-btn");
const resetPanel = document.getElementById("reset-panel");
const resetSubmit = document.getElementById("reset-submit");
const resetResult = document.getElementById("reset-result");
const resetLink = document.getElementById("reset-link");

if (forgotBtn) {
  forgotBtn.addEventListener("click", () => {
    resetPanel.classList.toggle("open");
    resetPanel.setAttribute("aria-hidden", resetPanel.classList.contains("open") ? "false" : "true");
  });
}

if (resetSubmit) {
  resetSubmit.addEventListener("click", () => {
    const email = document.getElementById("reset-email").value;
    resetResult.innerText = "";
    resetLink.classList.remove("is-visible");

    fetch("http://localhost:3000/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          resetResult.innerText = data.message || "Unable to send reset link.";
          return;
        }

        resetResult.innerText = data.message || "If the email exists, a reset link was sent.";

        if (data.resetToken) {
          const link = `reset-password.html?token=${data.resetToken}`;
          resetLink.href = link;
          resetLink.classList.add("is-visible");
        }
      })
      .catch(err => {
        console.error(err);
        resetResult.innerText = "Network error. Try again.";
      });
  });
}
