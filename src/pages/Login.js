// pages/Login.js

import { useState } from "react";
import { useAuth } from "../Context/AuthContext";
import "./Login.css";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!window.grecaptcha) {
      alert("Captcha not loaded");
      setLoading(false);
      return;
    }

    window.grecaptcha.ready(async () => {
      try {
        const captchaToken = await window.grecaptcha.execute(
          process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY,
          { action: "login" }
        );

        // FIX 1: captchaHybrid middleware reads captchaType to select the
        // correct secret (RECAPTCHA_SECRET for v3, V2_RECAPTCHA_SECRET for v2)
        // and to pick the right verification path.
        // Without captchaType the middleware defaults to "v2", sends the v3
        // token to Google's v2 siteverify endpoint → Google rejects it →
        // captchaHybrid returns 403 before the controller is ever reached.
        //
        // FIX 2: captchaAction enables server-side action binding so a token
        // minted for "signup" cannot be replayed against "login".
        const res = await login({
          ...form,
          captchaToken,
          captchaType:   "v3",
          captchaAction: "login",
        });

        if (res.success) {
          navigate("/");
        } else {
          alert(res.error);
        }
      } catch (err) {
        console.error(err);
        alert("Captcha failed");
      } finally {
        // FIX 3: loading was never reset on the success path — the button
        // stayed disabled after a successful login until the component
        // unmounted. Always reset in finally.
        setLoading(false);
      }
    });
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p className="subtitle">Login to your account</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="form-input"
            placeholder="Email / Username / Phone"
            onChange={(e) =>
              setForm({ ...form, identifier: e.target.value })
            }
          />

          <input
            type="password"
            className="form-input"
            placeholder="Password"
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
          />

          <button className="submit-button" disabled={loading}>
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};