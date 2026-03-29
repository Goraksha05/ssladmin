// Services/AuthService.js

const API_URL =
  `${process.env.REACT_APP_BACKEND_URL ?? process.env.REACT_APP_SERVER_URL}/api/admin`;

// ─── Token helper ─────────────────────────────────────────────────────────────
const cleanToken = (raw) => (raw ?? '').trim().replace(/\s/g, '');

const AuthService = {
  // ✅ LOGIN USER
  login: async ({ identifier, password, captchaToken, captchaType = 'v3', captchaAction = 'login' }) => {
    try {
      const res = await fetch(`${API_URL}/adminlogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, captchaToken, captchaType, captchaAction }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.authtoken) {
        const token = cleanToken(data.authtoken);

        localStorage.setItem("token", token);
        localStorage.setItem("User", JSON.stringify(data.user));

        return { success: true, user: data.user, token };
      }

      return { success: false, error: data.error || "Login failed" };
    } catch (err) {
      console.error("Login error:", err);
      return { success: false, error: "Server error" };
    }
  },

  // ✅ REGISTER USER
  signup: async ({ name, username, email, phone, password, captchaToken, captchaType = 'v3', captchaAction = 'login' }) => {
    try {
      const res = await fetch(`${API_URL}/createadmin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, phone, password, captchaToken, captchaType, captchaAction }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.authtoken) {
        const token = cleanToken(data.authtoken);

        localStorage.setItem("token", token);
        localStorage.setItem("User", JSON.stringify(data.user));

        return { success: true, user: data.user, token };
      }

      return {
        success: false,
        error: data.error || data.message || "Signup failed",
      };
    } catch (err) {
      console.error("Signup error:", err);
      return { success: false, error: "Server error" };
    }
  },

  // ✅ GET LOGGED USER
  getUser: async () => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("User") || "null");

    if (!token || !user) return null;

    try {
      const res = await fetch(
        `${API_URL}/getloggeduser/${user._id || user.id}`,
        {
          headers: {
            Authorization: `Bearer ${cleanToken(token)}`,
          },
        }
      );
      if (!token) return null;

      const data = await res.json();
      return data.success ? data.user : null;
    } catch (err) {
      console.error("Get user error:", err);
      return null;
    }
  },

  // ✅ LOGOUT
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("User");
  },
};

export default AuthService;