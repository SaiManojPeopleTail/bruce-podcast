import { getYouTubeVideoId } from '@/utils/youtube';
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Custom player implementation commented out – using normal YouTube embed.
// ---------------------------------------------------------------------------
/*
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getYouTubeVideoId, getYouTubeThumbnail } from "@/utils/youtube";

const YT_API_URL = "https://www.youtube.com/iframe_api";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve();
    };
    const existing = document.querySelector(`script[src="${YT_API_URL}"]`);
    if (existing) return;
    const tag = document.createElement("script");
    tag.src = YT_API_URL;
    document.head.appendChild(tag);
  });
}

function requestFullscreen(el) {
  if (!el) return;
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.msRequestFullscreen;
  if (fn) fn.call(el);
}

function exitFullscreen() {
  const fn =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.webkitCancelFullScreen ||
    document.msExitFullscreen;
  if (fn) fn.call(document);
}

function getFullscreenElement() {
  return (
    document.fullscreenElement ??
    document.webkitFullscreenElement ??
    document.msFullscreenElement ??
    null
  );
}

// ... (rest of custom player: init, play/pause, seekbar, controls, etc.)
*/

export default function CustomYouTubePlayer({
  videoUrl,
  title,
  episodeSlug,
  className = '',
}) {
  const videoId = useMemo(() => getYouTubeVideoId(videoUrl), [videoUrl]);

  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?rel=0`;
  }, [videoId]);

  if (!videoId) {
    return (
      <div className={`flex items-center justify-center bg-black text-white rounded-2xl aspect-video ${className}`}>
        Video unavailable
      </div>
    );
  }

  return (
    <div className={`relative w-full bg-black rounded-3xl overflow-hidden shadow-xl aspect-video ${className}`}>
      <iframe
        src={embedUrl}
        title={title || 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 w-full h-full rounded-2xl"
      />
    </div>
  );
}
