// pages/Register.js

import { useState } from "react";
import { useAuth } from "../Context/AuthContext";
import "./Register.css";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
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
          { action: "signup" }
        );

        // FIX: same as Login.js — must send captchaType and captchaAction
        // so captchaHybrid middleware uses the v3 secret and verification
        // path, and so the action is validated server-side.
        const res = await signup({
          ...form,
          captchaToken,
          captchaType:   "v3",
          captchaAction: "signup",
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
        setLoading(false);
      }
    });
  };

  return (
    <div className="register-wrapper">
      <div className="register-container">
        <div className="register-header">
          <h1>Create Account</h1>
          <p className="subtitle">Join now</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <input className="form-input" placeholder="Name"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />

          <input className="form-input" placeholder="Username"
            onChange={(e) => setForm({ ...form, username: e.target.value })} />

          <input className="form-input" placeholder="Email"
            onChange={(e) => setForm({ ...form, email: e.target.value })} />

          <input className="form-input" placeholder="Phone"
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <input type="password" className="form-input" placeholder="Password"
            onChange={(e) => setForm({ ...form, password: e.target.value })} />

          <button className="submit-button" disabled={loading}>
            {loading ? "Creating..." : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}