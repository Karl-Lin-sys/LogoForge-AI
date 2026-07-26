/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Image as ImageIcon, Video as VideoIcon, Download, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [description, setDescription] = useState('');
  const [size, setSize] = useState('1K');
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoMimeType, setLogoMimeType] = useState<string>('');
  const [logoError, setLogoError] = useState<string | null>(null);

  const [animPrompt, setAnimPrompt] = useState('Animate this logo beautifully');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoStatusMsg, setVideoStatusMsg] = useState<string>('');

  const generateLogo = async () => {
    if (!description) return;
    setIsGeneratingLogo(true);
    setLogoError(null);
    setLogoBase64(null);
    setVideoUrl(null);
    
    try {
      const res = await fetch('/api/generate-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: description, size })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate logo');
      
      setLogoBase64(data.imageBase64);
      setLogoMimeType(data.mimeType);
    } catch (err: any) {
      setLogoError(err.message);
    } finally {
      setIsGeneratingLogo(false);
    }
  };

  const animateLogo = async () => {
    if (!logoBase64) return;
    setIsGeneratingVideo(true);
    setVideoError(null);
    setVideoUrl(null);
    setVideoStatusMsg('Starting video generation...');
    
    try {
      // 1. Start generation
      const startRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: animPrompt,
          imageBytes: logoBase64,
          mimeType: logoMimeType,
          aspectRatio 
        })
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || 'Failed to start video generation');
      
      const operationName = startData.operationName;
      setVideoStatusMsg('Generating video. This can take a few minutes...');

      // 2. Poll status
      let done = false;
      while (!done) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
        const statusRes = await fetch('/api/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName })
        });
        const statusData = await statusRes.json();
        
        if (!statusRes.ok) {
          throw new Error(statusData.error || 'Status check failed');
        }
        
        if (statusData.error) {
          throw new Error(statusData.error.message || 'Generation failed');
        }
        
        done = statusData.done;
      }

      setVideoStatusMsg('Downloading video...');

      // 3. Download video
      const downloadRes = await fetch('/api/video-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName })
      });
      
      if (!downloadRes.ok) {
        const errData = await downloadRes.json();
        throw new Error(errData.error || 'Failed to download video');
      }

      const blob = await downloadRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      setVideoUrl(objectUrl);
    } catch (err: any) {
      setVideoError(err.message);
    } finally {
      setIsGeneratingVideo(false);
      setVideoStatusMsg('');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 mb-3">
            LogoForge AI
          </h1>
          <p className="text-lg text-neutral-500 max-w-xl mx-auto">
            Describe your company vision, let AI design the logo, and bring it to life with cinematic animation.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Logo Design Section */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                <ImageIcon className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-medium">1. Design Logo</h2>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Company Description & Vision</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none outline-none"
                  rows={4}
                  placeholder="e.g. A minimalist, geometric fox head for a tech startup, modern vector style, vibrant orange and deep purple..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Image Resolution</label>
                <div className="flex bg-neutral-50 p-1 rounded-xl border border-neutral-200">
                  {['1K', '2K', '4K'].map((res) => (
                    <button
                      key={res}
                      onClick={() => setSize(res)}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${size === res ? 'bg-white shadow-sm text-indigo-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generateLogo}
                disabled={isGeneratingLogo || !description.trim()}
                className="w-full py-3.5 px-4 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                {isGeneratingLogo ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Designing...</span>
                  </>
                ) : (
                  <span>Generate Logo</span>
                )}
              </button>
              
              {logoError && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start space-x-3 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{logoError}</p>
                </div>
              )}
            </div>
          </section>

          {/* Animation Section */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100 flex flex-col">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                <VideoIcon className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-medium">2. Animate</h2>
            </div>

            <div className="space-y-5 flex-1 flex flex-col">
              {!logoBase64 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-neutral-200 rounded-2xl text-neutral-400">
                  <ImageIcon className="w-12 h-12 mb-3 text-neutral-300" />
                  <p>Generate a logo first to unlock animation options.</p>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  <div className="aspect-square w-full max-w-[200px] mx-auto bg-neutral-100 rounded-2xl overflow-hidden shadow-inner border border-neutral-200">
                    <img 
                      src={`data:${logoMimeType};base64,${logoBase64}`} 
                      alt="Generated Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Animation Prompt (Optional)</label>
                    <input
                      type="text"
                      value={animPrompt}
                      onChange={(e) => setAnimPrompt(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g. The logo glows and rotates 3D..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Aspect Ratio</label>
                    <div className="flex bg-neutral-50 p-1 rounded-xl border border-neutral-200">
                      {['16:9', '9:16'].map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${aspectRatio === ratio ? 'bg-white shadow-sm text-indigo-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                        >
                          {ratio === '16:9' ? 'Landscape (16:9)' : 'Portrait (9:16)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={animateLogo}
                    disabled={isGeneratingVideo}
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2"
                  >
                    {isGeneratingVideo ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{videoStatusMsg || 'Animating...'}</span>
                      </>
                    ) : (
                      <span>Animate Logo</span>
                    )}
                  </button>
                  
                  {videoError && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start space-x-3 text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p>{videoError}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </section>
        </div>

        {/* Video Output Section */}
        <AnimatePresence>
          {videoUrl && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-12 bg-neutral-900 p-8 rounded-3xl overflow-hidden shadow-2xl border border-neutral-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-medium text-white flex items-center space-x-3">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <span>Final Output</span>
                </h2>
                <a 
                  href={videoUrl} 
                  download="animated-logo.mp4"
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
              </div>
              
              <div className={`mx-auto rounded-2xl overflow-hidden bg-black ${aspectRatio === '16:9' ? 'aspect-video max-w-3xl' : 'aspect-[9/16] max-w-sm'}`}>
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
