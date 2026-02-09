'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import Image from 'next/image'

// Building group that can be repeated for seamless scrolling
const SkylineBuildings = ({ offset = 0 }: { offset?: number }) => (
  <g transform={`translate(${offset}, 0)`}>
    {/* Background layer - distant buildings */}
    <g opacity="0.4">
      <rect x="50" y="200" width="60" height="120" fill="#500000" />
      <rect x="130" y="180" width="45" height="140" fill="#500000" />
      <rect x="350" y="210" width="40" height="110" fill="#500000" />
      <rect x="550" y="195" width="50" height="125" fill="#500000" />
      <rect x="750" y="205" width="45" height="115" fill="#500000" />
      <rect x="950" y="190" width="55" height="130" fill="#500000" />
      <rect x="1150" y="200" width="50" height="120" fill="#500000" />
    </g>

    {/* Kyle Field - Stadium */}
    <g>
      <path d="M80 320 L80 200 L120 180 L200 180 L240 200 L240 320 Z" fill="url(#buildingGradient2)" />
      <path d="M90 280 L90 220 L230 220 L230 280" fill="none" stroke="#3a0000" strokeWidth="2" />
      <path d="M100 260 L100 230 L220 230 L220 260" fill="none" stroke="#3a0000" strokeWidth="2" />
      <rect x="130" y="160" width="60" height="25" fill="#500000" />
      <rect x="135" y="165" width="12" height="10" fill="#ffcc00" opacity="0.6" />
      <rect x="152" y="165" width="12" height="10" fill="#ffcc00" opacity="0.6" />
      <rect x="169" y="165" width="12" height="10" fill="#ffcc00" opacity="0.6" />
      <rect x="145" y="140" width="30" height="18" fill="#2a0000" />
      <text x="160" y="153" fill="#ffcc00" fontSize="8" textAnchor="middle" fontWeight="bold">12TH</text>
    </g>

    {/* Reed Arena */}
    <g>
      <path d="M280 320 L280 220 Q340 180 400 220 L400 320 Z" fill="url(#buildingGradient2)" />
      <path d="M285 225 Q340 190 395 225" fill="none" stroke="#3a0000" strokeWidth="3" />
      <rect x="320" y="280" width="40" height="40" fill="#3a0000" />
      <rect x="330" y="285" width="20" height="30" fill="#ffcc00" opacity="0.5" />
    </g>

    {/* Evans Library */}
    <g>
      <rect x="450" y="180" width="140" height="140" fill="url(#buildingGradient2)" />
      <rect x="445" y="170" width="150" height="15" fill="#500000" />
      <rect x="460" y="200" width="50" height="80" fill="#ffcc00" opacity="0.25" />
      <rect x="530" y="200" width="50" height="80" fill="#ffcc00" opacity="0.25" />
      <rect x="460" y="240" width="50" height="2" fill="#3a0000" />
      <rect x="530" y="240" width="50" height="2" fill="#3a0000" />
    </g>

    {/* Academic Building (Albritton Tower) */}
    <g>
      <rect x="650" y="100" width="80" height="220" fill="url(#buildingGradient)" />
      <path d="M650 100 L690 50 L730 100 Z" fill="#500000" />
      <circle cx="690" cy="65" r="8" fill="#ffcc00" opacity="0.8" />
      <rect x="660" y="120" width="15" height="20" fill="#ffcc00" opacity="0.5" />
      <rect x="682" y="120" width="15" height="20" fill="#ffcc00" opacity="0.5" />
      <rect x="705" y="120" width="15" height="20" fill="#ffcc00" opacity="0.5" />
      <rect x="660" y="160" width="15" height="20" fill="#ffcc00" opacity="0.4" />
      <rect x="682" y="160" width="15" height="20" fill="#ffcc00" opacity="0.4" />
      <rect x="705" y="160" width="15" height="20" fill="#ffcc00" opacity="0.4" />
      <rect x="660" y="200" width="15" height="20" fill="#ffcc00" opacity="0.3" />
      <rect x="682" y="200" width="15" height="20" fill="#ffcc00" opacity="0.3" />
      <rect x="705" y="200" width="15" height="20" fill="#ffcc00" opacity="0.3" />
      <rect x="580" y="180" width="70" height="140" fill="url(#buildingGradient2)" />
      <rect x="730" y="180" width="70" height="140" fill="url(#buildingGradient2)" />
      <rect x="590" y="200" width="12" height="15" fill="#ffcc00" opacity="0.4" />
      <rect x="610" y="200" width="12" height="15" fill="#ffcc00" opacity="0.4" />
      <rect x="630" y="200" width="12" height="15" fill="#ffcc00" opacity="0.4" />
      <rect x="740" y="200" width="12" height="15" fill="#ffcc00" opacity="0.4" />
      <rect x="760" y="200" width="12" height="15" fill="#ffcc00" opacity="0.4" />
      <rect x="780" y="200" width="12" height="15" fill="#ffcc00" opacity="0.4" />
      <rect x="665" y="260" width="8" height="60" fill="#3a0000" />
      <rect x="680" y="260" width="8" height="60" fill="#3a0000" />
      <rect x="695" y="260" width="8" height="60" fill="#3a0000" />
      <rect x="710" y="260" width="8" height="60" fill="#3a0000" />
    </g>

    {/* Memorial Student Center */}
    <g>
      <rect x="880" y="160" width="120" height="160" fill="url(#buildingGradient)" />
      <rect x="875" y="155" width="130" height="8" fill="#3a0000" />
      <rect x="935" y="120" width="3" height="40" fill="#3a0000" />
      <rect x="938" y="122" width="25" height="15" fill="#500000" />
      <rect x="890" y="175" width="15" height="20" fill="#ffcc00" opacity="0.3" />
      <rect x="912" y="175" width="15" height="20" fill="#ffcc00" opacity="0.3" />
      <rect x="934" y="175" width="15" height="20" fill="#ffcc00" opacity="0.3" />
      <rect x="956" y="175" width="15" height="20" fill="#ffcc00" opacity="0.3" />
      <rect x="978" y="175" width="15" height="20" fill="#ffcc00" opacity="0.3" />
      <rect x="890" y="210" width="15" height="20" fill="#ffcc00" opacity="0.4" />
      <rect x="912" y="210" width="15" height="20" fill="#ffcc00" opacity="0.4" />
      <rect x="934" y="210" width="15" height="20" fill="#ffcc00" opacity="0.4" />
      <rect x="956" y="210" width="15" height="20" fill="#ffcc00" opacity="0.4" />
      <rect x="978" y="210" width="15" height="20" fill="#ffcc00" opacity="0.4" />
    </g>

    {/* Bright Building / ILSB */}
    <g>
      <rect x="1050" y="200" width="60" height="120" fill="url(#buildingGradient2)" />
      <rect x="1045" y="195" width="70" height="8" fill="#500000" />
      <rect x="1060" y="215" width="15" height="20" fill="#ffcc00" opacity="0.4" />
      <rect x="1085" y="215" width="15" height="20" fill="#ffcc00" opacity="0.4" />
      <rect x="1060" y="250" width="15" height="20" fill="#ffcc00" opacity="0.3" />
      <rect x="1085" y="250" width="15" height="20" fill="#ffcc00" opacity="0.3" />
    </g>

    {/* Zachry Engineering Building */}
    <g>
      <rect x="1150" y="140" width="100" height="180" fill="url(#buildingGradient)" />
      <path d="M1150 140 L1200 110 L1250 140 Z" fill="#500000" />
      <rect x="1160" y="155" width="80" height="150" fill="#ffcc00" opacity="0.15" />
      <rect x="1160" y="180" width="80" height="2" fill="#3a0000" />
      <rect x="1160" y="210" width="80" height="2" fill="#3a0000" />
      <rect x="1160" y="240" width="80" height="2" fill="#3a0000" />
      <rect x="1160" y="270" width="80" height="2" fill="#3a0000" />
    </g>

    {/* Trees/landscaping silhouettes */}
    <g opacity="0.6">
      <ellipse cx="260" cy="315" rx="20" ry="15" fill="#2a0000" />
      <ellipse cx="430" cy="310" rx="25" ry="20" fill="#3a0000" />
      <ellipse cx="840" cy="315" rx="20" ry="15" fill="#2a0000" />
      <ellipse cx="860" cy="310" rx="25" ry="20" fill="#3a0000" />
      <ellipse cx="1030" cy="315" rx="18" ry="14" fill="#2a0000" />
      <ellipse cx="1280" cy="312" rx="22" ry="18" fill="#3a0000" />
    </g>
  </g>
)

// TAMU Skyline SVG Component with continuous scrolling animation
const TAMUSkyline = () => (
  <div className="overflow-hidden h-24 sm:h-32">
    <svg 
      viewBox="0 0 1440 320" 
      className="w-[200%] h-full animate-skyline-scroll"
      preserveAspectRatio="xMinYMax slice"
      style={{ minWidth: '200%' }}
    >
      <defs>
        <linearGradient id="buildingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#500000" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#500000" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="buildingGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7D0000" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#500000" stopOpacity="1" />
        </linearGradient>
      </defs>
      
      {/* First set of buildings */}
      <SkylineBuildings offset={0} />
      
      {/* Second set (duplicate) for seamless loop */}
      <SkylineBuildings offset={1440} />
      
      {/* Continuous ground */}
      <rect x="0" y="318" width="2880" height="5" fill="#500000" />
    </svg>
  </div>
)

// Animated stat counter component
const AnimatedCounter = ({ end, suffix = '' }: { end: number; suffix?: string }) => {
  const [count, setCount] = useState(0)
  
  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = end / steps
    let current = 0
    
    const timer = setInterval(() => {
      current += increment
      if (current >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    
    return () => clearInterval(timer)
  }, [end])
  
  return <span>{count.toLocaleString()}{suffix}</span>
}

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard')
      } else {
        setShowContent(true)
      }
    }
  }, [user, loading, router])

  if (loading || !showContent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white overflow-hidden">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Image 
                src="/logo.png" 
                alt="ORGanize Campus Logo" 
                width={40} 
                height={40}
                className="rounded-xl shadow-lg"
              />
              <span className="text-xl font-bold text-tamu-maroon">ORGanize Campus</span>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/login"
                className="text-gray-600 hover:text-tamu-maroon transition-colors font-medium"
              >
                Sign In
              </Link>
              <Link 
                href="/register"
                className="px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors shadow-md hover:shadow-lg"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center pt-16">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-tamu-maroon/5 rounded-full blur-3xl" />
          <div className="absolute top-40 right-20 w-96 h-96 bg-tamu-maroon/5 rounded-full blur-3xl" />
          <div className="absolute bottom-40 left-1/4 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <div className="text-center">
            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight"
            >
              Making Texas A&M the{' '}
              <span className="relative inline-block">
                <span className="text-tamu-maroon">#1 University</span>
                <svg 
                  className="absolute -bottom-2 left-0 w-full h-4"
                  viewBox="0 0 300 16"
                  fill="none"
                >
                  <motion.path 
                    d="M2 12 Q75 4 150 12 Q225 20 298 12" 
                    stroke="#500000" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ 
                      duration: 1.2, 
                      delay: 0.8,
                      ease: "easeInOut"
                    }}
                  />
                </svg>
              </span>
              <br />
              for student orgs
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl md:text-2xl text-gray-600 mb-4 max-w-3xl mx-auto leading-relaxed"
            >
              Discover, apply, and engage with student organizations.
              <br className="hidden sm:block" />
              <span className="text-gray-500">All in one place.</span>
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-base sm:text-lg text-tamu-maroon font-medium mb-10"
            >
              Built for students. Built for orgs. Built for A&M.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
            >
              <Link href="/register">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(80, 0, 0, 0.3)' }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
                >
                  Join the platform
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </motion.button>
              </Link>
              <Link href="/login?type=org">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 bg-white text-tamu-maroon rounded-xl font-semibold text-lg border-2 border-tamu-maroon/20 hover:border-tamu-maroon/40 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  I&apos;m a student org
                </motion.button>
              </Link>
            </motion.div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex items-center justify-center gap-2 text-gray-500"
            >
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-tamu-maroon to-tamu-maroon-light border-2 border-white flex items-center justify-center"
                  >
                    <span className="text-white text-xs font-bold">{['A', 'T', 'M', '!'][i]}</span>
                  </div>
                ))}
              </div>
              <span className="text-sm sm:text-base">
                Built for <span className="font-semibold text-tamu-maroon"><AnimatedCounter end={1300} />+</span> student organizations at Texas A&M
              </span>
            </motion.div>
          </div>
        </div>

        {/* TAMU Skyline */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative mt-auto"
        >
          {/* Gradient overlay for smooth transition */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white to-transparent z-10" />
          
          <div className="relative">
            {/* Stars/sparkles above skyline */}
            <div className="absolute inset-x-0 bottom-full mb-4 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0.3, 0.8, 0.3], scale: 1 }}
                  transition={{ 
                    duration: 2 + Math.random() * 2, 
                    delay: 1 + Math.random() * 0.5,
                    repeat: Infinity,
                    repeatType: 'reverse'
                  }}
                  className="absolute w-1 h-1 bg-tamu-maroon rounded-full"
                  style={{
                    left: `${10 + Math.random() * 80}%`,
                    bottom: `${Math.random() * 60}px`
                  }}
                />
              ))}
            </div>
            
            <TAMUSkyline />
          </div>
        </motion.div>
      </section>

      {/* Features Section - Below the fold */}
      <section className="py-16 bg-tamu-maroon">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row items-center justify-between text-center md:text-left"
          >
            {/* Feature 1 */}
            <div className="flex-1 py-4 md:py-0 md:px-6">
              <h3 className="text-lg font-semibold text-white mb-1">Smart Discovery</h3>
              <p className="text-white/60 text-sm">AI-powered recommendations based on your interests</p>
            </div>
            
            {/* Divider */}
            <div className="hidden md:block w-px h-12 bg-white/20" />
            <div className="md:hidden w-32 h-px bg-white/20 my-2" />
            
            {/* Feature 2 */}
            <div className="flex-1 py-4 md:py-0 md:px-6">
              <h3 className="text-lg font-semibold text-white mb-1">One-Click Applications</h3>
              <p className="text-white/60 text-sm">Apply to orgs without repeating yourself</p>
            </div>
            
            {/* Divider */}
            <div className="hidden md:block w-px h-12 bg-white/20" />
            <div className="md:hidden w-32 h-px bg-white/20 my-2" />
            
            {/* Feature 3 */}
            <div className="flex-1 py-4 md:py-0 md:px-6">
              <h3 className="text-lg font-semibold text-white mb-1">Org Management</h3>
              <p className="text-white/60 text-sm">Custom forms, member tracking, and more</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Ready to find your place at A&M?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Join hundreds of Aggies already using ORGanize to connect with the organizations that matter most.
            </p>
            <Link href="/register">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all"
              >
                Get Started Free
              </motion.button>
            </Link>
            <p className="text-sm text-gray-500 mt-4">
              No credit card required. Just your Aggie spirit.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Image 
                src="/logo.png" 
                alt="ORGanize Campus Logo" 
                width={32} 
                height={32}
                className="rounded-lg"
              />
              <span className="text-gray-600">ORGanize Campus</span>
            </div>
            <p className="text-sm text-gray-500">
              Made with <span className="text-tamu-maroon">love</span> for Aggies, by Aggies
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Gig &apos;em!</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
