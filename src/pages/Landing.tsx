import { useState, FormEvent } from "react";
import logoSpinner from "@/assets/logo-spinner-2.gif";
import { setBackupId } from "@/utils/cloud-storage";

interface LandingProps {
  onAuthenticated: () => void;
}

// Shared band passcode, injected at build time so the real value never lands
// in git history. Set VITE_BAND_PASSCODE in .env.production.local (gitignored)
// before building/deploying. Rotate by changing that value and rebuilding.
const PASSCODE = import.meta.env.VITE_BAND_PASSCODE ?? "";

if (import.meta.env.DEV && !PASSCODE) {
  console.warn("VITE_BAND_PASSCODE is not set — see .env.example");
}

// Derives a stable cloud-sync identity from the shared passcode, so every
// device that unlocks with it reads and writes the same annotations/notes/
// loops instead of each browser getting its own disjoint anonymous dataset.
// This is just a scoping key for D1 rows, not a security boundary — the
// passcode gate above is the actual access control.
const deriveBandId = (passcode: string): string => {
  const encoded = btoa(`gigsprompter-band::${passcode.trim().toLowerCase()}`).replace(/[^a-zA-Z0-9]/g, "");
  return `band-${encoded.slice(0, 24)}`;
};

const Landing = ({ onAuthenticated }: LandingProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (PASSCODE && code.trim().toLowerCase() === PASSCODE.trim().toLowerCase()) {
      setError(false);
      setBackupId(deriveBandId(PASSCODE));
      onAuthenticated();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-4">
      <img
        src={logoSpinner}
        alt="Linkin Park Logo"
        className="w-40 h-auto mb-8 invert"
      />

      <div className="font-mono-body text-sm tracking-[0.3em] text-foreground mb-1 text-center">
        LINKIN PARK TRIBUTE
      </div>
      <div className="font-mono-body text-xs tracking-[0.2em] text-muted-foreground mb-10 text-center opacity-70">
        BY LADY ELEKTRA
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3 w-full max-w-xs">
        <input
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(false);
          }}
          placeholder="ENTER PASSCODE"
          autoFocus
          className={`w-full bg-transparent border font-mono-body text-sm tracking-[0.2em] text-center py-3 px-4 outline-none transition-colors ${
            error ? "border-destructive text-destructive" : "border-border text-foreground focus:border-primary"
          }`}
        />
        <button
          type="submit"
          className="w-full border border-border py-3 font-mono-body text-xs tracking-[0.3em] text-muted-foreground hover:text-accent hover:border-accent transition-colors"
        >
          ENTER
        </button>
        {error && (
          <div className="font-mono-body text-xs tracking-[0.15em] text-destructive mt-1">
            INCORRECT PASSCODE
          </div>
        )}
      </form>
    </div>
  );
};

export default Landing;
