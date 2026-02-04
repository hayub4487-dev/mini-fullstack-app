const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const resetBtn = document.getElementById("reset-password-btn");
const resetResult = document.getElementById("reset-password-result");

if (!token) {
  resetResult.innerText = "Missing reset token. Please request a new reset link.";
  if (resetBtn) {
    resetBtn.disabled = true;
  }
}

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    const password = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!password || !confirmPassword) {
      resetResult.innerText = "Please fill out both fields.";
      return;
    }

    if (password !== confirmPassword) {
      resetResult.innerText = "Passwords do not match.";
      return;
    }

    fetch("http://localhost:3000/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token, password })
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          resetResult.innerText = data.message || "Unable to reset password.";
          return;
        }

        resetResult.innerText = data.message || "Password updated. You can log in now.";
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1500);
      })
      .catch(err => {
        console.error(err);
        resetResult.innerText = "Network error. Try again.";
      });
  });
}
