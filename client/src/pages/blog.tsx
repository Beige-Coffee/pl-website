import { Link } from "wouter";

const posts = [
  {
    title: "An Approachable Deep Dive Into Lightning’s Noise Protocol",
    href: "/noise-tutorial",
    description:
      "A multi-chapter tutorial covering cryptographic foundations, the three-act handshake, and encrypted messaging in Lightning transport.",
  },
];

export default function Blog() {
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
            BLOG
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
            Blog
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
