import React, { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, User, Loader2, KeyRound, Shield, Rocket, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import B2BPWAInstallButton from './components/B2BPWAInstallButton';

interface B2BLoginProps {
  mode?: 'agent' | 'admin' | 'both';
}

// Interactive Starfield & Constellation Canvas Component
function InteractiveStarfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Mouse tracking
    const mouse = {
      x: width / 2,
      y: height / 2,
      active: false,
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Generate Stars / Particles
    const particleCount = Math.floor((width * height) / 12000);
    const particles: Array<{
      x: number;
      y: number;
      radius: number;
      baseAlpha: number;
      alpha: number;
      vx: number;
      vy: number;
      color: string;
    }> = [];

    const colors = ['#ffffff', '#e9d5ff', '#c084fc', '#818cf8', '#a5b4fc'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 0.8,
        baseAlpha: Math.random() * 0.5 + 0.3,
        alpha: Math.random() * 0.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move particles
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Mouse interaction distance
        let distMouse = 9999;
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          distMouse = Math.sqrt(dx * dx + dy * dy);

          // Push particles slightly away from mouse pointer
          if (distMouse < 140) {
            const force = (140 - distMouse) / 140;
            const angle = Math.atan2(dy, dx);
            p.x += Math.cos(angle) * force * 2;
            p.y += Math.sin(angle) * force * 2;

            // Brighten particle near mouse
            p.alpha = Math.min(1, p.baseAlpha + force * 0.7);

            // Draw line to mouse pointer
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(192, 132, 252, ${0.4 * force})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          } else {
            p.alpha = p.baseAlpha;
          }
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (distMouse < 140 ? 1.5 : 1), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = distMouse < 140 ? 12 : 4;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Draw constellation lines between nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const pdx = p.x - p2.x;
          const pdy = p.y - p2.y;
          const pDist = Math.sqrt(pdx * pdx + pdy * pdy);

          if (pDist < 90) {
            const lineAlpha = (1 - pDist / 90) * 0.25;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(168, 85, 247, ${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none w-full h-full"
    />
  );
}

export default function B2BLogin({ mode = 'both' }: B2BLoginProps) {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState<'agent' | 'admin'>(
    mode === 'admin' ? 'admin' : 'agent'
  );
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState('');

  // Mouse Glow Position Tracking
  const [mousePos, setMousePos] = useState({ x: -200, y: -200 });

  const currentMode = mode !== 'both' ? mode : loginType;

  // Auto-redirect if already logged in as Admin or Agent
  useEffect(() => {
    const b2bAdminId = localStorage.getItem('b2bAdminId');
    const b2bAgentId = localStorage.getItem('b2bAgentId');

    if (currentMode === 'admin' && b2bAdminId) {
      navigate('/b2b/admin/dashboard', { replace: true });
    } else if (currentMode === 'agent' && b2bAgentId) {
      navigate('/b2b/agent/dashboard', { replace: true });
    } else if (mode === 'both') {
      if (b2bAdminId) {
        navigate('/b2b/admin/dashboard', { replace: true });
      } else if (b2bAgentId) {
        navigate('/b2b/agent/dashboard', { replace: true });
      }
    }
  }, [currentMode, mode, navigate]);

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      setError('Please enter your Login ID and Password.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      if (currentMode === 'admin') {
        // Admin Login - Check admin_profiles table
        const { data: adminUser, error: adminError } = await supabase
          .from('admin_profiles')
          .select('id, role')
          .eq('mobile_number', loginId)
          .eq('password', password)
          .single();

        if (adminError || !adminUser) {
          setError('Invalid Admin Mobile Number or Password.');
          setLoading(false);
        } else {
          localStorage.setItem('b2bAdminId', adminUser.id);
          // Trigger Rocket Launch Animation (Orbit around login box like Earth around Sun, then blast off)
          setIsLaunching(true);
          setTimeout(() => {
            navigate('/b2b/admin');
          }, 3200);
        }
      } else {
        // Agent Login - Check b2b_api_credentials
        const { data: b2bCred, error: credError } = await supabase
          .from('b2b_api_credentials')
          .select('id, is_active')
          .eq('b2b_login_id', loginId)
          .eq('b2b_password', password)
          .single();

        if (credError || !b2bCred) {
          setError('Invalid B2B Login ID or Password.');
          setLoading(false);
        } else if (!b2bCred.is_active) {
          setError('Your B2B API access is currently disabled.');
          setLoading(false);
        } else {
          localStorage.setItem('b2bAgentId', b2bCred.id);
          // Trigger Rocket Launch Animation (Orbit around login box like Earth around Sun, then blast off)
          setIsLaunching(true);
          setTimeout(() => {
            navigate('/b2b/agent');
          }, 3200);
        }
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div 
      onMouseMove={handleContainerMouseMove}
      className="min-h-screen bg-gradient-to-b from-[#180036] via-[#2a0845] to-[#12002b] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans"
    >
      
      {/* Interactive Canvas Starfield (Responds to Mouse Movements & Constellation Lines!) */}
      <InteractiveStarfield />

      {/* Mouse Radial Spotlight Glow Follower */}
      <motion.div
        animate={{ x: mousePos.x - 160, y: mousePos.y - 160 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180, mass: 0.5 }}
        className="fixed top-0 left-0 w-80 h-80 bg-gradient-to-r from-purple-500/20 via-fuchsia-500/15 to-indigo-500/10 rounded-full blur-[80px] pointer-events-none z-0"
      />

      {/* Background Starry Glow & Static Ambient Lights */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-purple-600/20 blur-[150px] rounded-full" />
        <div className="absolute top-10 left-10 w-72 h-72 bg-indigo-500/15 blur-[120px] rounded-full" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-fuchsia-600/15 blur-[140px] rounded-full" />
      </div>

      {/* Mountain Silhouettes at Bottom (Matching Design 2) */}
      <div className="absolute bottom-0 left-0 right-0 w-full pointer-events-none z-0">
        <svg className="w-full h-40 sm:h-56 lg:h-72 object-cover opacity-85" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#0a001a" fillOpacity="1" d="M0,192L48,176C96,160,192,128,288,138.7C384,149,480,203,576,213.3C672,224,768,192,864,165.3C960,139,1056,117,1152,128C1248,139,1344,181,1392,202.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          <path fill="#170133" fillOpacity="0.7" d="M0,256L60,229.3C120,203,240,149,360,149.3C480,149,600,203,720,218.7C840,235,960,213,1080,192C1200,171,1320,149,1380,138.7L1440,128L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"></path>
        </svg>
      </div>

      {/* Rocket Launch Overlay Animation (Revolving Around Login Box like Earth around Sun) */}
      <AnimatePresence>
        {isLaunching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
          >
            {/* Orbit Axis Container Centered at Login Card */}
            <motion.div
              animate={{ rotate: [0, 360, 360] }}
              transition={{
                duration: 3.2,
                times: [0, 0.75, 1],
                ease: "easeInOut"
              }}
              className="relative w-1 h-1 flex items-center justify-center"
            >
              {/* Rocket Traveling on 260px Radius Ring around Card */}
              <motion.div
                animate={{
                  y: [-250, -250, -1400],
                  scale: [1, 1.25, 4.0],
                  opacity: [1, 1, 0]
                }}
                transition={{
                  duration: 3.2,
                  times: [0, 0.75, 1],
                  ease: "easeInOut"
                }}
                className="absolute flex flex-col items-center justify-center -rotate-90"
              >
                <div className="relative flex flex-col items-center">
                  <Rocket className="h-20 w-20 text-white drop-shadow-[0_0_40px_rgba(192,132,252,1)]" />
                  {/* Glowing Rocket Flame */}
                  <motion.div
                    animate={{ scaleY: [1, 1.8, 1], opacity: [0.9, 1, 0.9] }}
                    transition={{ repeat: Infinity, duration: 0.12 }}
                    className="w-5 h-20 bg-gradient-to-b from-yellow-300 via-orange-500 to-transparent rounded-full -mt-2 blur-[2px] shadow-[0_0_35px_#f97316]"
                  />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Right Floating Install App Button */}
      <div className="absolute top-4 right-4 z-20">
        <B2BPWAInstallButton variant="header" />
      </div>

      {/* Header Logo (UsePay Logo Kept Intact!) */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 mb-6 text-center">
        <div className="flex justify-center mb-3">
          <img 
            src="/logo.png" 
            alt="UsePay Logo" 
            className="h-16 sm:h-20 max-h-24 object-contain filter drop-shadow-[0_4px_20px_rgba(168,85,247,0.4)]" 
          />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
          {currentMode === 'admin' ? 'B2B Admin Portal' : 'B2B API Agent Portal'}
        </h2>
        <p className="mt-1.5 text-sm text-purple-200/80 font-medium">
          {currentMode === 'admin' 
            ? 'Sign in to access your B2B Admin Dashboard' 
            : 'Sign in to access your Agent API Dashboard'}
        </p>

        <div className="mt-3 flex justify-center">
          <B2BPWAInstallButton variant="badge" />
        </div>
      </div>

      {/* Glassmorphism Login Card (Matching Design 2) */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/10 backdrop-blur-md py-8 px-6 sm:px-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-3xl border border-white/20">
          
          {mode === 'both' && (
            <div className="flex p-1.5 bg-black/30 backdrop-blur-md rounded-full mb-8 border border-white/10">
              <button
                type="button"
                onClick={() => setLoginType('agent')}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                  loginType === 'agent' 
                    ? 'bg-white text-purple-950 shadow-lg font-bold' 
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                API Agent
              </button>
              <button
                type="button"
                onClick={() => setLoginType('admin')}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                  loginType === 'admin' 
                    ? 'bg-white text-purple-950 shadow-lg font-bold' 
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                B2B Admin
              </button>
            </div>
          )}

          <h3 className="text-2xl font-bold text-white text-center mb-6 tracking-wide">
            Login
          </h3>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-red-500/20 border border-red-400/50 rounded-2xl p-3.5 flex items-start gap-3 backdrop-blur-md"
                >
                  <ShieldCheck className="h-5 w-5 text-red-300 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-red-100 font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username / Login ID Field (Pill Rounded Input with Right Icon) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-purple-200/90 pl-3">
                {currentMode === 'admin' ? 'Admin Mobile Number' : 'B2B Login ID'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-full py-3.5 pl-6 pr-12 text-white placeholder-purple-200/40 text-sm outline-none focus:border-white/60 focus:bg-white/20 focus:ring-2 focus:ring-purple-400/40 transition-all font-medium"
                  placeholder={currentMode === 'admin' ? 'Enter mobile number' : 'Enter B2B Login ID'}
                />
                <User className="absolute right-4.5 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-200/80 pointer-events-none" />
              </div>
            </div>

            {/* Password Field (Pill Rounded Input with Right Icon) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-purple-200/90 pl-3">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-full py-3.5 pl-6 pr-12 text-white placeholder-purple-200/40 text-sm outline-none focus:border-white/60 focus:bg-white/20 focus:ring-2 focus:ring-purple-400/40 transition-all font-medium"
                  placeholder="Enter password"
                />
                <Lock className="absolute right-4.5 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-200/80 pointer-events-none" />
              </div>
            </div>

            {/* Sign In Full White Pill Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || isLaunching}
                className="w-full flex items-center justify-center py-3.5 px-6 rounded-full font-bold text-base text-purple-950 bg-white hover:bg-purple-50 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400 shadow-xl shadow-purple-950/40 disabled:opacity-75 disabled:cursor-not-allowed transition-all gap-2 cursor-pointer"
              >
                {loading || isLaunching ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-purple-900" />
                    <span>{isLaunching ? 'Launching...' : 'Signing In...'}</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <Sparkles className="h-5 w-5 text-purple-900" />
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
