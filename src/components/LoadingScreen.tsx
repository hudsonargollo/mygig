import { useState, useEffect } from "react";
import logoSpinner from "@/assets/logo-spinner-2.gif";

interface LoadingScreenProps {
  onComplete: () => void;
}

const TITLE_TEXT = "LINKIN PARK - TOCA DO RAUL 21/03";

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [typedText, setTypedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    let charIndex = 0;
    const typeInterval = setInterval(() => {
      if (charIndex < TITLE_TEXT.length) {
        setTypedText(TITLE_TEXT.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        // Start glitch after typing completes
        setTimeout(() => {
          setGlitching(true);
          // Cut to main after glitch
          setTimeout(() => {
            onComplete();
          }, 1000);
        }, 200);
      }
    }, 55);

    // Cursor blink
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => {
      clearInterval(typeInterval);
      clearInterval(cursorInterval);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Scanlines overlay during glitch */}
      {glitching && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.03) 2px, rgba(0,240,255,0.03) 4px)",
            animation: "scanlines 0.1s steps(2) infinite",
            opacity: 1,
          }}
        />
      )}

      {/* Logo and text container */}
      <div className="relative">
        {/* Glitch layer 1 - cyan */}
        {glitching && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              animation: "glitch-1 0.3s steps(1) infinite",
              color: "hsl(186 100% 50%)",
              mixBlendMode: "screen",
            }}
          >
            <img
              src={logoSpinner}
              alt=""
              className="w-48 h-auto mb-8 invert"
              style={{ filter: "invert(1) sepia(1) saturate(5) hue-rotate(160deg)" }}
            />
            <span className="font-mono-body text-sm tracking-[0.3em]">
              {typedText}
            </span>
          </div>
        )}

        {/* Glitch layer 2 - yellow */}
        {glitching && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              animation: "glitch-2 0.3s steps(1) infinite",
              color: "hsl(64 100% 50%)",
              mixBlendMode: "screen",
            }}
          >
            <img
              src={logoSpinner}
              alt=""
              className="w-48 h-auto mb-8 invert"
              style={{ filter: "invert(1) sepia(1) saturate(5) hue-rotate(20deg)" }}
            />
            <span className="font-mono-body text-sm tracking-[0.3em]">
              {typedText}
            </span>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col items-center justify-center relative z-10">
          <img
            src={logoSpinner}
            alt="Linkin Park Logo"
            className="w-48 h-auto mb-8 invert"
          />
          <div className="font-mono-body text-sm tracking-[0.3em] text-foreground">
            {typedText}
            <span
              className="inline-block w-[2px] h-4 bg-foreground ml-1 align-middle"
              style={{ opacity: showCursor ? 1 : 0 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
