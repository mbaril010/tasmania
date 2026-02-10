import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Tasmania Landing Page</h1>
        <p className="text-lg text-gray-600 mb-12">3 design propositions for review</p>
        <div className="grid gap-6">
          <Link
            href="/proposition-1"
            className="block p-8 bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all text-left"
          >
            <span className="text-sm font-medium text-indigo-600 mb-2 block">Proposition 1</span>
            <span className="text-xl font-semibold text-gray-900 block mb-2">Light &amp; Connected</span>
            <span className="text-gray-500">Clean white design with connected workflow nodes. Inspired by CoreShift — friendly and approachable.</span>
          </Link>
          <Link
            href="/proposition-2"
            className="block p-8 bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all text-left"
          >
            <span className="text-sm font-medium text-indigo-600 mb-2 block">Proposition 2</span>
            <span className="text-xl font-semibold text-gray-900 block mb-2">Bold &amp; Minimal</span>
            <span className="text-gray-500">Large typography with generous whitespace. Inspired by Pallet Ross — statement-driven and elegant.</span>
          </Link>
          <Link
            href="/proposition-3"
            className="block p-8 bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all text-left"
          >
            <span className="text-sm font-medium text-indigo-600 mb-2 block">Proposition 3</span>
            <span className="text-xl font-semibold text-gray-900 block mb-2">Dark &amp; Technical</span>
            <span className="text-gray-500">Dark theme matching the app&apos;s UI. Indigo gradients with a developer-friendly feel — modern and confident.</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
