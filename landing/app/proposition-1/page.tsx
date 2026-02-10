import Link from "next/link";
import Image from "next/image";

function Nav() {
  return (
    <nav className="flex items-center justify-between px-5 sm:px-8 py-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="Tasmania" width={36} height={36} className="rounded-lg" />
        <span className="text-xl font-bold text-gray-900">Tasmania</span>
      </div>
      <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
        <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
        <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
        <a href="#" className="hover:text-gray-900 transition-colors">Documentation</a>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <a href="https://github.com/mbaril010/tasmania" className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:block">GitHub</a>
        <button className="bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-full transition-colors">
          Download
        </button>
      </div>
    </nav>
  );
}

function WorkflowNodes() {
  const nodes = [
    {
      color: "bg-amber-400",
      label: "Search",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      color: "bg-gray-800",
      label: "Download",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
    },
    {
      color: "bg-amber-500",
      label: "Configure",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      color: "bg-gray-900",
      label: "Run",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Mobile: horizontal compact row */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8 md:hidden px-2">
        {nodes.map((n, i) => (
          <div key={i} className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 ${n.color} rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg`}>
                {n.icon}
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-gray-500">{n.label}</span>
            </div>
            {i < nodes.length - 1 && (
              <svg width="16" height="2" className="text-gray-300 mb-5">
                <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: absolute positioned with connecting lines */}
      <div className="relative h-64 mb-8 hidden md:block">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 250" fill="none">
          <line x1="130" y1="100" x2="310" y2="125" stroke="#e0e0e0" strokeWidth="1.5" strokeDasharray="6 4" />
          <line x1="310" y1="125" x2="490" y2="125" stroke="#e0e0e0" strokeWidth="1.5" strokeDasharray="6 4" />
          <line x1="490" y1="125" x2="670" y2="100" stroke="#e0e0e0" strokeWidth="1.5" strokeDasharray="6 4" />
          <circle cx="220" cy="112" r="3" fill="#FBBF24" opacity="0.5" />
          <circle cx="400" cy="125" r="3" fill="#FBBF24" opacity="0.5" />
          <circle cx="580" cy="112" r="3" fill="#FBBF24" opacity="0.5" />
        </svg>
        {[
          { pos: "left-[8%] top-[20%]", ...nodes[0] },
          { pos: "left-[33%] top-[32%]", ...nodes[1] },
          { pos: "left-[55%] top-[32%]", ...nodes[2] },
          { pos: "right-[8%] top-[20%]", ...nodes[3] },
        ].map((n, i) => (
          <div key={i} className={`absolute ${n.pos} flex flex-col items-center gap-2`}>
            <div className={`w-16 h-16 ${n.color} rounded-2xl flex items-center justify-center shadow-lg`}>
              {n.icon}
            </div>
            <span className="text-xs font-medium text-gray-500">{n.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Hero() {
  return (
    <section className="relative pt-10 sm:pt-20 pb-16 sm:pb-32 px-5 sm:px-6 overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="flex justify-center mb-6 md:hidden">
          <Image src="/logo-large.png" alt="Tasmania" width={80} height={80} className="rounded-2xl shadow-lg" />
        </div>
        <WorkflowNodes />
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-gray-900 leading-tight tracking-tight">
          Run AI locally.
          <br />
          <span className="text-amber-500">Zero complexity.</span>
        </h1>
        <p className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Tasmania finds models on Hugging Face, downloads them, and handles all
          the configuration with llama.cpp. You just click run.
        </p>
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button className="w-full sm:w-auto bg-amber-400 hover:bg-amber-500 text-gray-900 font-semibold px-8 py-4 rounded-full text-lg transition-colors shadow-lg shadow-amber-400/25">
            Download for macOS
          </button>
          <a href="https://github.com/mbaril010/tasmania" className="text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2 transition-colors">
            View on GitHub
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      title: "Browse Hugging Face",
      description: "Search thousands of GGUF models directly from the app. Filter by size, quantization, and popularity.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
      title: "One-click download",
      description: "Download any model with a single click. Resume interrupted downloads. Track progress in real-time.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      title: "100% local & private",
      description: "Everything runs on your machine. No cloud, no API keys, no data leaving your computer. Ever.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
      ),
      title: "OpenAI-compatible API",
      description: "Exposes a standard API endpoint. Use with any tool that supports OpenAI — no code changes needed.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      title: "GPU acceleration",
      description: "Automatically offloads to your GPU for faster inference. Configure layers with a simple slider.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
      ),
      title: "Claude Code integration",
      description: "Built-in MCP server lets you connect your local models directly to Claude Code for seamless AI workflows.",
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 px-5 sm:px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Everything you need, nothing you don&apos;t</h2>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">Tasmania handles the technical complexity so you can focus on using AI.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
          {features.map((f, i) => (
            <div key={i} className="p-5 sm:p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm sm:text-base">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { num: "1", title: "Search", desc: "Find the perfect model on Hugging Face from Tasmania" },
    { num: "2", title: "Download", desc: "One click. Tasmania handles the rest." },
    { num: "3", title: "Run", desc: "Hit start. Your local AI server is live." },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-24 px-5 sm:px-6 bg-gray-50">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-10 sm:mb-16">Three steps. That&apos;s it.</h2>
        <div className="flex flex-col md:flex-row items-center md:items-start justify-center gap-10 md:gap-16">
          {steps.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center max-w-xs">
              <div className="w-14 h-14 bg-amber-400 text-gray-900 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                {s.num}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-16 sm:py-24 px-5 sm:px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4">Ready to run AI locally?</h2>
        <p className="text-base sm:text-lg text-gray-500 mb-8 sm:mb-10">Free, open source, and yours forever.</p>
        <button className="w-full sm:w-auto bg-amber-400 hover:bg-amber-500 text-gray-900 font-semibold px-8 py-4 rounded-full text-lg transition-colors shadow-lg shadow-amber-400/25">
          Download Tasmania
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-8 px-5 sm:px-6 border-t border-gray-200">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <span>Tasmania &mdash; Open source. MIT License.</span>
        <div className="flex gap-6">
          <a href="https://github.com/mbaril010/tasmania" className="hover:text-gray-600 transition-colors">GitHub</a>
          <a href="#" className="hover:text-gray-600 transition-colors">Documentation</a>
        </div>
      </div>
    </footer>
  );
}

export default function Proposition1() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Link href="/" className="fixed top-4 right-4 z-50 bg-white/80 backdrop-blur text-xs font-medium text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 hover:border-amber-300 transition-colors">
        &larr; All propositions
      </Link>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
}
