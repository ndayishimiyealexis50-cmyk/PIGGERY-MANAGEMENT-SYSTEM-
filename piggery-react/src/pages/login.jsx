// ── Sign In ──────────────────────────────────────────────────
  async function login() {
    setErr("");
    setOk("");
    if (!form.email || !form.password) return setErr("Please enter your email and password.");
    if (form.password.length < 6) return setErr("Password must be at least 6 characters.");
    setLoading(true);

    // ✅ FIX: use a flag so that if the timeout fires AFTER a successful
    // signIn, we don't show the error or leave a broken state.
    let didSucceed = false;

    const loginTimeout = setTimeout(() => {
      if (!didSucceed) {
        setLoading(false);
        setErr("Sign in is taking too long. Check your internet connection and try again.");
      }
    }, 20000); // ✅ increased to 20 s for slow African 4G connections

    try {
      await auth.signInWithEmailAndPassword(form.email.trim(), form.password);
      didSucceed = true;          // ✅ prevents timeout from firing after success
      clearTimeout(loginTimeout);
      // Keep spinner — onAuthStateChanged in AuthContext will resolve and
      // unmount this page, OR farmiq_auth_blocked event will clear it.
      return;
    } catch (e) {
      clearTimeout(loginTimeout);
      const msg =
        e.code === "auth/user-not-found" ||
        e.code === "auth/wrong-password" ||
        e.code === "auth/invalid-credential"
          ? "Incorrect email or password. Please try again."
          : e.code === "auth/invalid-email"
          ? "Invalid email address."
          : e.code === "auth/too-many-requests"
          ? "Too many attempts. Please wait a few minutes and try again."
          : e.code === "auth/network-request-failed"
          ? "No internet connection. Check your network and try again."
          : "Sign in failed: " + e.message;
      setErr(msg);
    }
    setLoading(false);
  }
