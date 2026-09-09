'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, File, FileArchive, FileVideo, FileAudio, FileText, Image as ImageIcon, ArrowRight, X } from 'lucide-react';
import { formatBytes, getFileCategory } from '@/lib/utils/format';

interface FilePickerProps {
  onFileSelected: (file: File) => void;
}

export function FilePicker({ onFileSelected }: FilePickerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreview(null);
    }
  }, [selectedFile]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderIcon = (category: string) => {
    switch (category) {
      case 'image':
        return <ImageIcon className="w-8 h-8 text-sky-500" />;
      case 'video':
        return <FileVideo className="w-8 h-8 text-purple-500" />;
      case 'audio':
        return <FileAudio className="w-8 h-8 text-pink-500" />;
      case 'archive':
        return <FileArchive className="w-8 h-8 text-amber-500" />;
      case 'document':
        return <FileText className="w-8 h-8 text-blue-500" />;
      default:
        return <File className="w-8 h-8 text-neutral-400" />;
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
      />

      <AnimatePresence mode="wait">
        {!selectedFile ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 p-10 text-center flex flex-col items-center justify-center gap-4 ${
              dragActive
                ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                : 'border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30'
            } backdrop-blur-xl shadow-xl shadow-black/[0.02]`}
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UploadCloud className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <p className="text-base font-semibold text-neutral-900 dark:text-white">
                Drag & drop any file here
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                or click to browse from device (supports 1MB to 5GB+)
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500 mt-2">
              <span>Fast</span>
              <span>•</span>
              <span>Direct P2P</span>
              <span>•</span>
              <span>Encrypted</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="selected"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-6 shadow-2xl shadow-black/[0.04] flex flex-col gap-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex-shrink-0">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 flex items-center justify-center flex-shrink-0">
                    {renderIcon(getFileCategory(selectedFile.type, selectedFile.name))}
                  </div>
                )}

                <div className="overflow-hidden">
                  <h3 className="font-semibold text-base text-neutral-900 dark:text-white truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20 px-2 py-0.5 rounded-md">
                      {formatBytes(selectedFile.size)}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                      {selectedFile.name.split('.').pop() || 'FILE'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClear}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title="Choose another file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => onFileSelected(selectedFile)}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all duration-200 active:scale-[0.98]"
              >
                <span>Start Sharing</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto py-3.5 px-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-medium transition-colors"
              >
                Change File
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
