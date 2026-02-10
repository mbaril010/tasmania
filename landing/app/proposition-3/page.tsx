import Link from "next/link";
import Image from "next/image";

function Nav() {
  return (
    <nav className="flex items-center justify-between px-5 sm:px-8 py-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="Tasmania" width={36} height={36} className="rounded-lg" />
        <span className="text-xl font-bold text-white">Tasmania</span>
      </div>
      <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
        <a href="#features" className="hover:text-white transition-colors">Features</a>
        <a href="#workflow" className="hover:text-white transition-colors">How it works</a>
        <a href="https://github.com/mbaril010/tasmania" className="hover:text-white transition-colors">GitHub</a>
      </div>
      <button className="bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-full transition-colors">
        Download
      </button>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-16 sm:pt-28 pb-12 sm:pb-20 px-5 sm:px-6 overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <Image src="/logo-large.png" alt="Tasmania" width={80} height={80} className="rounded-2xl shadow-lg sm:w-[100px] sm:h-[100px]" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6 sm:mb-8">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs sm:text-sm text-gray-400">Powered by llama.cpp</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold leading-tight tracking-tight">
          <span className="text-white">Local AI</span>
          <br />
          <span className="text-amber-400">made simple.</span>
        </h1>

        <p className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Tasmania lets anyone run large language models locally. Search Hugging Face,
          download models, and start a local API server — all without touching a terminal.
        </p>

        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button className="w-full sm:w-auto bg-amber-400 hover:bg-amber-500 text-gray-900 font-semibold px-8 py-4 rounded-full text-lg transition-colors shadow-lg shadow-amber-400/20">
            Download for macOS
          </button>
          <a href="https://github.com/mbaril010/tasmania" className="text-gray-400 hover:text-white font-medium flex items-center gap-2 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            View source
          </a>
        </div>
      </div>
    </section>
  );
}

function Terminal() {
  return (
    <section className="px-4 sm:px-6 pb-12 sm:pb-20">
      <div className="max-w-3xl mx-auto">
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/5">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500/80" />
            <span className="text-[10px] sm:text-xs text-gray-500 ml-2 sm:ml-3 font-mono truncate">Tasmania — Local LLM Server</span>
          </div>
          {/* Terminal content */}
          <div className="p-4 sm:p-6 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto">
            <div className="text-gray-500">$ tasmania start</div>
            <div className="text-gray-400 mt-2">
              <span className="text-amber-400">[Tasmania]</span> Loading model: Llama-3.2-3B-Q4_K_M.gguf
            </div>
            <div className="text-gray-400">
              <span className="text-amber-400">[Tasmania]</span> Configuring llama.cpp server...
            </div>
            <div className="text-gray-400">
              <span className="text-amber-400">[Tasmania]</span> Port: 8080 | Context: 4096 | GPU layers: 32
            </div>
            <div className="text-emerald-400 mt-2">
              <span className="text-amber-400">[Tasmania]</span> Server running at localhost:8080
            </div>
            <div className="text-emerald-400">
              <span className="text-amber-400">[Tasmania]</span> OpenAI API ready at /v1/chat/completions
            </div>
            <div className="mt-3 flex items-center">
              <span className="text-gray-500">$</span>
              <span className="w-2 h-4 bg-amber-400 ml-1 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      title: "Hugging Face search",
      desc: "Browse thousands of GGUF models. Filter by size, quantization, and downloads.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
      title: "Smart downloads",
      desc: "One-click downloads with resume support and real-time progress tracking.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
      title: "Zero configuration",
      desc: "Tasmania auto-configures llama.cpp. Port, context, GPU — all handled for you.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      ),
      title: "100% private",
      desc: "Everything runs locally. No cloud, no API keys, no data leaves your machine.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
      ),
      title: "OpenAI-compatible",
      desc: "Standard API endpoint. Works with any OpenAI-compatible tool out of the box.",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
      ),
      title: "Claude Code MCP",
      desc: "Built-in MCP server connects local models directly to Claude Code.",
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 px-5 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-3 sm:mb-4">
          Everything you need
        </h2>
        <p className="text-gray-500 text-center mb-10 sm:mb-16 text-base sm:text-lg">No expertise required.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl sm:rounded-2xl p-5 sm:p-6 hover:bg-white/[0.06] hover:border-white/10 transition-all group"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-amber-500/10 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-amber-500/20 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-1.5 sm:mb-2">{f.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm sm:text-base">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    { num: "1", title: "Search", desc: "Find the model you need on Hugging Face", color: "bg-amber-400 text-gray-900" },
    { num: "2", title: "Download", desc: "One click. Tasmania handles everything.", color: "bg-amber-500 text-gray-900" },
    { num: "3", title: "Run", desc: "Hit start. Your local AI is live.", color: "bg-amber-600 text-white" },
  ];

  return (
    <section id="workflow" className="py-16 sm:py-24 px-5 sm:px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-12 sm:mb-20">
          From zero to local AI in 3 clicks
        </h2>
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-8 sm:gap-10 md:gap-16">
          {steps.map((s, i) => (
            <div key={i} className="flex sm:flex-col items-center gap-4 sm:gap-0 sm:flex-1 w-full sm:w-auto max-w-xs">
              <div className={`w-14 h-14 sm:w-16 sm:h-16 ${s.color} rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-bold sm:mb-5 shadow-lg flex-shrink-0`}>
                {s.num}
              </div>
              <div className="text-left sm:text-center">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm sm:text-base">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-16 sm:py-28 px-5 sm:px-6 relative">
      <div className="absolute inset-0 bg-amber-500/[0.03] pointer-events-none" />
      <div className="max-w-3xl mx-auto text-center relative z-10">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-5 sm:mb-6">
          Ready to go local?
        </h2>
        <p className="text-base sm:text-lg text-gray-400 mb-8 sm:mb-10">
          Free, open source, and yours to keep.
        </p>
        <button className="w-full sm:w-auto bg-amber-400 hover:bg-amber-500 text-gray-900 font-semibold px-8 py-4 rounded-full text-lg transition-colors shadow-lg shadow-amber-400/20">
          Download Tasmania
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-8 px-5 sm:px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
        <span>Tasmania &middot; Open source &middot; MIT License</span>
        <div className="flex gap-6">
          <a href="https://github.com/mbaril010/tasmania" className="hover:text-gray-400 transition-colors">GitHub</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Docs</a>
        </div>
      </div>
    </footer>
  );
}

export default function Proposition3() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Link href="/" className="fixed top-4 right-4 z-50 bg-white/5 backdrop-blur text-xs font-medium text-gray-400 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-colors">
        &larr; All propositions
      </Link>
      <Nav />
      <Hero />
      <Terminal />
      <Features />
      <Workflow />
      <CTA />
      <Footer />
    </div>
  );
}
