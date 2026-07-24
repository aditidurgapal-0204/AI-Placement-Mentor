'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import LoginForm from '@/components/LoginForm';
import SignupForm from '@/components/SignupForm';
import ForgotPasswordForm from '@/components/ForgotPasswordForm';
import {
  Menu,
  X,
  Brain,
  FileText,
  Mic,
  TrendingUp,
} from 'lucide-react';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentView, setView } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white overflow-hidden">

      {/* Navbar */}
      <nav className="fixed w-full top-0 z-50 backdrop-blur-md bg-black/20 border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex justify-between items-center h-16">

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Brain size={20} />
              </div>

              <span className="text-2xl font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
                AI Placement Mentor
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">

              <button
                onClick={() => setView('LOGIN')}
                className="px-5 py-2 rounded-xl border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition-all"
              >
                Login
              </button>

              <button
                onClick={() => setView('SIGNUP')}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:scale-105 transition-all"
              >
                Sign up
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 flex flex-col gap-4 border-t border-purple-500/20">

              <a href="#features" className="text-gray-300 hover:text-purple-300">
                Features
              </a>

              <a href="#footer" className="text-gray-300 hover:text-purple-300">
                Contact
              </a>

            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-36 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">

        {/* Background Blur */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/20 blur-3xl rounded-full"></div>

        <div className="relative max-w-6xl mx-auto text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 mb-8">

            <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>

            <span className="text-sm text-purple-300">
              AI-Powered Placement Preparation
            </span>

          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-8">

            <span className="block bg-gradient-to-r from-purple-200 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              AI Placement
            </span>

            <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-purple-200 bg-clip-text text-transparent">
              Mentor
            </span>

          </h1>

          {/* Subtitle */}
          <p className="max-w-3xl mx-auto text-lg sm:text-xl text-gray-300 leading-relaxed mb-10">
            An AI-powered platform that helps students prepare for placements through personalized roadmaps, resume analysis, adaptive learning, and mock interviews.
          </p>

          {/* Buttons */}
          <div className="flex justify-center mb-20">
            <a
              href="#features"
              className="px-14 py-5 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 font-semibold text-2xl hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/40 transition-all"
            >
              Start Your Journey
            </a>

          </div>

          {/* Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 max-w-4xl mx-auto">

            <div className="text-center">
              <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Save Time
              </h3>

              <p className="text-gray-400 mt-2">
                Structured preparation without confusion
              </p>
            </div>

            <div className="text-center">
              <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Stay Consistent
              </h3>

              <p className="text-gray-400 mt-2">
                Daily learning paths and interview practice
              </p>
            </div>

            <div className="text-center">
              <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Practice Anytime
              </h3>

              <p className="text-gray-400 mt-2">
                Learn and prepare at your own pace
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* About Section */}
      <section
        id="about"
        className="py-24 px-4 sm:px-6 lg:px-8"
      >

        <div className="max-w-6xl mx-auto">

          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left Content */}
            <div>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 mb-6">

                <span className="w-2 h-2 bg-purple-400 rounded-full"></span>

                <span className="text-sm text-purple-300">
                  About The Platform
                </span>

              </div>

              <h2 className="text-5xl font-bold leading-tight mb-8">

                <span className="bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
                  Smart Placement Preparation
                </span>

              </h2>

              <p className="text-gray-300 text-lg leading-relaxed mb-6">
                AI Placement Mentor is an AI-powered platform designed to help students prepare effectively for placements and internships.
              </p>

              <p className="text-gray-400 leading-relaxed mb-6">
                The platform combines personalized learning roadmaps, resume analysis, mock interviews, and progress tracking into one guided experience.
              </p>

              <p className="text-gray-400 leading-relaxed">
                Built as a student-focused project, the goal is to make placement preparation more structured, accessible, and less overwhelming.
              </p>

            </div>

            {/* Right Card */}
            <div className="rounded-3xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-sm p-10">

              <div className="space-y-8">

                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-purple-300">
                    Personalized Learning
                  </h3>

                  <p className="text-gray-400">
                    Adaptive preparation paths based on student goals and skill levels.
                  </p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-purple-300">
                    AI Assistance
                  </h3>

                  <p className="text-gray-400">
                    Smart resume feedback, interview guidance, and preparation support.
                  </p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-purple-300">
                    Student Focused
                  </h3>

                  <p className="text-gray-400">
                    Designed specifically for students preparing for placements and internships.
                  </p>
                </div>

              </div>

            </div>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="py-24 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">

            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              Powerful Features
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Everything you need to excel in your placement journey
            </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">

            {/* Card 1 */}
            <div className="rounded-3xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-sm p-10 hover:border-purple-500/50 transition-all duration-300">

              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-8">
                <Brain size={30} />
              </div>

              <h3 className="text-3xl font-bold mb-6">
                Personalized AI Roadmaps
              </h3>

              <p className="text-gray-400 text-lg leading-relaxed">
                Get customized learning paths tailored to your skills, goals, and timeline. Our AI analyzes your strengths and weaknesses to create the perfect roadmap.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-3xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-sm p-10 hover:border-purple-500/50 transition-all duration-300">

              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-8">
                <FileText size={30} />
              </div>

              <h3 className="text-3xl font-bold mb-6">
                AI Resume Analyzer
              </h3>

              <p className="text-gray-400 text-lg leading-relaxed">
                Get intelligent feedback on your resume. Our AI highlights improvements, suggests keywords, and ensures your resume stands out to recruiters.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-3xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-sm p-10 hover:border-purple-500/50 transition-all duration-300">

              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-8">
                <Mic size={30} />
              </div>

              <h3 className="text-3xl font-bold mb-6">
                Mock Interviews
              </h3>

              <p className="text-gray-400 text-lg leading-relaxed">
                Practice with AI-powered mock interviews that simulate real scenarios. Get real-time feedback and improve your communication skills.
              </p>

            </div>

            {/* Card 4 */}
            <div className="rounded-3xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-sm p-10 hover:border-purple-500/50 transition-all duration-300">

              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-8">
                <TrendingUp size={30} />
              </div>

              <h3 className="text-3xl font-bold mb-6">
                Progress Analytics
              </h3>

              <p className="text-gray-400 text-lg leading-relaxed">
                Track your progress with detailed analytics. Visualize your growth, identify areas for improvement, and celebrate your achievements.
              </p>

            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="get-started"
        className="py-24 px-4 sm:px-6 lg:px-8"
      >

        <div className="max-w-5xl mx-auto">

          <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-900/40 to-slate-900/40 backdrop-blur-sm p-12 sm:p-16 text-center">

            <h2 className="text-5xl font-bold mb-6">
              Start Preparing Smarter
            </h2>

            <p className="text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed mb-10">
              Stay consistent with your placement preparation through guided learning, interview practice, and personalized AI support.
            </p>

            <button
              onClick={() => setView('SIGNUP')}
              className="px-10 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 font-semibold text-lg hover:scale-105 transition-all"
            >
              Get Started
            </button>

            <p className="text-sm text-gray-400 mt-6">
              Built for students preparing for placements and internships.
            </p>

          </div>
        </div>
      </section>


      {/* FAQ Section */}
      <section
        id="faq"
        className="py-24 px-4 sm:px-6 lg:px-8"
      >

        <div className="max-w-5xl mx-auto">

          {/* Heading */}
          <div className="text-center mb-16">

            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              Frequently Asked Questions
            </h2>

            <p className="text-gray-400 text-lg">
              Everything students usually ask before getting started
            </p>

          </div>

          {/* FAQ Cards */}
          <div className="space-y-6">

            {/* FAQ 1 */}
            <div className="rounded-2xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-sm p-6">

              <h3 className="text-xl font-semibold mb-3">
                Is this platform free to use?
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Yes. This project is currently free for students and focuses on helping with placement preparation through AI-powered guidance and practice tools.
              </p>

            </div>

            {/* FAQ 2 */}
            <div className="rounded-2xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-sm p-6">

              <h3 className="text-xl font-semibold mb-3">
                What does AI Placement Mentor help with?
              </h3>

              <p className="text-gray-400 leading-relaxed">
                The platform helps students with resume analysis, personalized learning roadmaps, interview preparation, and progress tracking.
              </p>

            </div>

            {/* FAQ 3 */}
            <div className="rounded-2xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-sm p-6">

              <h3 className="text-xl font-semibold mb-3">
                Is this an official placement platform?
              </h3>

              <p className="text-gray-400 leading-relaxed">
                No. This is an AI-powered student project designed to improve placement preparation and learning experience.
              </p>

            </div>

            {/* FAQ 4 */}
            <div className="rounded-2xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-sm p-6">

              <h3 className="text-xl font-semibold mb-3">
                Can beginners use this platform?
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Absolutely. The platform is designed for students at all levels, including beginners starting their placement preparation journey.
              </p>

            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        id="footer"
        className="border-t border-purple-500/20 py-14 px-4 sm:px-6 lg:px-8"
      >

        <div className="max-w-7xl mx-auto">

          <div className="grid md:grid-cols-4 gap-10 mb-10">

            {/* Brand */}
            <div>

              <div className="flex items-center gap-2 mb-4">

                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                  <Brain size={18} />
                </div>

                <span className="font-bold text-xl">
                  AI Placement Mentor
                </span>

              </div>

              <p className="text-gray-400 text-sm leading-relaxed">
                Helping students prepare smarter for placements with AI-powered guidance.
              </p>

            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold text-lg mb-4">
                Product
              </h4>

              <ul className="space-y-3 text-gray-400">

                <li>
                  <a href="#about" className="hover:text-purple-300 transition-colors">
                    About
                  </a>
                </li>

                <li>
                  <a href="#features" className="hover:text-purple-300 transition-colors">
                    Features
                  </a>
                </li>

                <li>
                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=aditidurgapalformal@gmail.com"
                    target="_blank"
                    className="hover:text-purple-300 transition-colors"
                  >
                    Support
                  </a>
                </li>

              </ul>
            </div>

            {/* Explore */}
            <div>
              <h4 className="font-semibold text-lg mb-4">
                Explore
              </h4>

              <ul className="space-y-3 text-gray-400">

                <li>
                  <Link href="/" className="hover:text-purple-300 transition-colors">
                    Home
                  </Link>
                </li>

                <li>
                  <a href="#faq" className="hover:text-purple-300 transition-colors">
                    FAQ
                  </a>
                </li>

                <li>
                  <a href="#get-started" className="hover:text-purple-300 transition-colors">
                    Get Started
                  </a>
                </li>

              </ul>
            </div>

            {/* Connect */}
            <div>
              <h4 className="font-semibold text-lg mb-4">
                Connect
              </h4>

              <ul className="space-y-3 text-gray-400">

                <li>
                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=aditidurgapalformal@gmail.com"
                    target="_blank"
                    className="hover:text-purple-300 transition-colors"
                  >
                    Contact
                  </a>
                </li>

                <li>
                  <a
                    href="https://github.com/aditidurgapal-0204"
                    target="_blank"
                    className="hover:text-purple-300 transition-colors"
                  >
                    GitHub
                  </a>
                </li>

                <li>
                  <a
                    href="https://www.linkedin.com/in/aditi-durgapal-02428826a/"
                    target="_blank"
                    className="hover:text-purple-300 transition-colors"
                  >
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="border-t border-purple-500/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">

            <p className="text-gray-500 text-sm">
              © 2026 AI Placement Mentor. All rights reserved.
            </p>

          </div>
        </div>
      </footer>

      {/* Mount dynamic layers only when store context updates */}
      {currentView === 'LOGIN' && <LoginForm />}
      {currentView === 'SIGNUP' && <SignupForm />}
      {currentView === 'FORGOT_PASSWORD' && <ForgotPasswordForm />}
    </div>
  );
}
