'use client';

import { useEffect, useState } from 'react';

export default function Preloader({ onFinish }: { onFinish?: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTagline, setShowTagline] = useState(false);
  const [showScene, setShowScene] = useState(false);

  useEffect(() => {
    // Staggered reveal
    const t1 = setTimeout(() => setShowScene(true), 400);
    const t2 = setTimeout(() => setShowTagline(true), 1200);

    // Progress bar fills over 6 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 60);

    // Total display: ~6 seconds
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => onFinish?.(), 700);
    }, 6000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-700 ${
        fadeOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'radial-gradient(ellipse at center, #fff7ed 0%, #ffffff 50%, #f9fafb 100%)',
      }}
    >
      {/* Soft background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-100 rounded-full blur-3xl opacity-40 orb-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-amber-100 rounded-full blur-3xl opacity-30 orb-float-delayed"></div>
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-orange-50 rounded-full blur-2xl opacity-50 orb-float-slow"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo with glow */}
        <div className="relative mb-8">
          <div className="absolute inset-0 w-24 h-24 bg-orange-400 rounded-full blur-xl opacity-20 pulse-glow"></div>
          <div className="w-24 h-24 flex items-center justify-center logo-entrance">
            <img src="/logo.png" alt="EPC Logo" className="w-24 h-24 object-contain rounded-full drop-shadow-2xl" />
          </div>
          {/* Orbiting ring */}
          <div className="absolute inset-[-8px] rounded-full border-2 border-orange-200 opacity-60 orbit-ring"></div>
        </div>

        {/* Animated pastoral scene */}
        <div
          className={`relative w-72 h-32 mb-8 transition-all duration-1000 ${
            showScene ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Rolling hills */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 288 40" className="w-full h-10">
              <path
                d="M0,40 Q36,20 72,28 Q108,36 144,24 Q180,12 216,28 Q252,40 288,32 L288,40 Z"
                fill="url(#hillGradient)"
                className="hill-draw"
              />
              <defs>
                <linearGradient id="hillGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fed7aa" />
                  <stop offset="50%" stopColor="#fdba74" />
                  <stop offset="100%" stopColor="#fed7aa" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Shepherd with staff */}
          <div className="absolute bottom-6 right-10 shepherd-appear">
            <div className="relative flex flex-col items-center">
              {/* Halo glow */}
              <div className="absolute -top-2 w-10 h-10 bg-orange-300 rounded-full blur-md opacity-30 pulse-glow"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-700 flex items-center justify-center shadow-lg z-10">
                <span className="text-sm">🧑‍🌾</span>
              </div>
              <div className="w-0.5 h-8 bg-gradient-to-b from-amber-700 to-amber-900 rounded-full -mt-1"></div>
              {/* Sparkles around shepherd */}
              <div className="absolute -left-4 -top-1 sparkle-1">✦</div>
              <div className="absolute -right-3 top-1 sparkle-2">✦</div>
            </div>
          </div>

          {/* Sheep 1 - leading */}
          <div className="absolute bottom-5 sheep-run-1">
            <div className="relative sheep-hop-1">
              <div className="w-11 h-9 bg-white rounded-full border-2 border-gray-100 shadow-lg flex items-center justify-center">
                <span className="text-lg">🐑</span>
              </div>
              {/* Trail */}
              <div className="absolute -left-3 top-3 flex gap-0.5 trail-fade">
                <div className="w-1.5 h-0.5 bg-orange-200 rounded-full"></div>
                <div className="w-1 h-0.5 bg-orange-100 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Sheep 2 - following */}
          <div className="absolute bottom-5 sheep-run-2">
            <div className="relative sheep-hop-2">
              <div className="w-9 h-7 bg-white rounded-full border-2 border-gray-100 shadow-md flex items-center justify-center opacity-80">
                <span className="text-sm">🐑</span>
              </div>
            </div>
          </div>

          {/* Sheep 3 - small, far behind */}
          <div className="absolute bottom-4 sheep-run-3">
            <div className="relative sheep-hop-3">
              <div className="w-7 h-6 bg-white rounded-full border border-gray-100 shadow-sm flex items-center justify-center opacity-50">
                <span className="text-xs">🐑</span>
              </div>
            </div>
          </div>

          {/* Floating hearts / sparkles */}
          <div className="absolute top-2 left-1/3 heart-float-1 text-orange-300 text-xs">♥</div>
          <div className="absolute top-4 left-1/2 heart-float-2 text-orange-200 text-[10px]">♥</div>
        </div>

        {/* App Name */}
        <div className="text-center title-entrance">
          <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 bg-clip-text text-transparent drop-shadow-sm">
            The Fold
          </h1>
          <p
            className={`text-sm text-gray-500 mt-2 tracking-[0.2em] uppercase font-medium transition-all duration-1000 ${
              showTagline ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            Everything by Prayer Church
          </p>
        </div>

        {/* Progress bar */}
        <div className="mt-8 w-48">
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 rounded-full transition-all duration-100 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-2 font-medium tracking-wide">
            Gathering the flock...
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes sheepRun1 {
          0% { left: -20px; }
          70% { left: calc(60% - 40px); }
          100% { left: calc(60% - 40px); }
        }
        @keyframes sheepRun2 {
          0% { left: -40px; }
          75% { left: calc(48% - 30px); }
          100% { left: calc(48% - 30px); }
        }
        @keyframes sheepRun3 {
          0% { left: -50px; }
          80% { left: calc(36% - 20px); }
          100% { left: calc(36% - 20px); }
        }
        @keyframes sheepHop {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(-6px) rotate(-2deg); }
          60% { transform: translateY(0) rotate(1deg); }
          80% { transform: translateY(-3px) rotate(0deg); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(10px, -10px) scale(1.05); }
        }
        @keyframes orbFloatDelayed {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-8px, 8px) scale(1.08); }
        }
        @keyframes orbFloatSlow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(5px, -15px); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
        }
        @keyframes orbitRing {
          0% { transform: rotate(0deg) scale(1); opacity: 0.6; }
          50% { transform: rotate(180deg) scale(1.05); opacity: 0.3; }
          100% { transform: rotate(360deg) scale(1); opacity: 0.6; }
        }
        @keyframes logoEntrance {
          0% { transform: scale(0.5) rotate(-10deg); opacity: 0; }
          50% { transform: scale(1.1) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes titleEntrance {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes shepherdAppear {
          0% { opacity: 0; transform: scale(0.8) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes heartFloat {
          0% { opacity: 0; transform: translateY(0) scale(0.5); }
          30% { opacity: 1; transform: translateY(-8px) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(0.3); }
        }
        @keyframes trailFade {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes hillDraw {
          0% { opacity: 0; transform: scaleX(0); transform-origin: left; }
          100% { opacity: 1; transform: scaleX(1); transform-origin: left; }
        }

        .orb-float { animation: orbFloat 6s ease-in-out infinite; }
        .orb-float-delayed { animation: orbFloatDelayed 7s ease-in-out infinite; animation-delay: 1s; }
        .orb-float-slow { animation: orbFloatSlow 8s ease-in-out infinite; animation-delay: 2s; }
        .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        .orbit-ring { animation: orbitRing 4s linear infinite; }
        .logo-entrance { animation: logoEntrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .title-entrance { animation: titleEntrance 0.6s ease-out forwards; animation-delay: 0.5s; opacity: 0; }
        .shepherd-appear { animation: shepherdAppear 0.6s ease-out forwards; animation-delay: 0.8s; opacity: 0; }
        .hill-draw { animation: hillDraw 1s ease-out forwards; animation-delay: 0.3s; opacity: 0; }

        .sheep-run-1 { animation: sheepRun1 3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards; animation-delay: 1s; left: -20px; }
        .sheep-run-2 { animation: sheepRun2 3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards; animation-delay: 1.4s; left: -40px; }
        .sheep-run-3 { animation: sheepRun3 3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards; animation-delay: 1.8s; left: -50px; }

        .sheep-hop-1 { animation: sheepHop 0.5s ease-in-out infinite; }
        .sheep-hop-2 { animation: sheepHop 0.5s ease-in-out infinite; animation-delay: 0.15s; }
        .sheep-hop-3 { animation: sheepHop 0.5s ease-in-out infinite; animation-delay: 0.3s; }

        .trail-fade { animation: trailFade 0.4s ease-in-out infinite; }

        .sparkle-1 {
          animation: sparkle 1.5s ease-in-out infinite;
          color: #f97316;
          font-size: 8px;
        }
        .sparkle-2 {
          animation: sparkle 1.5s ease-in-out infinite;
          animation-delay: 0.7s;
          color: #fb923c;
          font-size: 6px;
        }
        .heart-float-1 { animation: heartFloat 2.5s ease-out infinite; animation-delay: 2s; }
        .heart-float-2 { animation: heartFloat 2.5s ease-out infinite; animation-delay: 3s; }
      `}</style>
    </div>
  );
}
