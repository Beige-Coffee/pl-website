import { useState } from "react";
import { useSearch } from "wouter";

const sansFont = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function ResetPasswordPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // If no token in URL, show the "forgot password" form
  const isForgotMode = !token;

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await res.json();
      setForgotSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Reset failed. The link may have expired.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f0e1] flex items-center justify-center p-4" style={{ fontFamily: sansFont }}>
      <div className="w-full max-w-md border-4 border-[#b8860b] bg-[#fffdf5] p-8">
        <h1 className="font-pixel text-lg text-[#b8860b] mb-6">
          {isForgotMode ? "FORGOT PASSWORD" : "RESET PASSWORD"}
        </h1>

        {success && (
          <div className="space-y-4">
            <div className="border-2 border-green-600 bg-green-50 p-4">
              <p className="text-green-800 font-semibold">Password reset successfully!</p>
              <p className="text-green-700 text-sm mt-1">You can now log in with your new password.</p>
            </div>
            <a
              href="/"
              className="block w-full font-pixel text-base border-2 border-gray-900 bg-gray-900 text-white text-center px-4 py-4 hover:bg-gray-800 transition-all"
            >
              GO TO HOME
            </a>
          </div>
        )}

        {!success && isForgotMode && !forgotSent && (
          <form onSubmit={handleForgotSubmit} className="space-y-5">
            <p className="text-gray-600 text-base">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div>
              <label className="block font-pixel text-xs text-gray-700 mb-2">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border-2 border-gray-400 bg-white text-gray-900 px-4 py-3 text-base focus:outline-none focus:border-gray-900 placeholder:text-gray-400"
                placeholder="you@example.com"
              />
            </div>

            {error && <div className="text-sm text-red-600 text-center">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full font-pixel text-base border-2 px-4 py-4 transition-all ${
                loading
                  ? "border-gray-400 bg-white text-gray-400 cursor-wait"
                  : "border-gray-900 bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]"
              }`}
            >
              {loading ? "SENDING..." : "SEND RESET LINK"}
            </button>

            <div className="text-center">
              <a href="/" className="text-sm text-gray-500 hover:text-gray-700 underline">
                Back to home
              </a>
            </div>
          </form>
        )}

        {!success && isForgotMode && forgotSent && (
          <div className="space-y-4">
            <div className="border-2 border-[#b8860b] bg-[#f0ead6] p-4">
              <p className="text-gray-800 font-semibold">Check your email</p>
              <p className="text-gray-600 text-sm mt-1">
                If an account exists with <strong>{email}</strong>, we've sent a password reset link. The link expires in 1 hour.
              </p>
            </div>
            <p className="text-gray-500 text-sm text-center">
              Don't see it? Check your spam folder.
            </p>
            <div className="text-center">
              <a href="/" className="text-sm text-gray-500 hover:text-gray-700 underline">
                Back to home
              </a>
            </div>
          </div>
        )}

        {!success && !isForgotMode && (
          <form onSubmit={handleResetSubmit} className="space-y-5">
            <p className="text-gray-600 text-base">
              Enter your new password below.
            </p>
            <div>
              <label className="block font-pixel text-xs text-gray-700 mb-2">NEW PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border-2 border-gray-400 bg-white text-gray-900 px-4 py-3 text-base focus:outline-none focus:border-gray-900 placeholder:text-gray-400"
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="block font-pixel text-xs text-gray-700 mb-2">CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border-2 border-gray-400 bg-white text-gray-900 px-4 py-3 text-base focus:outline-none focus:border-gray-900 placeholder:text-gray-400"
                placeholder="Confirm your password"
              />
            </div>

            {error && <div className="text-sm text-red-600 text-center">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full font-pixel text-base border-2 px-4 py-4 transition-all ${
                loading
                  ? "border-gray-400 bg-white text-gray-400 cursor-wait"
                  : "border-gray-900 bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]"
              }`}
            >
              {loading ? "RESETTING..." : "RESET PASSWORD"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
