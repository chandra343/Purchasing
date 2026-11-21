"use client";

import React, { useState } from "react";
import { MapPin, ExternalLink, Navigation, Maximize2 } from "lucide-react";

interface LocationMapEmbedProps {
  address: string;
  name?: string;
  height?: string;
  className?: string;
  onOpenModal?: () => void;
}

export function getCleanMapQuery(address: string, fallbackName?: string): string {
  if (!address) return fallbackName || "Indonesia";

  const trimmed = address.trim();

  // Jika berupa URL Google Maps
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    // Coba ekstrak nama tempat dari URL jika ada format /place/Nama+Tempat
    const placeMatch = trimmed.match(/\/place\/([^/@?]+)/);
    if (placeMatch && placeMatch[1]) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    }
    // Coba ekstrak query q=...
    const qMatch = trimmed.match(/[?&]q=([^&]+)/);
    if (qMatch && qMatch[1]) {
      return decodeURIComponent(qMatch[1].replace(/\+/g, " "));
    }
    // Jika berupa shortlink (maps.app.goo.gl), gunakan nama supplier/toko sebagai query peta
    if (fallbackName) {
      return fallbackName;
    }
  }

  return trimmed;
}

export default function LocationMapEmbed({
  address,
  name,
  height = "220px",
  className = "",
  onOpenModal,
}: LocationMapEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);

  if (!address && !name) {
    return null;
  }

  const query = getCleanMapQuery(address, name);
  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    query
  )}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  const externalMapUrl =
    address && (address.startsWith("http://") || address.startsWith("https://"))
      ? address
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          query
        )}`;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    query
  )}`;

  return (
    <div
      className={`rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm relative flex flex-col ${className}`}
    >
      {/* Header Bar Peta */}
      <div className="bg-white/95 backdrop-blur-sm px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="font-semibold text-slate-800 truncate" title={query}>
            {name ? `${name} - ${query}` : query}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenModal && (
            <button
              type="button"
              onClick={onOpenModal}
              className="p-1 hover:bg-slate-100 text-slate-600 rounded transition-colors"
              title="Perbesar Peta"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
            title="Petunjuk Arah / Rute"
          >
            <Navigation className="w-3 h-3" />
            <span className="hidden sm:inline">Rute</span>
          </a>

          <a
            href={externalMapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
            title="Buka Aplikasi Google Maps"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">Google Maps</span>
          </a>
        </div>
      </div>

      {/* Frame Embed Peta Interaktif */}
      <div className="relative w-full bg-slate-200" style={{ height }}>
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-1"></div>
            <span>Memuat tampilan peta...</span>
          </div>
        )}
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen={false}
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setIsLoading(false)}
          className="w-full h-full"
          title={`Peta Lokasi ${query}`}
        ></iframe>
      </div>
    </div>
  );
}
