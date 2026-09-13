"use client";
import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from "react";
import type { MessageLanguage } from "../firebase/messages";
import { TEXT_SPACING, getImageAssetId, type PostPage } from "../firebase/postPages";
import type { GalleryAsset } from "../firebase/gallery";
import { CanvasBackgroundImage } from "./CanvasBackgroundImage";
import { ThemeableBackgroundArtwork } from "./ThemeableBackgroundArtwork";
import { getBackgroundColorStyle, getDefaultBackgroundColors, getDefaultTextColors, getTextColorStyle, getThemeStyle, isDarkColor, resolveBackgroundColors, resolveTextColors } from "./themePalettes";
const IMAGE_BASE_WIDTH = 47;
const BACKGROUND_PALETTE_SHAPE_COUNT = 4;
const PHONE_FRAME_CONTROLS_MIN_SCALE = 62;
export function PageCanvasPreview({
  postPage,
  messageTitle,
  messageDescription,
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
  postPage: PostPage;
  messageTitle: string;
  messageDescription: string;
  galleryAssets: GalleryAsset[];
  language?: MessageLanguage;
  showPlaceholder?: boolean;
  interactive?: boolean;
  previewWidth?: number;
  rootRef?: Ref<HTMLDivElement>;
  onImagePointerDown?: (
    event: ReactPointerEvent<HTMLDivElement>,
    image: PostPage["properties"]["images"][number],
  ) => void;
  onImagePointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onImagePointerUp?: () => void;
  onImagePointerCancel?: () => void;
}) {
  const backgroundAsset = galleryAssets.find(
    (asset) => asset.id === postPage.backgroundAssetId,
  );
  const backgroundImageUrl = backgroundAsset?.url ?? "";
  const activeBackgroundColors = resolveBackgroundColors(
    postPage.properties.backgroundColors,
    getDefaultBackgroundColors(
      postPage.theme,
      BACKGROUND_PALETTE_SHAPE_COUNT,
    ),
  );
  const darkTextBackdrop =
    postPage.properties.textBackdrop === "gradient-dark" ||
    postPage.properties.textBackdrop === "band-dark" ||
    isDarkColor(activeBackgroundColors.base);
  const thumbnailTextColors = resolveTextColors(
    postPage.properties.textColors,
    getDefaultTextColors(postPage.theme, darkTextBackdrop),
  );
  const themeStyle = {
    ...getThemeStyle(postPage.theme),
    ...getBackgroundColorStyle(activeBackgroundColors),
    ...getTextColorStyle(thumbnailTextColors),
    "--theme-label-bg":
      postPage.properties.assistantBackgroundColor ||
      activeBackgroundColors.base,
  };
  const [textVerticalPosition, textHorizontalPosition] =
    postPage.properties.textPosition.split("-");

  return (
    <div
      ref={rootRef}
      className={`page-preview-canvas ad-canvas format-${postPage.format} theme-${postPage.theme} background-${postPage.background} ${backgroundImageUrl ? "background-illustrated background-gallery-image" : ""}`}
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
          assetId={postPage.backgroundAssetId}
          positionY={postPage.properties.backgroundPositionY}
          url={backgroundImageUrl}
        />
      )}
      {!backgroundImageUrl && (
        <ThemeableBackgroundArtwork background={postPage.background} />
      )}
      <div className="blob blob-green" />
      <div className="blob blob-purple" />
      <div className="blob blob-blue" />

      <div
        className={`ad-copy text-row-${textVerticalPosition} text-align-${textHorizontalPosition} text-backdrop-${postPage.properties.textBackdrop} ${postPage.properties.showAssistantLabel ? "with-assistant" : "without-assistant"} ${messageDescription ? "with-description" : "without-description"}`}
        style={
          {
            "--text-width": `${postPage.properties.textWidth}%`,
            "--text-margin-x": `${postPage.properties.textMarginHorizontal}cqw`,
            "--text-margin-y": `${postPage.properties.textMarginVertical}cqw`,
            "--text-rotation": `${postPage.properties.textRotation}deg`,
            "--text-surface-padding": `${TEXT_SPACING}cqw`,
          } as CSSProperties
        }
      >
        <span className="text-backdrop-surface" aria-hidden="true" />
        {postPage.properties.showAssistantLabel && (
          <div className="assistant-label">
            <span aria-hidden="true">✦</span>
            <span className="assistant-label-text">Assistant DailyDish</span>
          </div>
        )}
        {(messageTitle || showPlaceholder) && <h2 className={messageTitle.length > 58 ? "long-title" : ""}>
          {messageTitle || "Votre titre"}
        </h2>}
        {messageDescription && <p>{messageDescription}</p>}
      </div>

      {postPage.properties.images.map((image, imageIndex) => {
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

