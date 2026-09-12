import type { CSSProperties } from "react";
import { getBackgroundImageTransform } from "./backgroundPosition";

export function CanvasBackgroundImage({
  assetId,
  positionY,
  url,
}: {
  assetId: string;
  positionY: number;
  url: string;
}) {
  return (
    <img
      alt=""
      className="canvas-background-image"
      data-background-asset-id={assetId}
      src={url}
      style={
        {
          transform: getBackgroundImageTransform(positionY),
        } as CSSProperties
      }
    />
  );
}
