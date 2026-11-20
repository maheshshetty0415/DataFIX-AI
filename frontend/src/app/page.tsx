'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Database,
  Shield,
  Wrench,
  Brain,
  CheckCircle,
  MessageSquare,
  History,
  ArrowRight,
  Upload,
  Search,
  Sparkles,
  BarChart3,
  FileCheck2,
  FileDown,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const features = [
    {
      icon: Shield,
      title: 'Intelligent Error Detection',
      description:
        'Scans datasets across millions of rows to find missing values, duplicate entries, malformed formats, and statistical outliers instantly.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Wrench,
      title: 'Automated Data Repair',
      description:
        'Context-aware repair algorithms reconstruct missing values and normalize inconsistent categoricals with high statistical fidelity.',
      gradient: 'from-purple-500 to-indigo-500',
    },
    {
      icon: Brain,
      title: 'AI-Powered Diagnosis',
      description:
        'Deep learning models analyze column semantics and inter-column correlations to pinpoint root causes behind data degradation.',
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      icon: CheckCircle,
      title: 'Data Validation',
      description:
        'Continuous cross-verification tests ensure repaired values preserve distribution shapes, schema constraints, and business logic.',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      icon: MessageSquare,
      title: 'Explainable Changes',
      description:
        'Every single modification comes with transparent reasoning, algorithmic confidence scores, and mathematical justifications.',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      icon: History,
      title: 'Complete Audit History',
      description:
        'Comprehensive, immutable audit trails enable one-click rollbacks, verification reports, and regulatory compliance exports.',
      gradient: 'from-blue-600 to-purple-600',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'UPLOAD',
      subtitle: 'CSV or Excel',
      icon: Upload,
      description: 'Drag and drop your raw, uncleaned tabular files up to 50MB.',
    },
    {
      number: '02',
      title: 'ANALYSE',
      subtitle: 'Schema & Profiling',
      icon: Search,
      description: 'Automated statistical profiling and structural metadata discovery.',
    },
    {
      number: '03',
      title: 'DETECT',
      subtitle: 'Multi-layer Scans',
      icon: AlertTriangle,
      description: 'Flags nulls, schema violations, anomalies, and duplicates.',
    },
    {
      number: '04',
      title: 'REPAIR',
      subtitle: 'Intelligent Fixes',
      icon: Wrench,
      description: 'Accept autonomous fixes or review individual suggestions.',
    },
    {
      number: '05',
      title: 'VALIDATE',
      subtitle: 'Distribution Checks',
      icon: FileCheck2,
      description: 'Verify data integrity against statistical boundaries and rules.',
    },
    {
      number: '06',
      title: 'EXPORT',
      subtitle: 'Clean & Ready',
      icon: FileDown,
      description: 'Download cleaned CSV, Excel, PDF audit reports, or logs.',
    },
  ];

  const stats = [
    { value: '80%', label: 'Time Saved', sublabel: 'Less manual wrangling for data teams' },
    { value: '99.8%', label: 'Repair Precision', sublabel: 'Statistical confidence benchmark' },
    { value: '10x', label: 'Faster Pipeline', sublabel: 'Instant anomaly detection & fixing' },
    { value: '$3.1T', label: 'Annual Cost of Bad Data', sublabel: 'Global economic impact avoided' },
  ];

  return (
    <div className="min-h-screen bg-navy-950 text-white selection:bg-blue-600 selection:text-white">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-blue-600/15 via-purple-600/10 to-transparent blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-navy-950/80 border-b border-navy-800/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-1.5 text-xl font-bold">
              <span>DataFix</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                AI
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#home" className="hover:text-white transition-colors">
              Home
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#why-data-quality" className="hover:text-white transition-colors">
              About
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium text-sm shadow-lg shadow-blue-600/25 transition-all transform hover:-translate-y-0.5"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-20 pb-24 md:pt-32 md:pb-36 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-navy-800/80 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-8"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Autonomous Data Quality & Repair Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.15]"
          >
            Turn Messy Data Into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              Reliable Data.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed"
          >
            DataFix AI autonomously detects errors, fixes missing and corrupted records, explains
            every decision, and validates dataset integrity before it hits your production analytics.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/upload"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold shadow-xl shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/upload?demo=true"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-navy-800/90 hover:bg-navy-700/90 border border-navy-700 text-gray-200 font-semibold transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
            >
              <Zap className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
              Explore Demo Dataset
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section id="features" className="py-24 px-6 bg-navy-900/40 border-y border-navy-800/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest font-bold text-blue-400 mb-3">
              Comprehensive Capabilities
            </h2>
            <p className="text-3xl md:text-4xl font-extrabold text-white">
              Built for Modern Analytics & Machine Learning
            </p>
            <p className="mt-4 text-gray-400">
              Stop spending 80% of your time cleaning CSV files. Let autonomous AI agents repair your
              data with statistical rigor.
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  variants={itemVariants}
                  className="group relative p-8 rounded-2xl bg-navy-800/90 border border-navy-700/80 hover:border-blue-500/40 transition-all hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between"
                >
                  <div>
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center mb-6 shadow-md`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">
                      {feat.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{feat.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest font-bold text-purple-400 mb-3">
              Workflow Pipeline
            </h2>
            <p className="text-3xl md:text-4xl font-extrabold text-white">
              Autonomous Ingestion to Certified Export
            </p>
            <p className="mt-4 text-gray-400">
              From raw data ingestion to production-ready certification in six automated steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 relative">
            {steps.map((st, idx) => {
              const StepIcon = st.icon;
              return (
                <div
                  key={st.number}
                  className="relative p-5 rounded-xl bg-navy-800/70 border border-navy-700/60 hover:border-purple-500/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-extrabold text-blue-400">
                        {st.number}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-navy-700/60 flex items-center justify-center">
                        <StepIcon className="w-4 h-4 text-purple-300" />
                      </div>
                    </div>
                    <h4 className="font-bold text-sm text-white">{st.title}</h4>
                    <p className="text-xs font-medium text-purple-400/90 mb-2">{st.subtitle}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{st.description}</p>
                  </div>

                  {idx < steps.length - 1 && (
                    <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-navy-500">
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Data Quality Matters */}
      <section id="why-data-quality" className="py-24 px-6 bg-navy-900/60 border-t border-navy-800/80">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <span className="text-xs uppercase tracking-widest font-bold text-blue-400">
                Industry Benchmark
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 leading-tight">
                Why Reliable Data Quality Matters
              </h2>
              <p className="mt-4 text-gray-300 leading-relaxed text-sm">
                Machine learning models and strategic executive dashboards are only as good as the
                cleanliness of the incoming data. Garbage in guarantees garbage out.
              </p>
              <p className="mt-3 text-gray-400 leading-relaxed text-sm">
                DataFix AI combines heuristic schema validations with intelligent context repair to
                remove hallucinations and restore data trust.
              </p>

              <div className="mt-8">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/25"
                >
                  Explore Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="p-6 rounded-2xl bg-navy-800/80 border border-navy-700/80 hover:border-blue-500/30 transition-all"
                >
                  <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    {s.value}
                  </div>
                  <div className="mt-2 text-base font-bold text-white">{s.label}</div>
                  <div className="mt-1 text-xs text-gray-400">{s.sublabel}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-navy-950 border-t border-navy-800/80">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-base">DataFix AI</span>
            <span className="text-xs text-gray-400 ml-2">
              Autonomous Data Quality & Repair Engine
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/upload" className="hover:text-white transition-colors">
              Upload
            </Link>
            <Link href="/analysis" className="hover:text-white transition-colors">
              Analysis
            </Link>
            <Link href="/repair" className="hover:text-white transition-colors">
              Repair Centre
            </Link>
            <Link href="/settings" className="hover:text-white transition-colors">
              Settings
            </Link>
          </div>

          <div className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} DataFix AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
