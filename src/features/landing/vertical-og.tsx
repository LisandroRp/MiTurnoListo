import { ImageResponse } from "next/og";

import { VerticalLandingConfig } from "@/features/landing/verticals";

export const verticalOpenGraphImageSize = {
  width: 1200,
  height: 630
};

export function renderVerticalOpenGraphImage(config: VerticalLandingConfig) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 72,
          background: "linear-gradient(135deg, rgb(250, 247, 243), rgb(251, 218, 202))",
          color: "rgb(39, 48, 66)",
          fontFamily: "Inter, Arial, sans-serif"
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "2px solid rgb(229, 216, 204)",
            borderRadius: 32,
            background: "rgba(255, 255, 255, 0.82)",
            padding: 54
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: "rgb(236, 147, 103)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgb(38, 27, 21)",
                  fontSize: 24,
                  fontWeight: 900
                }}
              >
                M
              </div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>MiTurnoListo</div>
            </div>
            <div
              style={{
                display: "flex",
                borderRadius: 999,
                background: "rgb(251, 218, 202)",
                color: "rgb(149, 66, 33)",
                padding: "12px 22px",
                fontSize: 22,
                fontWeight: 800
              }}
            >
              Reservas online
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 860 }}>
            <div style={{ fontSize: 68, lineHeight: 1.02, fontWeight: 950, letterSpacing: 0 }}>
              {config.og.title}
            </div>
            <div style={{ fontSize: 42, lineHeight: 1.15, color: "rgb(86, 96, 114)", fontWeight: 750 }}>
              {config.og.subtitle}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14 }}>
            {config.services.slice(0, 4).map((service) => (
              <div
                key={service}
                style={{
                  borderRadius: 999,
                  background: "rgb(255, 253, 251)",
                  border: "1px solid rgb(229, 216, 204)",
                  padding: "12px 18px",
                  fontSize: 22,
                  fontWeight: 800
                }}
              >
                {service}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    verticalOpenGraphImageSize
  );
}
