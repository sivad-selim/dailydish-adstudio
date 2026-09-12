"use client";
import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from "react";
import type { CampaignLanguage } from "../firebase/campaigns";
import { TEXT_SPACING, getImageAssetId, type Creation } from "../firebase/creations";
import type { GalleryAsset } from "../firebase/gallery";
import { CanvasBackgroundImage } from "./CanvasBackgroundImage";
import { ThemeableBackgroundArtwork } from "./ThemeableBackgroundArtwork";
import { getBackgroundColorStyle, getDefaultBackgroundColors, getDefaultTextColors, getTextColorStyle, getThemeStyle, isDarkColor, resolveBackgroundColors, resolveTextColors } from "./themePalettes";
const IMAGE_BASE_WIDTH = 47;
const BACKGROUND_PALETTE_SHAPE_COUNT = 4;
const PHONE_FRAME_CONTROLS_MIN_SCALE = 62;
export function CreationCanvasPreview({
  creation,
  campaignTitle,
  campaignDescription,
  galleryAssets,
  language = "fr",
  showPlaceholder = true,
  interactive = false,
  previewWidth,
  rootRef,
  onImagePointerDown,
  onImagePointerMove,
  onImagePointerUp,
  onImagePointerCancel,
}: {
  creation: Creation;
  campaignTitle: string;
  campaignDescription: string;
  galleryAssets: GalleryAsset[];
  language?: CampaignLanguage;
  showPlaceholder?: boolean;
  interactive?: boolean;
  previewWidth?: number;
  rootRef?: Ref<HTMLDivElement>;
  onImagePointerDown?: (
    event: ReactPointerEvent<HTMLDivElement>,
    image: Creation["properties"]["images"][number],
  ) => void;
  onImagePointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onImagePointerUp?: () => void;
  onImagePointerCancel?: () => void;
}) {
  const backgroundAsset = galleryAssets.find(
    (asset) => asset.id === creation.backgroundAssetId,
  );
  const backgroundImageUrl = backgroundAsset?.url ?? "";
  const activeBackgroundColors = resolveBackgroundColors(
    creation.properties.backgroundColors,
    getDefaultBackgroundColors(
      creation.theme,
      BACKGROUND_PALETTE_SHAPE_COUNT,
    ),
  );
  const darkTextBackdrop =
    creation.properties.textBackdrop === "gradient-dark" ||
    creation.properties.textBackdrop === "band-dark" ||
    isDarkColor(activeBackgroundColors.base);
  const thumbnailTextColors = resolveTextColors(
    creation.properties.textColors,
    getDefaultTextColors(creation.theme, darkTextBackdrop),
  );
  const themeStyle = {
    ...getThemeStyle(creation.theme),
    ...getBackgroundColorStyle(activeBackgroundColors),
    ...getTextColorStyle(thumbnailTextColors),
    "--theme-label-bg":
      creation.properties.assistantBackgroundColor ||
      activeBackgroundColors.base,
  };
  const [textVerticalPosition, textHorizontalPosition] =
    creation.properties.textPosition.split("-");

  return (
    <div
      ref={rootRef}
      className={`creation-preview-canvas ad-canvas format-${creation.format} theme-${creation.theme} background-${creation.background} ${backgroundImageUrl ? "background-illustrated background-gallery-image" : ""}`}
      style={
        {
          ...(previewWidth ? { "--preview-width": `${previewWidth}px` } : {}),
          ...themeStyle,
        } as CSSProperties
      }
      aria-hidden={interactive ? undefined : true}
    >
      {backgroundImageUrl && (
        <CanvasBackgroundImage
          assetId={creation.backgroundAssetId}
          positionY={creation.properties.backgroundPositionY}
          url={backgroundImageUrl}
        />
      )}
      {!backgroundImageUrl && (
        <ThemeableBackgroundArtwork background={creation.background} />
      )}
      <div className="blob blob-green" />
      <div className="blob blob-purple" />
      <div className="blob blob-blue" />

      <div
        className={`ad-copy text-row-${textVerticalPosition} text-align-${textHorizontalPosition} text-backdrop-${creation.properties.textBackdrop} ${creation.properties.showAssistantLabel ? "with-assistant" : "without-assistant"} ${campaignDescription ? "with-description" : "without-description"}`}
        style={
          {
            "--text-width": `${creation.properties.textWidth}%`,
            "--text-margin-x": `${creation.properties.textMarginHorizontal}cqw`,
            "--text-margin-y": `${creation.properties.textMarginVertical}cqw`,
            "--text-rotation": `${creation.properties.textRotation}deg`,
            "--text-surface-padding": `${TEXT_SPACING}cqw`,
          } as CSSProperties
        }
      >
        <span className="text-backdrop-surface" aria-hidden="true" />
        {creation.properties.showAssistantLabel && (
          <div className="assistant-label">
            <span aria-hidden="true">✦</span>
            <span className="assistant-label-text">Assistant DailyDish</span>
          </div>
        )}
        {(campaignTitle || showPlaceholder) && <h2 className={campaignTitle.length > 58 ? "long-title" : ""}>
          {campaignTitle || "Votre titre"}
        </h2>}
        {campaignDescription && <p>{campaignDescription}</p>}
      </div>

      {creation.properties.images.map((image, imageIndex) => {
        const asset = galleryAssets.find(
          (galleryAsset) => galleryAsset.id === getImageAssetId(image, language),
        );
        const width = (IMAGE_BASE_WIDTH * image.scale) / 100;
        const shadowOpacity =
          image.shadowDistance === 0 ? 0 : image.shadowStrength * 0.006;
        const shadowBlur = image.shadowDistance * 0.24;
        return (
          <div
            key={image.id}
            className={`canvas-image-object ${image.frame ? "with-phone-frame" : "without-phone-frame"} ${image.frame && image.scale >= PHONE_FRAME_CONTROLS_MIN_SCALE ? "show-phone-frame-controls" : ""} ${image.aboveText ? "above-text" : "below-text"} ${asset ? "has-image" : "is-empty"}`}
            style={
              {
                "--image-x": `${image.x}cqw`,
                "--image-y": `${image.y}cqw`,
                "--image-width": `${width}cqw`,
                "--image-rotation": `${image.rotation}deg`,
                "--image-shadow-blur": `${shadowBlur}cqw`,
                "--image-shadow-color": `rgba(21, 33, 20, ${shadowOpacity})`,
                zIndex: image.aboveText ? 8 + (image.foregroundOrder ?? 0) : 4,
              } as CSSProperties
            }
            aria-label={
              interactive ? `Déplacer l’image ${imageIndex + 1}` : undefined
            }
            onPointerDown={
              interactive && onImagePointerDown
                ? (event) => onImagePointerDown(event, image)
                : undefined
            }
            onPointerMove={interactive ? onImagePointerMove : undefined}
            onPointerUp={interactive ? onImagePointerUp : undefined}
            onPointerCancel={interactive ? onImagePointerCancel : undefined}
          >
            <div className="canvas-image-viewport">
              {asset ? (
                <img
                  className="canvas-image"
                  src={asset.url}
                  data-gallery-asset-id={asset.id}
                  alt=""
                  draggable={false}
                />
              ) : (
                <div className="image-placeholder">
                  <img src="/brand/add-photo.png" alt="" />
                  <strong>Choisissez une image</strong>
                </div>
              )}
            </div>
            {image.frame && (
              <div className="phone-frame-controls" aria-hidden="true">
                <span />
                <span />
                <i />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

