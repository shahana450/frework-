"use client";

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, X, CheckCircle, AlertCircle, ImageIcon, Loader2 } from "lucide-react";

interface Photo {
  id: string;
  file: File;
  preview: string;        // local object URL for instant preview
  url: string | null;     // Supabase public URL after upload
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
}

interface PhotoUploadProps {
  userId: string;
  folder: string;          // e.g. "workspaces", "freelancers"
  maxPhotos?: number;
  onUrlsChange: (urls: string[]) => void;
  accentColor?: string;    // tailwind color class e.g. "blue" | "emerald" | "amber"
}

const BUCKET = "frework-uploads";

export function PhotoUpload({ userId, folder, maxPhotos = 8, onUrlsChange, accentColor = "blue" }: PhotoUploadProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accent: Record<string, { border: string; bg: string; text: string; ring: string }> = {
    blue:    { border: "border-blue-500/30",    bg: "bg-blue-500/8",    text: "text-blue-400",    ring: "ring-blue-500/30" },
    emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/8", text: "text-emerald-400", ring: "ring-emerald-500/30" },
    amber:   { border: "border-amber-500/30",   bg: "bg-amber-500/8",   text: "text-amber-400",   ring: "ring-amber-500/30" },
    gold:    { border: "border-[#C9A84C]/30",   bg: "bg-[#C9A84C]/8",   text: "text-[#C9A84C]",   ring: "ring-[#C9A84C]/30" },
    purple:  { border: "border-purple-500/30",  bg: "bg-purple-500/8",  text: "text-purple-400",  ring: "ring-purple-500/30" },
  };
  const ac = accent[accentColor] ?? accent.blue;

  const uploadFile = useCallback(async (photo: Photo) => {
    const ext = photo.file.name.split(".").pop();
    const path = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    setPhotos(p => p.map(x => x.id === photo.id ? { ...x, status: "uploading", progress: 10 } : x));

    const { data, error } = await supabase.storage.from(BUCKET).upload(path, photo.file, { upsert: false, contentType: photo.file.type });

    if (error || !data) {
      setPhotos(p => p.map(x => x.id === photo.id ? { ...x, status: "error", progress: 0 } : x));
      return;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    const publicUrl = urlData.publicUrl;

    setPhotos(prev => {
      const updated = prev.map(x => x.id === photo.id ? { ...x, status: "done" as const, url: publicUrl, progress: 100 } : x);
      onUrlsChange(updated.filter(x => x.url).map(x => x.url!));
      return updated;
    });
  }, [folder, userId, onUrlsChange]);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const allowed = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, maxPhotos - photos.length);
    if (!allowed.length) return;

    const newPhotos: Photo[] = allowed.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      url: null,
      status: "pending",
      progress: 0,
    }));

    setPhotos(p => [...p, ...newPhotos]);
    newPhotos.forEach(p => uploadFile(p));
  }, [photos.length, maxPhotos, uploadFile]);

  const remove = (id: string) => {
    setPhotos(prev => {
      const updated = prev.filter(x => x.id !== id);
      onUrlsChange(updated.filter(x => x.url).map(x => x.url!));
      return updated;
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {photos.length < maxPhotos && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 py-10 px-6 text-center
            ${dragging ? `${ac.border} ${ac.bg} scale-[1.01]` : "border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/4"}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${ac.bg} border ${ac.border}`}>
            <Upload className={`w-5 h-5 ${ac.text}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/70">
              <span className={ac.text}>Click to upload</span> or drag & drop
            </p>
            <p className="text-xs text-white/30 mt-1">PNG, JPG, WEBP up to 10MB each · max {maxPhotos} photos</p>
          </div>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => addFiles(e.target.files)} />
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden border border-white/8">
              {/* Preview */}
              <img src={photo.preview} alt="preview" className="w-full h-full object-cover" />

              {/* Status overlay */}
              {photo.status === "uploading" && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                  <span className="text-[10px] text-white/60">Uploading…</span>
                  {/* progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                    <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${photo.progress}%` }} />
                  </div>
                </div>
              )}

              {photo.status === "done" && (
                <div className="absolute top-1.5 left-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
              )}

              {photo.status === "error" && (
                <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center gap-1">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-[9px] text-red-300">Failed</span>
                  <button type="button" onClick={() => uploadFile(photo)}
                    className="text-[9px] text-white underline">Retry</button>
                </div>
              )}

              {/* Pending badge */}
              {photo.status === "done" && (
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <span className="block text-center text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/80 text-amber-900 backdrop-blur-sm">
                    Pending approval
                  </span>
                </div>
              )}

              {/* Remove button */}
              <button type="button" onClick={() => remove(photo.id)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ))}

          {/* Add more slot */}
          {photos.length < maxPhotos && (
            <button type="button" onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/4 flex flex-col items-center justify-center gap-1 transition-all">
              <ImageIcon className="w-5 h-5 text-white/20" />
              <span className="text-[9px] text-white/20">Add more</span>
            </button>
          )}
        </div>
      )}

      {/* Approval notice */}
      {photos.some(p => p.status === "done") && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/6">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Photos uploaded — pending admin approval</p>
            <p className="text-[10px] text-white/35 mt-0.5">Your photos are saved securely. They will appear on the website only after our team approves your listing.</p>
          </div>
        </div>
      )}
    </div>
  );
}
