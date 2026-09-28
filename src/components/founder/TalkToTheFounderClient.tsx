'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Shield, MessageSquare, Heart, RefreshCw, AlertCircle, Github } from 'lucide-react';

const CATEGORIES = [
  { id: '💡 Feature idea', label: '💡 Feature idea' },
  { id: '🐛 Found a flaw', label: '🐛 Found a flaw' },
  { id: '😡 Complaint', label: '😡 Complaint' },
  { id: '❤️ Appreciation', label: '❤️ Appreciation' },
  { id: '🤔 Question', label: '🤔 Question' },
  { id: '💭 Something else', label: '💭 Something else' },
];

export function TalkToTheFounderClient() {
  const { data: session } = useSession();
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const currentUser = session?.user;
  const githubUsername = currentUser?.githubUsername || currentUser?.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!message.trim()) {
      setErrorMsg("Please enter a message before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/talk-to-the-founder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          category,
          message: message.trim(),
          website_url: honeypot,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong while sending your message. Your message hasn't been sent yet. Please try again.");
      }

      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong while sending your message. Your message hasn't been sent yet. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#070a11] text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans flex flex-col justify-center items-center relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[250px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-2xl w-full relative z-10 space-y-8">
        {/* Header & Hero Copy */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800/60 text-blue-400 font-mono text-xs font-semibold">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Direct Founder Channel</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white font-sans">
            Talk to the Founder
          </h1>

          <p className="text-xl sm:text-2xl font-bold text-blue-400 font-sans tracking-tight">
            You can tell me anything.
          </p>

          <div className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl mx-auto space-y-3 font-normal">
            <p>
              Love something? Hate something? Found a flaw? Have an idea? Think we&apos;re doing something completely wrong?
            </p>
            <p className="font-semibold text-slate-100">
              I want to hear it.
            </p>
            <p className="text-slate-400 text-xs sm:text-sm">
              Repo Rescue is being built in public, and your feedback directly shapes what we build next.
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          {isSuccess ? (
            /* SUCCESS STATE */
            <div className="py-8 px-4 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-600/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <Heart className="w-8 h-8 fill-emerald-500/20" />
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Got it. I read everything. ❤️
                </h2>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
                  Thanks for taking the time to tell me what&apos;s on your mind.
                </p>
                <p className="text-slate-400 text-xs sm:text-sm">
                  I&apos;ll read your message personally and, if you left your email, I&apos;ll reply myself.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-800/80 font-mono text-left max-w-xs mx-auto">
                <p className="text-slate-200 font-bold text-sm">— Paarth</p>
                <p className="text-slate-400 text-xs">Founder, Repo Rescue</p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsSuccess(false);
                    setMessage('');
                    setCategory('');
                  }}
                  className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Send another message</span>
                </button>
              </div>
            </div>
          ) : (
            /* FORM STATE */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Logged-in User Context Badge */}
              {githubUsername ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs font-mono text-blue-300">
                  <Github className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    Signed in as <strong className="text-white">@{githubUsername}</strong>. Your GitHub identity will be included with your feedback.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs font-mono text-slate-400">
                  <Shield className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Submitting anonymously. Leave your email below if you&apos;d like a direct personal response.
                  </span>
                </div>
              )}

              {/* Honeypot field (hidden from users) */}
              <div className="hidden" aria-hidden="true">
                <input
                  type="text"
                  name="website_url"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {/* Category Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                  Category <span className="text-slate-500 font-normal lowercase">(optional)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(isSelected ? '' : cat.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium font-sans border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-950/80 border-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <span>{cat.label}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Textarea */}
              <div className="space-y-2">
                <label htmlFor="message" className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                  What&apos;s on your mind? <span className="text-rose-400">*</span>
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell me what's working, what's broken, what you wish existed, what you disagree with, or what you absolutely love."
                  className="w-full rounded-xl bg-slate-900/90 border border-slate-800 p-4 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans leading-relaxed resize-y"
                />
              </div>

              {/* Email Address Input */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                  Your email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                />
                <p className="text-[11px] font-mono text-slate-400">
                  Optional. Leave this blank if you&apos;d rather stay anonymous.
                </p>
              </div>

              {/* Error Alert Display */}
              {errorMsg && (
                <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-sans flex items-start gap-3 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-rose-200">Delivery Error</p>
                    <p>{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono text-xs font-extrabold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2 group"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending directly to founder...</span>
                  </>
                ) : (
                  <>
                    <span>Send it directly to the founder →</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
