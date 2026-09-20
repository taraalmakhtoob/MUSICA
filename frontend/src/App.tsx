import Converter from './components/Converter';

function App() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0) 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center min-h-screen px-4">
        {/* Header */}
        <header className="pt-28 pb-6 text-center animate-fade-in">
          <h1 className="text-[3.5rem] font-bold tracking-tight text-white leading-none">
            musica
          </h1>
          <p className="text-sm text-[#52525b] mt-4 tracking-wide">
            convert anything
          </p>
        </header>

        {/* Converter */}
        <main className="w-full max-w-[760px] mt-14 animate-fade-in-delay">
          <Converter />
        </main>

        {/* Footer */}
        <footer className="mt-auto pb-10 pt-20 text-center space-y-2">
          <p className="text-xs text-[#3f3f46] tracking-wider">
            files auto-delete after download
          </p>
          <p className="text-sm text-[#52525b] tracking-wide font-medium">
            made by tara
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
