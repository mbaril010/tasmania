import Image from "next/image";

function Nav() {
  return (
    <nav className="flex items-center justify-between px-5 sm:px-8 py-5 sm:py-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="Tasmania" width={32} height={32} className="rounded-lg" />
        <span className="text-lg font-bold tracking-tight text-gray-900">Tasmania</span>
      </div>
      <div className="hidden md:flex items-center gap-8 text-sm text-gray-500 font-medium">
        <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
        <a href="#steps" className="hover:text-gray-900 transition-colors">How it works</a>
        <a href="https://github.com/mbaril010/tasmania" className="hover:text-gray-900 transition-colors">GitHub</a>
      </div>
      <button className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 sm:px-5 py-2.5 rounded-full transition-colors">
        Download
      </button>
    </nav>
  );
}

function Hero() {
  return (
    <section className="pt-12 sm:pt-24 md:pt-36 pb-12 sm:pb-20 px-5 sm:px-6">
      <div className="max-w-5xl mx-auto text-center">
        <div className="flex justify-center mb-6 sm:mb-8">
          <Image src="/logo-large.png" alt="Tasmania" width={80} height={80} className="rounded-2xl shadow-lg sm:w-[96px] sm:h-[96px]" />
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-bold text-gray-900 leading-[0.95] tracking-tight">
          Your AI.
          <br />
          Your machine.
        </h1>
        <p className="mt-6 sm:mt-10 text-base sm:text-lg md:text-xl text-gray-400 max-w-xl mx-auto leading-relaxed">
          Search models on Hugging Face, download them in one click,
          and run them locally. No cloud. No complexity. No compromise.
        </p>
        <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white font-semibold px-8 py-4 rounded-full text-lg transition-colors">
            Download for free
          </button>
          <a href="#features" className="text-gray-400 hover:text-gray-600 font-medium transition-colors">
            Learn more
          </a>
        </div>
      </div>
    </section>
  );
}

function AppPreview() {
  return (
    <section className="px-4 sm:px-6 pb-16 sm:pb-24">
      <div className="max-w-5xl mx-auto">
        <div className="bg-gray-100 rounded-2xl sm:rounded-3xl p-1">
          <div className="bg-gray-900 rounded-[14px] sm:rounded-[20px] overflow-hidden">
            <div className="flex">
              {/* Sidebar — mobile: icon bar, desktop: full sidebar */}
              <div className="w-14 sm:w-16 md:w-56 bg-gray-950 p-2 sm:p-3 md:p-5 flex-shrink-0">
                <div className="hidden md:flex items-center gap-2 mb-8">
                  <Image src="/logo.png" alt="Tasmania" width={24} height={24} className="rounded-md" />
                  <span className="text-white font-semibold text-sm">Tasmania</span>
                </div>
                <div className="flex md:hidden justify-center mb-3">
                  <Image src="/logo.png" alt="Tasmania" width={20} height={20} className="rounded" />
                </div>
                <div className="space-y-1">
                  {[
                    { label: "Dashboard", icon: "\u2302" },
                    { label: "Models", icon: "\u25CE" },
                    { label: "Backends", icon: "\u26A1" },
                    { label: "Settings", icon: "\u2699" },
                  ].map((item, i) => (
                    <div
                      key={item.label}
                      className={`px-2 md:px-3 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 justify-center md:justify-start ${
                        i === 0 ? "bg-gray-800 text-white" : "text-gray-500"
                      }`}
                    >
                      <span className="text-sm md:text-base">{item.icon}</span>
                      <span className="hidden md:inline">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Main content */}
              <div className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="min-w-0">
                    <div className="h-3 w-20 sm:w-24 bg-gray-700 rounded mb-2" />
                    <div className="h-2 w-28 sm:w-40 bg-gray-800 rounded" />
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-400 text-[10px] sm:text-xs">Running</span>
                  </div>
                </div>
                {/* Model card */}
                <div className="bg-gray-800 rounded-lg sm:rounded-xl p-3 sm:p-5 mb-3 sm:mb-4">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-white text-xs sm:text-sm font-medium truncate">Llama 3.2 3B Q4_K_M</div>
                        <div className="text-gray-500 text-[10px] sm:text-xs">2.1 GB &middot; meta-llama</div>
                      </div>
                    </div>
                    <button className="bg-amber-500 text-gray-900 text-[10px] sm:text-xs font-semibold px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg flex-shrink-0">Active</button>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-500">
                    <span>Port: 8080</span>
                    <span>Context: 4096</span>
                    <span>GPU: 32</span>
                  </div>
                </div>
                {/* API endpoint */}
                <div className="bg-gray-800 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <div className="text-gray-500 text-[10px] sm:text-xs mb-1.5 sm:mb-2">API Endpoint</div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <code className="text-amber-400 text-[10px] sm:text-sm flex-1 font-mono truncate">http://localhost:8080/v1/chat/completions</code>
                    <button className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { title: "Search Hugging Face", desc: "Browse thousands of GGUF models from the app. Sorted by downloads, filterable by size." },
    { title: "One-click downloads", desc: "Download any model instantly. Resume interrupted downloads. Real-time progress tracking." },
    { title: "Auto configuration", desc: "Tasmania configures llama.cpp automatically. Port, context size, GPU layers \u2014 all handled." },
    { title: "OpenAI-compatible API", desc: "Drop-in replacement for any tool using the OpenAI protocol. Zero code changes." },
    { title: "Completely private", desc: "No cloud, no accounts, no telemetry. Your data never leaves your machine." },
    { title: "Claude Code ready", desc: "Built-in MCP server connects Tasmania directly to Claude Code for local AI workflows." },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 px-5 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 text-center mb-10 sm:mb-16">
          Simple outside.<br />Powerful inside.
        </h2>
        <div className="grid sm:grid-cols-2 gap-x-8 sm:gap-x-16 gap-y-8 sm:gap-y-12">
          {features.map((f, i) => (
            <div key={i} className="border-l-2 border-amber-400 pl-5 sm:pl-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm sm:text-base">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section id="steps" className="py-16 sm:py-24 px-5 sm:px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 text-center mb-12 sm:mb-20">
          Three steps to local AI.
        </h2>
        <div className="space-y-10 sm:space-y-16">
          {[
            { num: "01", title: "Search", desc: "Find models on Hugging Face directly from Tasmania. See sizes, quantizations, and popularity at a glance." },
            { num: "02", title: "Download", desc: "Click download. Tasmania handles everything \u2014 the transfer, the file organization, the configuration." },
            { num: "03", title: "Run", desc: "Hit start. Your model is running locally with a full OpenAI-compatible API. That\u2019s it." },
          ].map((s, i) => (
            <div key={i} className="flex gap-5 sm:gap-8 items-start">
              <span className="text-4xl sm:text-6xl font-bold text-gray-200 leading-none flex-shrink-0">{s.num}</span>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-base sm:text-lg leading-relaxed">{s.desc}</p>
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
    <section className="py-20 sm:py-32 px-5 sm:px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 tracking-tight mb-5 sm:mb-6">
          Take AI offline.
        </h2>
        <p className="text-base sm:text-lg text-gray-400 mb-8 sm:mb-10">Free. Open source. MIT licensed.</p>
        <button className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white font-semibold px-8 py-4 rounded-full text-lg transition-colors">
          Download Tasmania
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-8 px-5 sm:px-6 border-t border-gray-100">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <span>Tasmania &middot; Open source &middot; MIT License</span>
        <a href="https://github.com/mbaril010/tasmania" className="hover:text-gray-600 transition-colors">GitHub</a>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />
      <AppPreview />
      <Features />
      <Steps />
      <CTA />
      <Footer />
    </div>
  );
}
