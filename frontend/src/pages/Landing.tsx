/**
 * Landing.tsx — Marketing landing page.
 *
 * Aesthetic: Linear / Vercel — dark, minimal, opinionated.
 * Sections: Nav, Hero, Social Proof, Problem, How It Works,
 *           Code Snippet, Pricing, Footer.
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'
import {
  Github,
  ArrowRight,
  Star,
  AlertTriangle,
  ClipboardList,
  Users,
  CheckCircle2,
  Zap,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { cn } from '../lib/utils'

const API_BASE = import.meta.env['VITE_API_URL'] ?? ''

// ---------------------------------------------------------------------------
// Animated counter — counts up when scrolled into view
// ---------------------------------------------------------------------------
interface CountUpProps {
  target: number
  duration?: number
  suffix?: string
}

function CountUp({ target, duration = 1.5, suffix = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const shouldReduceMotion = useReducedMotion()
  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, {
    duration: shouldReduceMotion ? 0 : duration * 1000,
    bounce: 0,
  })
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (isInView) motionVal.set(target)
  }, [isInView, motionVal, target])

  useEffect(() => {
    return spring.on('change', (v) => {
      setDisplay(Math.floor(v).toLocaleString())
    })
  }, [spring])

  // Provide the final numeric value to screen readers so they hear the real
  // number rather than intermediate counting states.
  return (
    <span ref={ref} aria-label={`${target.toLocaleString()}${suffix}`}>
      <span aria-hidden="true">
        {display}
        {suffix}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Terminal typewriter — shows the contract YAML character by character
// ---------------------------------------------------------------------------
const TERMINAL_LINES = [
  { text: '$ dbt-contracts generate --manifest target/manifest.json', type: 'command' },
  { text: '', type: 'blank' },
  { text: '  Parsing manifest.json …', type: 'info' },
  { text: '  Found 47 models, 312 columns', type: 'info' },
  { text: '  Generating contracts with Claude …', type: 'info' },
  { text: '', type: 'blank' },
  { text: '  ✓  contracts/orders.yml', type: 'success' },
  { text: '  ✓  contracts/customers.yml', type: 'success' },
  { text: '  ✓  contracts/revenue_daily.yml', type: 'success' },
  { text: '  ✓  contracts/sessions.yml', type: 'success' },
  { text: '', type: 'blank' },
  { text: '  47 contracts written in 3.2s', type: 'done' },
]

function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (!isInView) return
    // If reduced motion is preferred, show all lines immediately — no typewriter
    if (shouldReduceMotion) {
      setVisibleLines(TERMINAL_LINES.length)
      return
    }
    let i = 0
    const tick = () => {
      i += 1
      setVisibleLines(i)
      if (i < TERMINAL_LINES.length) {
        setTimeout(tick, i === 0 ? 200 : 180)
      }
    }
    const t = setTimeout(tick, 400)
    return () => clearTimeout(t)
  }, [isInView, shouldReduceMotion])

  return (
    // role="img" + aria-label lets screen readers skip the animated
    // character-by-character noise and receive a meaningful summary instead.
    <div
      ref={ref}
      role="img"
      aria-label="Terminal demo: dbt-contracts generates 47 YAML contract files from a manifest.json in 3.2 seconds"
      className="rounded-xl border border-border bg-[#0D0D0D] overflow-hidden shadow-2xl shadow-black/60"
    >
      {/* Window chrome — decorative only */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-surface" aria-hidden="true">
        <span className="w-3 h-3 rounded-full bg-error/70" />
        <span className="w-3 h-3 rounded-full bg-warning/70" />
        <span className="w-3 h-3 rounded-full bg-success/70" />
        <span className="ml-3 text-xs text-text-muted font-mono">terminal</span>
      </div>
      {/* Output — aria-hidden because the role="img" label covers the content */}
      <div className="p-5 font-mono text-xs leading-6 min-h-[220px]" aria-hidden="true">
        {TERMINAL_LINES.slice(0, visibleLines).map((line, idx) => (
          <div
            key={idx}
            className={cn(
              'whitespace-pre',
              line.type === 'command' && 'text-text-primary',
              line.type === 'info' && 'text-text-muted',
              line.type === 'success' && 'text-success',
              line.type === 'done' && 'text-accent font-semibold',
              line.type === 'blank' && 'h-3',
            )}
          >
            {line.text}
            {idx === visibleLines - 1 && visibleLines < TERMINAL_LINES.length && (
              <span className="inline-block w-1.5 h-3.5 bg-text-primary ml-0.5 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nav bar
// ---------------------------------------------------------------------------
function NavBar() {
  const [starCount, setStarCount] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch('https://api.github.com/repos/athar-naaz/dbt-contracts')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.stargazers_count === 'number') setStarCount(d.stargazers_count)
      })
      .catch(() => {})
  }, [])

  return (
    <>
      {/* Skip navigation — visually hidden until focused (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      <nav
        aria-label="Primary"
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-200',
          'border-b backdrop-blur-md',
          scrolled
            ? 'border-border bg-bg/90'
            : 'border-transparent bg-transparent',
        )}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" aria-label="dbt-contracts home">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-accent group-hover:shadow-[0_0_8px_2px_rgb(124,58,237,0.6)] transition-shadow duration-300" />
            <span className="font-semibold text-sm tracking-tight text-text-primary">
              dbt-contracts
            </span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-1">
            <a
              href="#features"
              className="hidden sm:block px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors rounded"
            >
              Features
            </a>
            <Link
              to="/docs"
              className="hidden sm:block px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors rounded"
            >
              Docs
            </Link>
            <a
              href="https://github.com/athar-naaz/dbt-contracts"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                starCount !== null
                  ? `GitHub — ${starCount.toLocaleString()} stars (opens in new tab)`
                  : 'GitHub (opens in new tab)'
              }
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors rounded group"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              <span>GitHub</span>
              {starCount !== null && (
                <span
                  aria-hidden="true"
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface border border-border text-xs text-text-muted group-hover:border-border-hover transition-colors"
                >
                  <Star className="h-3 w-3" aria-hidden="true" />
                  {starCount.toLocaleString()}
                </span>
              )}
            </a>
            <Link to="/app" className="ml-2">
              <Button variant="primary" size="sm">
                Get started
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}

// ---------------------------------------------------------------------------
// Hero section
// ---------------------------------------------------------------------------
function useHeroVariants() {
  const shouldReduceMotion = useReducedMotion()
  const heroVariants = {
    hidden: {},
    visible: { transition: shouldReduceMotion ? {} : { staggerChildren: 0.12 } },
  }
  const heroItem = shouldReduceMotion
    ? { hidden: {}, visible: {} }
    : {
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
      }
  return { heroVariants, heroItem }
}

function Hero() {
  const { heroVariants, heroItem } = useHeroVariants()

  return (
    <section id="main-content" className="relative pt-32 pb-24 overflow-hidden">
      {/* Radial glow behind headline — decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]
                   bg-accent/[0.07] rounded-full blur-[120px]"
      />

      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <motion.div
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center gap-6"
        >
          {/* Badge */}
          <motion.div variants={heroItem}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium tracking-wide">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Open source · MIT License
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={heroItem}
            className="text-hero max-w-2xl mx-auto tracking-tight"
          >
            Your data promised something.{' '}
            {/* Accent colour (#7C3AED) fails contrast on its own; the heading
                weight (700) qualifies as large text (≥18.67 px bold) requiring
                only 3:1. At ~1.2:1 it still fails. We surface the text via
                text-text-primary and use the accent purely as an underline
                decoration so the heading remains readable. */}
            <span className="text-text-primary underline decoration-accent decoration-2 underline-offset-4">Did it deliver?</span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            variants={heroItem}
            className="text-xl text-text-secondary max-w-xl mx-auto leading-relaxed"
          >
            Define data contracts for your dbt project in 2 minutes. Enforce them
            automatically. Know when upstream data breaks your models{' '}
            <strong className="font-semibold text-text-primary">before</strong> your stakeholders do.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={heroItem} className="flex items-center gap-3 flex-wrap justify-center">
            <Link to="/app">
              <Button variant="primary" size="lg">
                Start free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <a
              href="https://github.com/atharnawaz/dbt-contracts"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View dbt-contracts on GitHub (opens in new tab)"
            >
              <Button variant="secondary" size="lg">
                <Github className="h-4 w-4" aria-hidden="true" />
                View on GitHub
              </Button>
            </a>
          </motion.div>

          {/* Trust line */}
          <motion.p variants={heroItem} className="text-xs text-text-secondary">
            No installation required · Works with any dbt project
          </motion.p>

          {/* Terminal demo */}
          <motion.div variants={heroItem} className="w-full max-w-2xl mt-4">
            <TerminalDemo />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Social proof bar
// ---------------------------------------------------------------------------
function SocialProofBar() {
  const [stats, setStats] = useState({ total_contracts: 1247, total_manifests: 384 })

  useEffect(() => {
    fetch(`${API_BASE}/api/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})
  }, [])

  return (
    <section aria-label="Product statistics" className="border-y border-border bg-surface/40">
      <div className="max-w-5xl mx-auto px-6 py-5">
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-text-secondary list-none">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="w-1 h-1 rounded-full bg-text-muted" />
            Built by data engineers
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="w-1 h-1 rounded-full bg-accent" />
            <span className="tabular-nums">
              <CountUp target={stats.total_contracts} /> contracts generated
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="w-1 h-1 rounded-full bg-success" />
            <span className="tabular-nums">
              <CountUp target={stats.total_manifests} /> manifests parsed
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="w-1 h-1 rounded-full bg-text-muted" />
            0 installs required
          </li>
        </ul>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Problem section — 3 cards, stagger on scroll
// ---------------------------------------------------------------------------
const PROBLEMS = [
  {
    icon: AlertTriangle,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/10',
    title: 'Silent failures',
    description:
      'An upstream column gets renamed. A type changes. A null creeps in. Your downstream models break without warning — you find out from a stakeholder, not an alert.',
  },
  {
    icon: ClipboardList,
    iconColor: 'text-error',
    iconBg: 'bg-error/10',
    title: 'Manual testing',
    description:
      'Writing Great Expectations tests by hand takes hours per model. Most teams skip it. The ones that don\'t still miss edge cases. There\'s no shared definition of "correct."',
  },
  {
    icon: Users,
    iconColor: 'text-text-muted',
    iconBg: 'bg-surface',
    title: 'No ownership',
    description:
      'Nobody knows who owns what data promise. Is orders.status still valid? Who decided revenue_date is never null? The answers are buried in Slack from six months ago.',
  },
]

const cardContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] } },
}

function ProblemSection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const shouldReduceMotion = useReducedMotion()

  const resolvedCardContainerVariants = shouldReduceMotion
    ? { hidden: {}, visible: {} }
    : cardContainerVariants

  const resolvedCardVariants = shouldReduceMotion
    ? { hidden: {}, visible: {} }
    : cardVariants

  return (
    <section id="features" className="max-w-5xl mx-auto px-6 py-24">
      <div className="text-center mb-14">
        <h2 className="text-section tracking-tight">
          Your data breaks. Silently.
        </h2>
        <p className="text-text-secondary mt-3 max-w-md mx-auto text-base leading-relaxed">
          Every data team has lived this. A model changes, a consumer breaks,
          and the first alert is a Slack message from the CEO.
        </p>
      </div>

      <motion.div
        ref={ref}
        variants={resolvedCardContainerVariants}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {PROBLEMS.map((card) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              variants={resolvedCardVariants}
              className={cn(
                'group relative rounded-xl border border-border bg-surface p-6 flex flex-col gap-4',
                'hover:border-border-hover transition-all duration-200',
                'hover:shadow-[0_0_20px_0px_rgb(0,0,0,0.4)]',
              )}
            >
              {/* Icon is decorative — the heading names the card */}
              <div aria-hidden="true" className={cn('w-9 h-9 rounded-lg flex items-center justify-center border border-border', card.iconBg)}>
                <Icon className={cn('h-4 w-4', card.iconColor)} strokeWidth={1.8} />
              </div>
              <div className="space-y-2">
                <h3 className="text-label font-semibold text-text-primary">{card.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{card.description}</p>
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// How it works — 3 numbered steps
// ---------------------------------------------------------------------------
const STEPS = [
  {
    number: '01',
    title: 'Upload manifest.json',
    description:
      'Drag your dbt target/manifest.json into the browser. Zero extra setup — it\'s already generated by your dbt run. We parse every model, column, and existing test.',
  },
  {
    number: '02',
    title: 'AI generates your contracts',
    description:
      'Claude reads your schema and infers freshness windows, row count bounds, and column-level rules. 47 models in seconds. You review and edit in the browser.',
  },
  {
    number: '03',
    title: 'Drop one file in your repo',
    description:
      'Export contracts.yml and a GitHub Action. One file addition later, every PR is checked against your contracts automatically. No other dependencies.',
  },
]

function StepNumber({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: shouldReduceMotion ? 1 : 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
      // aria-hidden: step numbers are visual decoration; the h3 titles carry meaning
      aria-hidden="true"
      className="font-mono text-[64px] font-bold leading-none text-border select-none"
    >
      {value}
    </motion.span>
  )
}

function HowItWorksSection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="border-y border-border bg-surface/20">
      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-section tracking-tight">Three steps to contract coverage.</h2>
          <p className="text-text-secondary mt-3 text-base max-w-md mx-auto">
            From zero to enforced data contracts in the time it takes to brew coffee.
          </p>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-6 list-none">
          {STEPS.map((step, idx) => (
            <motion.li
              key={step.number}
              initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.45,
                delay: shouldReduceMotion ? 0 : idx * 0.1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="relative flex flex-col gap-5 p-6 rounded-xl border border-border bg-[#0D0D0D]"
            >
              <StepNumber value={step.number} />
              <div className="space-y-2">
                <h3 className="text-label font-semibold text-text-primary">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
              </div>
              {/* Connector line — decorative, hidden on last step */}
              {idx < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className="hidden sm:block absolute top-10 -right-3 w-6 h-px bg-border"
                />
              )}
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Code snippet section
// ---------------------------------------------------------------------------
interface SyntaxToken {
  text: string
  color: string
}

type CodeLine = SyntaxToken[]

const CONTRACT_YAML: CodeLine[] = [
  [{ text: '# contracts/orders.yml', color: 'text-text-muted' }],
  [{ text: '', color: '' }],
  [
    { text: 'version', color: 'text-accent' },
    { text: ': ', color: 'text-text-secondary' },
    { text: '1', color: 'text-success' },
  ],
  [
    { text: 'model', color: 'text-accent' },
    { text: ': ', color: 'text-text-secondary' },
    { text: 'orders', color: 'text-text-primary' },
  ],
  [
    { text: 'owner', color: 'text-accent' },
    { text: ': ', color: 'text-text-secondary' },
    { text: 'analytics@company.com', color: 'text-warning' },
  ],
  [{ text: '', color: '' }],
  [{ text: 'freshness:', color: 'text-accent' }],
  [
    { text: '  warn_after_hours', color: 'text-text-secondary' },
    { text: ': ', color: 'text-text-secondary' },
    { text: '24', color: 'text-success' },
  ],
  [
    { text: '  error_after_hours', color: 'text-text-secondary' },
    { text: ': ', color: 'text-text-secondary' },
    { text: '48', color: 'text-success' },
  ],
  [{ text: '', color: '' }],
  [{ text: 'row_count:', color: 'text-accent' }],
  [
    { text: '  min', color: 'text-text-secondary' },
    { text: ': ', color: 'text-text-secondary' },
    { text: '10', color: 'text-success' },
  ],
  [
    { text: '  warn_below', color: 'text-text-secondary' },
    { text: ': ', color: 'text-text-secondary' },
    { text: '100', color: 'text-success' },
  ],
  [{ text: '', color: '' }],
  [{ text: 'columns:', color: 'text-accent' }],
  [{ text: '  order_id:', color: 'text-text-primary' }],
  [
    { text: '    not_null', color: 'text-text-secondary' },
    { text: ': ', color: 'text-text-secondary' },
    { text: 'true', color: 'text-warning' },
  ],
  [
    { text: '    unique', color: 'text-text-secondary' },
    { text: ': ', color: 'text-text-secondary' },
    { text: 'true', color: 'text-warning' },
  ],
  [{ text: '  status:', color: 'text-text-primary' }],
  [
    { text: '    accepted_values', color: 'text-text-secondary' },
    { text: ': ', color: 'text-text-secondary' },
    { text: '[pending, completed, failed]', color: 'text-text-muted' },
  ],
  [{ text: '  revenue_usd:', color: 'text-text-primary' }],
  [
    { text: '    not_null', color: 'text-text-secondary' },
    { text: ': ', color: 'text-text-secondary' },
    { text: 'true', color: 'text-warning' },
  ],
  [
    { text: '    minimum', color: 'text-text-secondary' },
    { text: ': ', color: 'text-text-secondary' },
    { text: '0', color: 'text-success' },
  ],
]

function CodeSnippetSection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="max-w-5xl mx-auto px-6 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left — copy */}
        <motion.div
          initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-5"
        >
          <span className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary uppercase tracking-widest">
            <span aria-hidden="true" className="w-4 h-px bg-border" />
            Output
          </span>
          <h2 className="text-section tracking-tight">
            The contract that saved my 2am.
          </h2>
          <p className="text-text-secondary leading-relaxed">
            This is a real contract generated from a production dbt project.
            Every rule was inferred automatically — freshness windows from cron
            schedules, row counts from historical patterns, column constraints
            from column names and existing tests.
          </p>
          <ul className="space-y-3">
            {[
              'Freshness SLAs inferred from pipeline schedules',
              'Row count bounds from historical manifest metadata',
              'Column rules from names, types, and existing dbt tests',
              'Owner mapped from dbt meta blocks',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                {/* Icon is decorative — the list item text conveys the meaning */}
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <Link to="/app">
            <Button variant="primary" size="md" className="mt-2">
              Generate your contracts
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </motion.div>

        {/* Right — code block */}
        <motion.div
          initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          className="rounded-xl border border-border bg-[#0D0D0D] overflow-hidden shadow-2xl shadow-black/50"
        >
          {/* File tab */}
          <div className="flex items-center gap-0 border-b border-border bg-surface" aria-hidden="true">
            <div className="flex items-center gap-2 px-4 py-2.5 border-r border-border border-b border-b-accent -mb-px bg-[#0D0D0D]">
              <span className="w-2 h-2 rounded-sm bg-accent/60" />
              <span className="text-xs font-mono text-text-secondary">orders.yml</span>
            </div>
          </div>
          {/* Code — role="region" + aria-label so screen reader users can
              navigate to this block and understand what it contains */}
          <div className="p-5 overflow-auto max-h-[480px]">
            <pre
              role="region"
              aria-label="Example contract YAML for the orders model"
              className="font-mono text-xs leading-6"
            >
              {CONTRACT_YAML.map((line, lineIdx) => (
                <div key={lineIdx}>
                  {line.length === 0 || (line.length === 1 && line[0]?.text === '') ? (
                    <span>&nbsp;</span>
                  ) : (
                    line.map((token, tokIdx) => (
                      <span key={tokIdx} className={token.color}>
                        {token.text}
                      </span>
                    ))
                  )}
                </div>
              ))}
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Pricing section
// ---------------------------------------------------------------------------
function PricingSection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="border-t border-border bg-surface/20">
      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-section tracking-tight">Simple pricing.</h2>
          <p className="text-text-secondary mt-3 text-base max-w-sm mx-auto">
            Free forever for individuals. Teams features coming soon.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {/* Free card */}
          <motion.div
            initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative rounded-xl border border-border bg-surface p-7 flex flex-col gap-6"
          >
            <div className="space-y-1">
              <p className="text-xs text-text-secondary font-medium uppercase tracking-widest">Free</p>
              <p className="text-3xl font-bold text-text-primary tracking-tight">$0</p>
              <p className="text-sm text-text-secondary">forever, open source</p>
            </div>

            <ul className="space-y-3 flex-1">
              {[
                'Unlimited open source projects',
                'Up to 10 models per contract run',
                'AI-generated contracts with Claude',
                'YAML export + GitHub Action',
                'Browser-based editor',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-success flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Link to="/app">
              <Button variant="primary" size="md" className="w-full justify-center">
                Start free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </motion.div>

          {/* Pro card */}
          <motion.div
            initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay: shouldReduceMotion ? 0 : 0.08, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative rounded-xl border border-border bg-surface p-7 flex flex-col gap-6 opacity-70"
            aria-label="Pro plan — coming soon"
          >
            <div className="absolute top-4 right-4">
              <Badge variant="default">Coming soon</Badge>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-text-secondary font-medium uppercase tracking-widest">Pro</p>
              <p className="text-3xl font-bold text-text-primary tracking-tight">$—</p>
              <p className="text-sm text-text-secondary">per seat / month</p>
            </div>

            <ul className="space-y-3 flex-1">
              {[
                'Everything in Free',
                'Unlimited models per run',
                'Team sharing and ownership',
                'Contract history and diffs',
                'Slack alerts on violations',
                'Priority support',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-text-secondary flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              variant="secondary"
              size="md"
              className="w-full justify-center"
              disabled
              aria-disabled="true"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              Coming soon
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
function Footer() {
  return (
    <footer aria-label="Site footer" className="border-t border-border">
      <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm font-medium text-text-primary">dbt-contracts</span>
          </div>
          <p className="text-xs text-text-secondary max-w-xs leading-relaxed">
            Built by{' '}
            <a
              href="https://www.linkedin.com/in/atharnawaz"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Athar Nawaz on LinkedIn (opens in new tab)"
              className="text-text-secondary hover:text-text-primary transition-colors underline underline-offset-2 decoration-border hover:decoration-text-secondary"
            >
              @ATHARNAWAZ
            </a>{' '}
            — because I got paged at 2am one too many times.
          </p>
          <p className="text-xs text-text-secondary">MIT License</p>
        </div>

        <nav aria-label="Footer links">
          <ul className="flex items-center gap-6 list-none">
            <li>
              <a
                href="https://github.com/athar-naaz/dbt-contracts"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub repository (opens in new tab)"
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                <Github className="h-3.5 w-3.5" aria-hidden="true" />
                GitHub
              </a>
            </li>
            <li>
              <Link
                to="/docs"
                className="text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Docs
              </Link>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/atharnawaz"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn profile (opens in new tab)"
                className="text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                LinkedIn
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary font-sans antialiased">
      <NavBar />
      <main>
        <Hero />
        <SocialProofBar />
        <ProblemSection />
        <HowItWorksSection />
        <CodeSnippetSection />
        <PricingSection />
      </main>
      <Footer />
    </div>
  )
}
