import { Link } from "wouter";
import { useState, useEffect } from "react";

const posts = [
  {
    title: "An Approachable Deep Dive Into Lightning's Noise Protocol",
    href: "/noise-tutorial",
    description:
      "A multi-chapter tutorial covering cryptographic foundations, the three-act handshake, and encrypted messaging in Lightning transport.",
  },
];

const ACCESS_KEY = "pl-course-access";

export default function Blog() {
  const [hasAccess, setHasAccess] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(ACCESS_KEY) === "granted") {
      setHasAccess(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/course-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem(ACCESS_KEY, "granted");
        setHasAccess(true);
      } else {
        setError("Incorrect password");
      }
    } catch {
      setError("Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col relative z-10">
        <div className="w-full border-b-4 border-border bg-card p-2 flex items-center justify-between pixel-shadow relative z-50">
          <Link
            href="/"
            className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
            data-testid="link-back-home"
          >
            &lt; BACK TO HOME
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/blog"
              className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
              data-testid="link-blog"
            >
              LEARN
            </Link>
            <Link
              href="/about"
              className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
              data-testid="link-about"
            >
              ABOUT
            </Link>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="bg-card border-4 border-border p-8 md:p-12 pixel-shadow max-w-md w-full text-center">
            <h1 className="font-pixel text-2xl md:text-3xl mb-4 text-shadow-retro" data-testid="text-coming-soon">
              Coming Soon...
            </h1>
            <p className="font-mono text-lg md:text-xl mb-8 text-muted-foreground">
              This content is not publicly available yet.
            </p>

            {!showPasswordInput ? (
              <button
                onClick={() => setShowPasswordInput(true)}
                className="bg-primary text-foreground px-6 py-3 font-pixel text-sm border-2 border-border hover:bg-primary/80 transition-colors"
                data-testid="button-enter-password"
              >
                ENTER PASSWORD
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter access password"
                  className="w-full px-4 py-3 font-mono text-lg border-4 border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  autoFocus
                  data-testid="input-course-password"
                />
                {error && (
                  <p className="font-mono text-sm text-red-500" data-testid="text-password-error">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="bg-primary text-foreground px-6 py-3 font-pixel text-sm border-2 border-border hover:bg-primary/80 transition-colors disabled:opacity-50"
                  data-testid="button-submit-password"
                >
                  {loading ? "CHECKING..." : "SUBMIT"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <div className="w-full border-b-4 border-border bg-card p-2 flex items-center justify-between pixel-shadow relative z-50">
        <Link
          href="/"
          className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
          data-testid="link-back-home"
        >
          &lt; BACK TO HOME
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/blog"
            className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
            data-testid="link-blog"
          >
            LEARN
          </Link>
          <Link
            href="/about"
            className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
            data-testid="link-about"
          >
            ABOUT
          </Link>
        </div>
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
        <header className="mb-8">
          <h1 className="font-pixel text-2xl md:text-4xl leading-tight text-shadow-retro mb-3" data-testid="text-blog-title">
            Learn
          </h1>
          <p className="font-mono text-xl md:text-2xl" data-testid="text-blog-subtitle">
            Long-form technical articles and tutorials.
          </p>
        </header>

        <div className="grid gap-4">
          {posts.map((post) => (
            <Link
              key={post.href}
              href={post.href}
              className="bg-card border-4 border-border p-4 md:p-5 pixel-shadow pixel-shadow-hover transition-all hover:bg-secondary block"
              data-testid="card-post-noise"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-pixel text-lg md:text-xl leading-relaxed" data-testid="text-post-title">
                    {post.title}
                  </h2>
                  <p className="font-mono text-lg md:text-xl mt-2 text-muted-foreground" data-testid="text-post-description">
                    {post.description}
                  </p>
                </div>
                <div
                  className="bg-primary text-foreground px-2 py-1 font-pixel text-[10px] border-2 border-border shrink-0"
                  data-testid="badge-read"
                >
                  READ
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
