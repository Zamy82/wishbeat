"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface Props {
  value: string;
  size?: number;
}

export default function QRCodeDisplay({ value, size = 180 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#ffffff", light: "#0a0a12" }
    });
  }, [value, size]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "wishbeat-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl overflow-hidden border border-white/10">
        <canvas ref={canvasRef} />
      </div>
      <button
        onClick={handleDownload}
        className="text-xs text-white/40 hover:text-white transition underline underline-offset-2"
      >
        Als PNG speichern
      </button>
    </div>
  );
}
