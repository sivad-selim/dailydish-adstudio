"use client";
import { Icon, SegmentedControl } from "./components";
import { FormatChangeDialog } from "./components/FormatChangeDialog";
import { PostPagesPanel, type MessageEditorHandle } from "./PostPagesPanel";
import { createPageVisualSaveQueue } from "./pageVisualSaveQueue";
import { InstagramPhonePreview, PREVIEW_PHONES, type PreviewPhone } from "./components/InstagramPhonePreview";

import { exportCanvasPng } from "./exportCanvasPng";
import { duplicatePostFolder } from "../firebase/duplicatePostFolder";
import { FORMAT_CONFIG } from "./adFormats";
import { changeImageFormat } from "./imagePositioning";
import {
  type CSSProperties,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MESSAGE_LANGUAGES,
  type MessageLanguage,
  type MessageTranslations,
} from "../firebase/messages";
import {
  createPostFolder,
  deletePostFolder,
  renamePostFolder,
  saveFolderPostOrder,
  subscribeToPostFolders,
  type PostFolder,
} from "../firebase/postFolders";
import {
  createStudioPost,
  deleteStudioPost,
  moveStudioPost,
  swapPageMessages,
  addPostPage,
  removePostPage,
  reorderPostPages,
  duplicateStudioPost,
  transferPostPage,
  subscribeToPosts,
  type StudioPost,
  type StudioPostType,
} from "../firebase/posts";
import {
  deleteGalleryAsset,
  listGalleryAssets,
  loadMissingGalleryAssets,
  moveGalleryAsset,
  uploadGalleryFiles,
  type GalleryAsset,
} from "../firebase/gallery";
import {
  BACKGROUND_POSITION_Y_MAX,
  BACKGROUND_POSITION_Y_MIN,
} from "./backgroundPosition";
import {
  createPageImage,
  setImageMultilingual,
  setImageForeground,
  createDefaultPageLayout,
  savePostPage,
  subscribeToPostPages,
  type AdBackground,
  type AdFormat,
  type AdTheme,
  type PostPage,
  type PageImage,
  type PageLayout,
  type TextBackdrop,
  type TextBubbleTarget,
  type TextBubbleTail,
  type TextColorTone,
  type TextPosition,
} from "../firebase/postPages";
import { PostManager, type PostListViewState } from "./PostManager";
import { PageCanvasPreview } from "./PageCanvasPreview";
import { StudioSettings } from "./StudioSettings";
import { PublicationCalendar } from "./PublicationCalendar";
import { SectionHeading } from "./SectionHeading";
import { Dropdown } from "./Dropdown";
import {
  DRAG_AUTO_SCROLL_EDGE,
  DRAG_AUTO_SCROLL_MAX_SPEED,
} from "./dragScroll";
import { GalleryManager } from "./GalleryManager";
import { GalleryImagePicker } from "./GalleryImagePicker";
import { ThemeableBackgroundArtwork } from "./ThemeableBackgroundArtwork";
import { ThemeColorControls } from "./ThemeColorControls";
import { StoreButtonsControls } from "./StoreButtonsControls";
import {
  CAPTURED_MONOCHOLOR_THEMES,
  CAPTURED_PASTEL_THEMES,
  CAPTURED_POP_THEMES,
  getBackgroundColorStyle,
  getDefaultBackgroundColors,
  getDefaultTextColors,
  getThemePaletteColors,
  getThemeStyle,
  getTextColorValue,
  getTextColorStyle,
  isDarkColor,
  resolveBackgroundColors,
  resolveTextColors,
  type ThemeOption,
} from "./themePalettes";

type AppView = "posts" | "studio" | "gallery" | "calendar" | "settings";
const PREVIEW_WIDTH_AT_100 = 827;
const PREVIEW_ZOOM_MIN = 25;
const PREVIEW_ZOOM_MAX = 150;
const PREVIEW_ZOOM_STEP = 5;

const PASTEL_THEMES: ThemeOption[] = [
  { id: "dailydish", label: "DailyDish" },
  { id: "lavender", label: "Lavande" },
  { id: "paprika", label: "Paprika" },
  { id: "lemon", label: "Citron" },
  { id: "blueberry", label: "Myrtille" },
  { id: "rose", label: "Roseraie" },
  { id: "lagoon", label: "Lagon" },
  { id: "vanilla", label: "Vanille" },
  { id: "fig", label: "Figue & sauge" },
  { id: "apricot", label: "Abricot & ciel" },
  { id: "mint", label: "Menthe & lilas" },
  { id: "cocoa", label: "Cacao rosé" },
  { id: "coral-jade", label: "Corail & jade" },
  { id: "saffron-indigo", label: "Safran & indigo" },
  { id: "plum-lime", label: "Prune & lime" },
  { id: "ocean-mandarin", label: "Océan & mandarine" },
  ...CAPTURED_PASTEL_THEMES,
];

const POP_THEMES: ThemeOption[] = CAPTURED_POP_THEMES;

const MONOCHOLOR_THEMES: ThemeOption[] = [
  { id: "mono-rose", label: "Rose" },
  { id: "mono-red", label: "Coquelicot" },
  { id: "mono-orange", label: "Mandarine" },
  { id: "mono-amber", label: "Ambre" },
  { id: "mono-yellow", label: "Citron" },
  { id: "mono-lime", label: "Pistache" },
  { id: "mono-green", label: "DailyDish" },
  { id: "mono-emerald", label: "Émeraude" },
  { id: "mono-teal", label: "Paon" },
  { id: "mono-cyan", label: "Lagon" },
  { id: "mono-sky", label: "Azur" },
  { id: "mono-cobalt", label: "Cobalt" },
  { id: "mono-indigo", label: "Indigo" },
  { id: "mono-violet", label: "Violet" },
  { id: "mono-purple", label: "Prune" },
  { id: "mono-fuchsia", label: "Fuchsia" },
  ...CAPTURED_MONOCHOLOR_THEMES,
];

const THEME_GROUPS: Array<{
  id: "pastel" | "pop" | "monocholor";
  label: string;
  themes: ThemeOption[];
}> = [
  { id: "pastel", label: "Pastel", themes: PASTEL_THEMES },
  { id: "pop", label: "Pop", themes: POP_THEMES },
  { id: "monocholor", label: "Monocholor", themes: MONOCHOLOR_THEMES },
];
const THEMEABLE_BACKGROUNDS: Array<{
  id: AdBackground;
  label: string;
}> = [
  { id: "solid", label: "Uni" },
  { id: "gradient", label: "Dégradé vertical" },
  { id: "cream", label: "Crème organique" },
  { id: "sage", label: "Carrés nomades" },
  { id: "rays", label: "Rayons doux" },
  { id: "ribbons", label: "Rubans flottants" },
  { id: "orbit", label: "Rayons japonais" },
  { id: "petals", label: "Feuilles abstraites" },
  { id: "bubbles", label: "Bulles en cascade" },
  { id: "mosaic", label: "Fenêtres flottantes" },
  { id: "capsules", label: "Balises douces" },
  { id: "pop-waves", label: "Vagues pop" },
  { id: "corner-fan", label: "Éventail graphique" },
  { id: "zigzag", label: "Zigzag géant" },
  { id: "folds", label: "Pliage kaléido" },
  { id: "halos", label: "Halo rétro" },
  { id: "flow-columns", label: "Courants verticaux" },
  { id: "soft-panels", label: "Panneaux arrondis" },
  { id: "sunset-bands", label: "Coucher graphique" },
  { id: "offset-discs", label: "Disques décalés" },
];
const BACKGROUND_COLOR_SLOT_COUNT: Record<AdBackground, number> = {
  solid: 0,
  gradient: 2,
  cream: 3,
  sage: 4,
  lines: 4,
  rays: 4,
  ribbons: 4,
  orbit: 2,
  petals: 4,
  bubbles: 4,
  mosaic: 4,
  capsules: 4,
  "pop-waves": 4,
  "corner-fan": 4,
  zigzag: 4,
  folds: 4,
  halos: 4,
  "flow-columns": 4,
  "soft-panels": 4,
  "sunset-bands": 4,
  "offset-discs": 4,
  magic: 4,
  scrapbook: 4,
};
const BACKGROUND_PALETTE_SHAPE_COUNT = 4;
const getInitialBackgroundColorTarget = (background: AdBackground) =>
  background === "gradient" ? "shape-0" : "base";
const TEXT_POSITIONS: Array<{ id: TextPosition; label: string }> = [
  { id: "top-left", label: "En haut à gauche" },
  { id: "top-center", label: "En haut au centre" },
  { id: "top-right", label: "En haut à droite" },
  { id: "middle-left", label: "Au milieu à gauche" },
  { id: "middle-center", label: "Au centre" },
  { id: "middle-right", label: "Au milieu à droite" },
  { id: "bottom-left", label: "En bas à gauche" },
  { id: "bottom-center", label: "En bas au centre" },
  { id: "bottom-right", label: "En bas à droite" },
];
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
type HomeProps = {
  accountEmail?: string;
  onSignOut?: () => void;
};

export default function Home({ accountEmail, onSignOut }: HomeProps = {}) {
  const [appView, setAppView] = useState<AppView>("posts");
  const postsScrollRef = useRef<number | null>(null);
  const postsViewStateRef = useRef<PostListViewState>({ expandedPostId: "", collapsedFolderKeys: [] });
  const [postPages, setPostPages] = useState<PostPage[]>([]);
  const [postPagesLoading, setPostPagesLoading] = useState(true);
  const [postPageError, setPostPageError] = useState("");
  const [postFolders, setPostFolders] = useState<PostFolder[]>([]);
  const [postFoldersLoading, setPostFoldersLoading] = useState(true);
  const [postFolderError, setPostFolderError] = useState("");
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postError, setPostError] = useState("");
  const [duplicatingEditorPage, setDuplicatingEditorPage] = useState(false);
  const duplicatingEditorPageRef = useRef(false);
  const [selectedPostPageId, setSelectedPostPageId] = useState("");
  const [editingPostId, setEditingPostId] = useState("");
  const [addingEditorPage, setAddingEditorPage] = useState(false);
  const [selectedPostPageName, setSelectedPostPageName] = useState("");
  const [draggedEditorPageId, setDraggedEditorPageId] = useState("");
  const [dragOverEditorPageId, setDragOverEditorPageId] = useState("");
  const [postPageSaveStatus, setPostPageSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const messageEditorRef = useRef<MessageEditorHandle>(null);
  const [messagePreview, setMessagePreview] = useState<{id: string; translations: MessageTranslations} | null>(null);
  const [galleryAssets, setGalleryAssets] = useState<GalleryAsset[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const [messageLanguage, setMessageLanguage] =
    useState<MessageLanguage>("fr");

  const [showInstagramGuides, setShowInstagramGuides] = useState(true);
  const [previewPhone, setPreviewPhone] = useState<PreviewPhone>("pixel-10-pro-xl");
  const [showInstagramAdButton, setShowInstagramAdButton] = useState(true);
  const [format, setFormat] = useState<AdFormat>("portrait");
  const [pendingFormat, setPendingFormat] = useState<AdFormat | null>(null);
  useEffect(() => { setPendingFormat(null); }, [selectedPostPageId]);
  const [properties, setProperties] = useState<PageLayout>(
    createDefaultPageLayout,
  );
  const [theme, setTheme] = useState<AdTheme>("dailydish");
  const [background, setBackground] = useState<AdBackground>("cream");
  const [backgroundAssetId, setBackgroundAssetId] = useState("");
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [previewZoom, setPreviewZoom] = useState(75);
  const [openThemeGroups, setOpenThemeGroups] = useState<Set<string>>(
    () => new Set(["pastel"]),
  );
  const [selectedBackgroundColorTarget, setSelectedBackgroundColorTarget] =
    useState("base");
  const [selectedTextColorTarget, setSelectedTextColorTarget] =
    useState("title");
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageDragRef = useRef<{
    imageId: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const hydratedPostPageIdRef = useRef("");
  const currentEditorDraftRef = useRef<PostPage | null>(null);
  const [visualSaveQueue] = useState(() => createPageVisualSaveQueue(savePostPage));
  const visualSaveTimerRef = useRef<number | null>(null);
  const editorDragPointerYRef = useRef<number | null>(null);
  const editorAutoScrollFrameRef = useRef<number | null>(null);
  const {
    backgroundColors,
    backgroundPositionY,
    assistantBackgroundColor,
    textColors,
    textPosition,
    textWidth,
    textMarginHorizontal,
    textMarginVertical,
    textRotation,
    showAssistantLabel,
    textBackdrop,
    images,
  } = properties;
  const selectedPostPage =
    postPages.find((postPage) => postPage.id === selectedPostPageId) ?? null;
  const editingPost =
    posts.find(
      (post) => post.id === (editingPostId || selectedPostPage?.postId),
    ) ?? null;
  const editingPostPages = editingPost
    ? editingPost.pageIds
        .map((pageId) =>
          postPages.find((postPage) => postPage.id === pageId),
        )
        .filter((postPage): postPage is PostPage => Boolean(postPage))
    : [];
  const selectedTranslations = messagePreview && messagePreview.id === selectedPostPage?.id ? messagePreview.translations : selectedPostPage?.translations;
  const title = selectedTranslations?.[messageLanguage].title ?? "";
  const description = selectedTranslations?.[messageLanguage].description ?? "";
  const imageGalleryAssets = galleryAssets;
  const backgroundGalleryAssets = galleryAssets;
  const missingGalleryAssetIds = useMemo(() => {
    const known = new Set(galleryAssets.map((asset) => asset.id));
    const referenced = postPages.flatMap((page) => [
      page.backgroundAssetId,
      ...(page.properties.storeButtons.enabled ? [page.properties.storeButtons.iosAssetId, page.properties.storeButtons.androidAssetId] : []),
      ...page.properties.images.flatMap((image) => [
        image.assetId,
        ...Object.values(image.localizedAssetIds ?? {}),
      ]),
    ]);
    return JSON.stringify([...new Set(referenced.filter((id) => id && !known.has(id)))].sort());
  }, [postPages, galleryAssets]);
  const selectedBackgroundAsset =
    backgroundGalleryAssets.find((asset) => asset.id === backgroundAssetId) ??
    null;
  const customBackgroundUrl = selectedBackgroundAsset?.url ?? "";
  const backgroundShapeCount = BACKGROUND_COLOR_SLOT_COUNT[background];
  const themePaletteColors = getThemePaletteColors(theme);
  const defaultBackgroundColors = getDefaultBackgroundColors(
    theme,
    BACKGROUND_PALETTE_SHAPE_COUNT,
  );
  const activeBackgroundColors = resolveBackgroundColors(
    backgroundColors,
    defaultBackgroundColors,
  );
  const activeAssistantBackgroundColor =
    assistantBackgroundColor || activeBackgroundColors.base;
  const darkTextBackdrop =
    textBackdrop === "gradient-dark" || textBackdrop === "band-dark";
  const defaultTextColors = getDefaultTextColors(
    theme,
    darkTextBackdrop || isDarkColor(activeBackgroundColors.base),
  );
  const activeTextColors = resolveTextColors(textColors, defaultTextColors);
  const selectedThemeStyle = {
    ...getThemeStyle(theme),
    ...getBackgroundColorStyle(activeBackgroundColors),
    ...getTextColorStyle(activeTextColors),
    "--theme-label-bg": activeAssistantBackgroundColor,
  };
  const backgroundColorTargets = [
    ...(background === "gradient"
      ? []
      : [
          {
            id: "base",
            label: "Fond",
            help: "Couleur de base",
            color: activeBackgroundColors.base,
          },
        ]),
    ...activeBackgroundColors.shapes
      .slice(0, backgroundShapeCount)
      .map((color, index) => ({
      id: `shape-${index}`,
      label: `Forme ${index + 1}`,
      help: "Groupe de formes",
      color,
      })),
    {
      id: "assistant-background",
      label: "Fond de la pilule",
      help: "Couleur de la pilule Assistant DailyDish",
      color: activeAssistantBackgroundColor,
      sectionLabel: "Options",
    },
  ];
  const textColorTargets = [
    {
      id: "title",
      label: "Titre",
      help: "Titre principal",
      color: activeTextColors.title.color,
      previewColor: getTextColorValue(activeTextColors.title),
      tone: activeTextColors.title.tone,
    },
    {
      id: "description",
      label: "Description",
      help: "Texte secondaire",
      color: activeTextColors.description.color,
      previewColor: getTextColorValue(activeTextColors.description),
      tone: activeTextColors.description.tone,
    },
    {
      id: "assistant",
      label: "Pilule",
      help: "Texte Assistant DailyDish",
      color: activeTextColors.assistant.color,
      previewColor: getTextColorValue(activeTextColors.assistant),
      tone: activeTextColors.assistant.tone,
    },
  ];

  const updatePageLayout = (
    updater: (current: PageLayout) => PageLayout,
  ) => setProperties(updater);

  useEffect(() => {
    if (!accountEmail) return;

    try {
      return subscribeToPostPages(
        (nextPostPages) => {
          const editorDraft = currentEditorDraftRef.current;
          setPostPages(
            editorDraft
              ? nextPostPages.map((postPage) =>
                  postPage.id === editorDraft.id
                    ? { ...editorDraft, translations: postPage.translations, postId: postPage.postId, updatedAt: postPage.updatedAt }
                    : postPage,
                )
              : nextPostPages,
          );
          setPostPageError("");
          setPostPagesLoading(false);
        },
        () => {
          setPostPageError(
            "Les créations ne peuvent pas être synchronisées pour le moment.",
          );
          setPostPagesLoading(false);
        },
      );
    } catch {
      setPostPageError(
        "Les créations ne peuvent pas être synchronisées pour le moment.",
      );
      setPostPagesLoading(false);
    }
  }, [accountEmail]);


  useEffect(() => {
    if (!accountEmail) {
      setPostFoldersLoading(false);
      return;
    }

    try {
      return subscribeToPostFolders(
        (nextFolders) => {
          setPostFolders(nextFolders);
          setPostFolderError("");
          setPostFoldersLoading(false);
        },
        () => {
          setPostFolderError(
            "Les dossiers ne peuvent pas être synchronisés pour le moment.",
          );
          setPostFoldersLoading(false);
        },
      );
    } catch {
      setPostFolderError(
        "Les dossiers ne peuvent pas être synchronisés pour le moment.",
      );
      setPostFoldersLoading(false);
    }
  }, [accountEmail]);

  useEffect(() => {
    if (!accountEmail) {
      setPostsLoading(false);
      return;
    }

    try {
      return subscribeToPosts(
        (nextPosts) => {
          setPosts(nextPosts);
          setPostError("");
          setPostsLoading(false);
        },
        () => {
          setPostError("Les posts ne peuvent pas être synchronisés pour le moment.");
          setPostsLoading(false);
        },
      );
    } catch {
      setPostError("Les posts ne peuvent pas être synchronisés pour le moment.");
      setPostsLoading(false);
    }
  }, [accountEmail]);


  useEffect(() => {
    if (!accountEmail) {
      setGalleryLoading(false);
      return;
    }

    let cancelled = false;
    setGalleryLoading(true);
    void listGalleryAssets()
      .then((assets) => {
        if (cancelled) return;
        setGalleryAssets(assets);
        setGalleryError("");
      })
      .catch(() => {
        if (cancelled) return;
        setGalleryError(
          "La galerie ne peut pas être synchronisée pour le moment.",
        );
      })
      .finally(() => {
        if (!cancelled) setGalleryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountEmail]);


  useEffect(() => {
    if (!accountEmail || galleryLoading || missingGalleryAssetIds === "[]") return;
    let cancelled = false;
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      const result = await loadMissingGalleryAssets(JSON.parse(missingGalleryAssetIds), []);
      loading = false;
      if (cancelled) return;
      if (result.assets.length) {
        setGalleryAssets((current) => {
          const merged = new Map(result.assets.map((asset) => [asset.id, asset]));
          current.forEach((asset) => merged.set(asset.id, asset));
          return [...merged.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        });
      }
      setGalleryError(result.failedIds.length
        ? "Certaines images des posts n’ont pas pu être chargées. Réessaie en revenant sur cet onglet."
        : "");
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, [accountEmail, galleryLoading, missingGalleryAssetIds]);

  useEffect(() => {
    if (
      appView !== "studio" ||
      !selectedPostPage ||
      hydratedPostPageIdRef.current === selectedPostPage.id
    ) {
      return;
    }

    visualSaveQueue.loaded(selectedPostPage);
    setReady(false);
    setSelectedPostPageName(selectedPostPage.name);
    setFormat(selectedPostPage.format);
    setTheme(selectedPostPage.theme);
    setBackground(selectedPostPage.background);
    setSelectedBackgroundColorTarget(
      getInitialBackgroundColorTarget(selectedPostPage.background),
    );
    setBackgroundAssetId(selectedPostPage.backgroundAssetId);
    setProperties({
      ...selectedPostPage.properties,
      images: selectedPostPage.properties.images.map((image) => ({ ...image })),
    });
    hydratedPostPageIdRef.current = selectedPostPage.id;
    setPostPageSaveStatus("saved");
    setReady(true);
  }, [appView, selectedPostPage, visualSaveQueue]);

  useEffect(() => {
    if (
      !ready ||
      !selectedPostPageId ||
      hydratedPostPageIdRef.current !== selectedPostPageId
    ) {
      return;
    }

    const draft = {
      id: selectedPostPageId,
      name: selectedPostPageName,
      format,
      theme,
      background,
      backgroundAssetId,
      properties,
    };
    if (visualSaveQueue.isSaved(draft)) {
      setPostPageSaveStatus("saved");
      return;
    }
    setPostPageSaveStatus("saving");
    visualSaveTimerRef.current = window.setTimeout(() => {
      visualSaveTimerRef.current = null;
      void visualSaveQueue.save(draft)
        .then(() => {
          if (currentEditorDraftRef.current?.id !== draft.id || !visualSaveQueue.isSaved(currentEditorDraftRef.current)) return;
          setPostPageSaveStatus("saved");
          setPostPageError("");
        })
        .catch(() => {
          if (currentEditorDraftRef.current?.id !== draft.id) return;
          setPostPageSaveStatus("error");
          setPostPageError("La page n’a pas pu être enregistrée.");
        });
    }, 600);

    return () => {
      if (visualSaveTimerRef.current !== null) window.clearTimeout(visualSaveTimerRef.current);
      visualSaveTimerRef.current = null;
    };
  }, [
    background,
    backgroundAssetId,
    format,
    properties,
    ready,
    selectedPostPageId,
    selectedPostPageName,
    theme,
    visualSaveQueue,
  ]);

  const selectBackgroundImage = (asset: GalleryAsset) => {
    setBackgroundAssetId(asset.id);
    setBackground("cream");
  };

  const removeBackgroundImage = () => {
    setBackgroundAssetId("");
    setBackground("cream");
  };

  const startDraggingImage = (
    event: ReactPointerEvent<HTMLDivElement>,
    image: PageImage,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    imageDragRef.current = {
      imageId: image.id,
      startX: event.clientX,
      startY: event.clientY,
      x: image.x,
      y: image.y,
    };
  };

  const dragImage = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = imageDragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;

    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const x =
      drag.x + ((event.clientX - drag.startX) / bounds.width) * 100;
    const y =
      drag.y + ((event.clientY - drag.startY) / bounds.width) * 100;

    updatePageLayout((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === drag.imageId
          ? {
              ...image,
              x: Math.round(clamp(x, -150, 150)),
              y: Math.round(clamp(y, -150, 150)),
            }
          : image,
      ),
    }));
  };

  const stopDraggingImage = () => {
    imageDragRef.current = null;
  };

  const updatePostPageProperty = <Key extends keyof PageLayout,>(
    property: Key,
    value: PageLayout[Key],
  ) => {
    updatePageLayout((current) => ({
      ...current,
      [property]: value,
    }));
  };

  const selectTheme = (nextTheme: AdTheme) => {
    const nextBackgroundColors = getDefaultBackgroundColors(
      nextTheme,
      BACKGROUND_PALETTE_SHAPE_COUNT,
    );
    setTheme(nextTheme);
    setSelectedBackgroundColorTarget(
      getInitialBackgroundColorTarget(background),
    );
    setSelectedTextColorTarget("title");
    updatePageLayout((current) => ({
      ...current,
      backgroundColors: nextBackgroundColors,
      assistantBackgroundColor: nextBackgroundColors.base,
      textColors: getDefaultTextColors(
        nextTheme,
        darkTextBackdrop || isDarkColor(nextBackgroundColors.base),
      ),
    }));
  };

  const selectThemeableBackground = (nextBackground: AdBackground) => {
    setBackground(nextBackground);
    setBackgroundAssetId("");
    setSelectedBackgroundColorTarget(
      getInitialBackgroundColorTarget(nextBackground),
    );
  };

  const selectBackgroundColor = (target: string, color: string) => {
    if (target === "assistant-background") {
      updatePostPageProperty("assistantBackgroundColor", color);
      return;
    }

    updatePostPageProperty("backgroundColors", {
      base: target === "base" ? color : activeBackgroundColors.base,
      shapes: activeBackgroundColors.shapes.map((shapeColor, index) =>
        target === `shape-${index}` ? color : shapeColor,
      ),
    });
  };

  const selectTextColor = (target: string, color: string) => {
    updatePostPageProperty("textColors", {
      title:
        target === "title"
          ? { ...activeTextColors.title, color }
          : activeTextColors.title,
      description:
        target === "description"
          ? { ...activeTextColors.description, color }
          : activeTextColors.description,
      assistant:
        target === "assistant"
          ? { ...activeTextColors.assistant, color }
          : activeTextColors.assistant,
    });
  };

  const selectTextTone = (target: string, tone: TextColorTone) => {
    updatePostPageProperty("textColors", {
      title:
        target === "title"
          ? { ...activeTextColors.title, tone }
          : activeTextColors.title,
      description:
        target === "description"
          ? { ...activeTextColors.description, tone }
          : activeTextColors.description,
      assistant:
        target === "assistant"
          ? { ...activeTextColors.assistant, tone }
          : activeTextColors.assistant,
    });
  };

  const addImage = () => {
    updatePageLayout((current) => ({
      ...current,
      images: [
        ...current.images,
        createPageImage(crypto.randomUUID(), {
          x: Math.min(current.images.length * 8, 40),
          y: Math.min(current.images.length * 8, 40),
        }),
      ],
    }));
  };

  const updateImage = (
    imageId: string,
    updater: (image: PageImage) => PageImage,
  ) => {
    updatePageLayout((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === imageId ? updater(image) : image,
      ),
    }));
  };

  const removeImage = (imageId: string) => {
    updatePageLayout((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== imageId),
    }));
  };

  const handleUploadGalleryFiles = async (files: File[], folderId = "") => {
    setGalleryUploading(true);
    setGalleryError("");
    try {
      await uploadGalleryFiles(files, folderId);
      setGalleryAssets(await listGalleryAssets());
    } catch (error: unknown) {
      setGalleryError(
        error instanceof Error
          ? error.message
          : "Les images n’ont pas pu être importées.",
      );
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleDeleteGalleryAsset = async (asset: GalleryAsset) => {
    setGalleryError("");
    try {
      await deleteGalleryAsset(asset.path);
      setGalleryAssets((current) =>
        current.filter((currentAsset) => currentAsset.id !== asset.id),
      );
      setProperties((current) => ({
        ...current,
        images: current.images.map((image) =>
          ({ ...image,
            assetId: image.assetId === asset.id ? "" : image.assetId,
            localizedAssetIds: Object.fromEntries(Object.entries(image.localizedAssetIds ?? {}).map(
              ([language, assetId]) => [language, assetId === asset.id ? "" : assetId],
            )),
          }),
        ),
      }));
      if (backgroundAssetId === asset.id) setBackgroundAssetId("");
    } catch (error) {
      setGalleryError("Cette image n’a pas pu être supprimée.");
      throw error;
    }
  };

  useLayoutEffect(() => {
    if (appView !== "posts" || postPagesLoading || postFoldersLoading || postsLoading || postsScrollRef.current === null) return;
    window.scrollTo({ top: postsScrollRef.current, behavior: "instant" });
    postsScrollRef.current = null;
  }, [appView, postPagesLoading, postFoldersLoading, postsLoading]);

  const openPostPage = (postPageId: string, postId = "") => {
    if (appView === "posts") postsScrollRef.current = window.scrollY;
    setReady(false);
    hydratedPostPageIdRef.current = "";
    setEditingPostId(postId || postPages.find((page) => page.id === postPageId)?.postId || "");
    setSelectedPostPageId(postPageId);
    setAppView("studio");
  };

  const editorDraft = useMemo(() =>
    appView === "studio" && ready && selectedPostPage
      ? {
          id: selectedPostPage.id,
          name: selectedPostPageName,
          postId: selectedPostPage.postId,
          translations: selectedPostPage.translations,
          format,
          theme,
          background,
          backgroundAssetId,
          properties,
          updatedAt: selectedPostPage.updatedAt,
        }
      : null, [appView, ready, selectedPostPage, selectedPostPageName, format, theme, background, backgroundAssetId, properties]);
  useLayoutEffect(() => { currentEditorDraftRef.current = editorDraft; }, [editorDraft]);

  useEffect(() => {
    const editorDraft = currentEditorDraftRef.current;
    if (!editorDraft) return;

    setPostPages((currentPostPages) => {
      const currentPostPage = currentPostPages.find(
        (postPage) => postPage.id === editorDraft.id,
      );
      if (
        !currentPostPage ||
        (currentPostPage.name === editorDraft.name &&

          currentPostPage.format === editorDraft.format &&
          currentPostPage.theme === editorDraft.theme &&
          currentPostPage.background === editorDraft.background &&
          currentPostPage.backgroundAssetId === editorDraft.backgroundAssetId &&
          currentPostPage.properties === editorDraft.properties)
      ) {
        return currentPostPages;
      }

      return currentPostPages.map((postPage) =>
        postPage.id === editorDraft.id ? editorDraft : postPage,
      );
    });
  }, [
    appView,
    background,
    backgroundAssetId,
    format,
    properties,
    ready,
    selectedPostPageId,
    selectedPostPageName,
    theme,
  ]);

  const flushEditor = async () => {
    // Edits can continue while a write is pending. Drain the latest draft too.
    do {
      if (visualSaveTimerRef.current !== null) window.clearTimeout(visualSaveTimerRef.current);
      visualSaveTimerRef.current = null;
      await messageEditorRef.current?.flush();
      const draft = currentEditorDraftRef.current;
      if (draft) await visualSaveQueue.save(draft);
      await messageEditorRef.current?.flush();
    } while (currentEditorDraftRef.current && !visualSaveQueue.isSaved(currentEditorDraftRef.current));
  };

  const activateGalleryPage = async (postPageId: string) => {
    if (postPageId === selectedPostPageId) return;
    const postPage = postPages.find((candidate) => candidate.id === postPageId);
    if (!postPage) return;

    try {
      await flushEditor();
    } catch {
      const message = "La page n’a pas pu être enregistrée. Réessaie avant de changer de page.";
      setPostPageSaveStatus("error");
      setPostPageError(message);
      throw new Error(message);
    }

    setMessagePreview(null);
    visualSaveQueue.loaded(postPage);
    hydratedPostPageIdRef.current = postPage.id;
    setSelectedPostPageId(postPage.id);
    setSelectedPostPageName(postPage.name);
    setFormat(postPage.format);
    setTheme(postPage.theme);
    setBackground(postPage.background);
    setSelectedBackgroundColorTarget(
      getInitialBackgroundColorTarget(postPage.background),
    );
    setBackgroundAssetId(postPage.backgroundAssetId);
    setProperties({
      ...postPage.properties,
      images: postPage.properties.images.map((image) => ({ ...image })),
    });
    setPostPageSaveStatus("saved");
    setReady(true);
  };

  const stopEditorPageAutoScroll = () => {
    editorDragPointerYRef.current = null;
    if (editorAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(editorAutoScrollFrameRef.current);
      editorAutoScrollFrameRef.current = null;
    }
  };

  const runEditorPageAutoScroll = () => {
    editorAutoScrollFrameRef.current = null;
    const pointerY = editorDragPointerYRef.current;
    if (pointerY === null) return;
    let speed = 0;
    if (pointerY < DRAG_AUTO_SCROLL_EDGE) {
      const intensity = Math.min(
        1,
        (DRAG_AUTO_SCROLL_EDGE - pointerY) / DRAG_AUTO_SCROLL_EDGE,
      );
      speed = -Math.max(
        2,
        Math.round(DRAG_AUTO_SCROLL_MAX_SPEED * intensity),
      );
    } else if (pointerY > window.innerHeight - DRAG_AUTO_SCROLL_EDGE) {
      const intensity = Math.min(
        1,
        (pointerY - (window.innerHeight - DRAG_AUTO_SCROLL_EDGE)) /
          DRAG_AUTO_SCROLL_EDGE,
      );
      speed = Math.max(
        2,
        Math.round(DRAG_AUTO_SCROLL_MAX_SPEED * intensity),
      );
    }
    if (speed === 0) return;
    window.scrollBy(0, speed);
    editorAutoScrollFrameRef.current = window.requestAnimationFrame(
      runEditorPageAutoScroll,
    );
  };

  const updateEditorPageAutoScroll = (pointerY: number) => {
    editorDragPointerYRef.current = pointerY;
    const nearEdge =
      pointerY < DRAG_AUTO_SCROLL_EDGE ||
      pointerY > window.innerHeight - DRAG_AUTO_SCROLL_EDGE;
    if (!nearEdge) {
      if (editorAutoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(editorAutoScrollFrameRef.current);
        editorAutoScrollFrameRef.current = null;
      }
      return;
    }
    if (editorAutoScrollFrameRef.current === null) {
      editorAutoScrollFrameRef.current = window.requestAnimationFrame(
        runEditorPageAutoScroll,
      );
    }
  };

  useEffect(
    () => () => {
      if (editorAutoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(editorAutoScrollFrameRef.current);
      }
    },
    [],
  );

  const handleCreatePostFolder = async (name: string) => {
    setPostFolderError("");
    try {
      await createPostFolder(name);
    } catch (error) {
      setPostFolderError("Le dossier n’a pas pu être créé.");
      throw error;
    }
  };

  const handleDeletePostFolder = async (folder: PostFolder) => {
    setPostFolderError("");
    try {
      await Promise.all(
        posts
          .filter((post) => post.folderId === folder.id)
          .map((post) => moveStudioPost(post.id, "")),
      );
      await deletePostFolder(folder.id);
    } catch (error) {
      setPostFolderError("Le dossier n’a pas pu être supprimé.");
      throw error;
    }
  };

  const handleRenamePostFolder = async (
    folder: PostFolder,
    name: string,
  ) => {
    setPostFolderError("");
    try {
      await renamePostFolder(folder.id, name);
    } catch (error) {
      setPostFolderError("Le dossier n’a pas pu être renommé.");
      throw error;
    }
  };

  const handleCreatePost = async (
    folderId: string,
    type: StudioPostType,
  ): Promise<string> => {
    setPostError("");
    const post = await createStudioPost(folderId, type === "gallery" ? 2 : 1);
    openPostPage(post.pageIds[0], post.id);
    return post.id;
  };

  const handleAddPostPage = async (post: StudioPost) => {
    await messageEditorRef.current?.flush();
    await addPostPage(post.id);
  };

  const handleMovePost = async (post: StudioPost, folderId: string) => {
    setPostError("");
    try {
      await moveStudioPost(post.id, folderId);
    } catch (error) {
      setPostError("Le post n’a pas pu être déplacé.");
      throw error;
    }
  };

  const handleReorderPostPages = async (
    post: StudioPost,
    pageIds: string[],
  ) => {
    setPostError("");
    try {
      await reorderPostPages(post.id, pageIds);
    } catch (error) {
      setPostError("L’ordre des pages n’a pas pu être enregistré.");
      throw error;
    }
  };

  const handleDeletePostPage = async (
    post: StudioPost,
    page: PostPage,
  ) => {
    setPostError("");
    try {
      await removePostPage(post.id, page.id);
    } catch (error) {
      setPostError("La page n’a pas pu être supprimée.");
      throw error;
    }
  };

  const reorderGalleryEditorPage = async (targetPageId: string) => {
    if (
      !editingPost ||
      !draggedEditorPageId ||
      draggedEditorPageId === targetPageId
    ) {
      return;
    }
    const pageIds = [...editingPost.pageIds];
    const sourceIndex = pageIds.indexOf(draggedEditorPageId);
    const targetIndex = pageIds.indexOf(targetPageId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    pageIds.splice(sourceIndex, 1);
    pageIds.splice(targetIndex, 0, draggedEditorPageId);
    setDraggedEditorPageId("");
    setDragOverEditorPageId("");
    stopEditorPageAutoScroll();
    await handleReorderPostPages(editingPost, pageIds);
  };

  const duplicateGalleryEditorPage = async (page: PostPage) => {
    if (!editingPost || duplicatingEditorPageRef.current) return;
    duplicatingEditorPageRef.current = true;
    setDuplicatingEditorPage(true);
    setPostError("");
    try {
      const draft = currentEditorDraftRef.current;
      const source = draft?.id === page.id ? draft : page;
      await messageEditorRef.current?.flush();
      await addPostPage(editingPost.id, page.id, source);
    } catch {
      setPostError("La page n’a pas pu être dupliquée.");
    } finally {
      duplicatingEditorPageRef.current = false;
      setDuplicatingEditorPage(false);
    }
  };

  const deleteGalleryEditorPage = async (page: PostPage) => {
    if (!editingPost) return;
    await messageEditorRef.current?.flush();
    const confirmed = window.confirm("Supprimer cette page et son message ?");
    if (!confirmed) return;

    if (page.id === selectedPostPageId) {
      const currentIndex = editingPostPages.findIndex(
        (candidate) => candidate.id === page.id,
      );
      const nextPage =
        editingPostPages[currentIndex + 1] ??
        editingPostPages[currentIndex - 1] ??
        null;
      currentEditorDraftRef.current = null;
      if (nextPage) await activateGalleryPage(nextPage.id);
      else {
        setEditingPostId("");
        setSelectedPostPageId("");
        setAppView("posts");
      }
    }

    await handleDeletePostPage(editingPost, page);
  };

  const handleDeletePost = async (post: StudioPost) => {
    setPostError("");
    try {
      await deleteStudioPost(post.id);
    } catch (error) {
      setPostError("Le post n’a pas pu être supprimé.");
      throw error;
    }
  };

  const handleDuplicatePost = async (post: StudioPost) => {
    await duplicateStudioPost(post.id);
  };

  const exportPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;

    setExporting(true);
    setExportError("");
    try {
      const opaquePng = await exportCanvasPng(canvas, format, galleryAssets);
      const downloadUrl = URL.createObjectURL(opaquePng);
      const link = document.createElement("a");
      link.download = `dailydish-publicite-${FORMAT_CONFIG[format].exportName}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = downloadUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
    } catch (error) {
      console.error(error);
      setExportError(
        error instanceof Error
          ? `Le PNG n’a pas pu être généré : ${error.message}`
          : "Le PNG n’a pas pu être généré.",
      );
    } finally {
      setExporting(false);
    }
  };

  const renderActiveCanvas = () => {
    const activePostPage = editorDraft ?? selectedPostPage;
    if (!activePostPage) return null;

    return (
      <InstagramPhonePreview enabled={showInstagramGuides} phone={previewPhone}
        previewWidth={Math.round((PREVIEW_WIDTH_AT_100 * previewZoom) / 100)}
        imageWidth={FORMAT_CONFIG[activePostPage.format].width} imageHeight={FORMAT_CONFIG[activePostPage.format].height}
        showAdButton={showInstagramAdButton}>
      {(width) => <PageCanvasPreview
        postPage={activePostPage}
        messageTitle={title}
        messageDescription={description.trim()}
        language={messageLanguage}
        galleryAssets={imageGalleryAssets}
        interactive
        previewWidth={width}
        rootRef={canvasRef}
        onImagePointerDown={startDraggingImage}
        onImagePointerMove={dragImage}
        onImagePointerUp={stopDraggingImage}
        onImagePointerCancel={stopDraggingImage}
      />}
      </InstagramPhonePreview>
    );
  };

  const renderGalleryEditorPage = (page: PostPage) => {
    const pageIndex = editingPostPages.findIndex(
      (candidate) => candidate.id === page.id,
    );
    const isActive = page.id === selectedPostPageId;
    const pageTranslation = page.translations[messageLanguage];
    return (
      <div
        key={page.id}
        className={`gallery-editor-page gallery-editor-page-preview-shell format-${page.format} ${isActive ? "active" : ""} ${draggedEditorPageId === page.id ? "dragging" : ""} ${dragOverEditorPageId === page.id ? "drag-over" : ""}`}
        style={
          {
            "--preview-width": `${Math.round(
              (PREVIEW_WIDTH_AT_100 * previewZoom) / 100,
            )}px`,
          } as CSSProperties
        }
        onDragOver={(event) => {
          if (!draggedEditorPageId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragOverEditorPageId(page.id);
          updateEditorPageAutoScroll(event.clientY);
        }}
        onDrop={(event) => {
          if (!draggedEditorPageId) return;
          event.preventDefault();
          void reorderGalleryEditorPage(page.id).catch(() => undefined);
        }}
      >
        <div
          className="gallery-editor-page-header"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(
              "application/x-dailydish-editor-page",
              page.id,
            );
            setDraggedEditorPageId(page.id);
            updateEditorPageAutoScroll(event.clientY);
          }}
          onDrag={(event) => {
            if (event.clientY > 0) updateEditorPageAutoScroll(event.clientY);
          }}
          onDragEnd={() => {
            stopEditorPageAutoScroll();
            setDraggedEditorPageId("");
            setDragOverEditorPageId("");
          }}
        >
          <button
            type="button"
            className="gallery-editor-page-label"
            onClick={() => {
              if (!isActive) void activateGalleryPage(page.id).catch(() => undefined);
            }}
            aria-label={`Sélectionner la page ${pageIndex + 1}`}
            aria-current={isActive ? "page" : undefined}
          >
            Page {pageIndex + 1}
          </button>
          <div className="gallery-editor-page-actions">
          <button
            type="button"
            className="gallery-editor-page-duplicate"
            disabled={duplicatingEditorPage}
            onClick={() => void duplicateGalleryEditorPage(page)}
            aria-label={`Dupliquer la page ${pageIndex + 1}`}
            title="Dupliquer la page"
          >
            <Icon name="content_copy" />
          </button>
          <button
            type="button"
            className="gallery-editor-page-delete"
            onClick={() =>
              void deleteGalleryEditorPage(page).catch(() => undefined)
            }
            aria-label={`Supprimer la page ${pageIndex + 1}`}
            title="Supprimer la page"
          >
            <Icon name="delete" />
          </button>
          </div>
        </div>
        {isActive ? (
          renderActiveCanvas()
        ) : (
          <InstagramPhonePreview enabled={showInstagramGuides} phone={previewPhone}
            previewWidth={Math.round((PREVIEW_WIDTH_AT_100 * previewZoom) / 100)}
            imageWidth={FORMAT_CONFIG[page.format].width} imageHeight={FORMAT_CONFIG[page.format].height}
            showAdButton={showInstagramAdButton}>
            {(width) => <PageCanvasPreview
              postPage={page}
              messageTitle={pageTranslation?.title ?? ""}
              messageDescription={pageTranslation?.description ?? ""}
              language={messageLanguage}
              galleryAssets={backgroundGalleryAssets}
              previewWidth={width}
            />}
          </InstagramPhonePreview>
        )}
      </div>
    );
  };

  const navigateToView = async (nextView: Exclude<AppView, "studio">) => {
    if (appView === "posts" && nextView !== "posts") postsScrollRef.current = window.scrollY;
    if (appView === "studio") {
      try {
        await flushEditor();
      } catch {
        setPostPageSaveStatus("error");
        setPostPageError("La page n’a pas pu être enregistrée. Réessaie avant de quitter l’éditeur.");
        return;
      }
    }
    setAppView(nextView);
  };

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="brand-lockup">
          <img src="/brand/logo-transparent.png" alt="" />
          <div>
            <p>DailyDish</p>
            <h1>Ad Studio</h1>
          </div>
        </div>
        <div className="studio-navigation-group">
          <button type="button" className={`studio-settings-button ${appView === "settings" ? "selected" : ""}`} aria-label="Réglages" title="Réglages" aria-pressed={appView === "settings"} onClick={() => navigateToView("settings")}><Icon name="build" /></button>
        <SegmentedControl<Exclude<AppView, "studio">> as="nav" className="studio-navigation" label="Navigation principale"
          value={appView === "studio" ? "posts" : appView}
          options={[
            {id: "calendar", label: "Calendrier", className: "calendar-nav"},
            {id: "posts", label: "Posts"},
            {id: "gallery", label: "Galerie"},
          ]}
          onChange={(view) => void navigateToView(view)} />
        </div>
        <div className="header-actions">
          {accountEmail && onSignOut && (
            <div className="studio-account">
              <span>{accountEmail}</span>
              <button type="button" onClick={onSignOut}>
                Déconnexion
              </button>
            </div>
          )}
          <span className="status-pill">
            {appView === "settings" ? "Réglages" : appView === "calendar" ? "Planification" : appView === "posts"
              ? postPagesLoading || postFoldersLoading || postsLoading
                ? "Synchronisation…"
                : postPageError || postFolderError || postError
                  ? "Posts indisponibles"
                  : "Posts synchronisés"
              : appView === "gallery"
                ? galleryError
                  ? "Galerie indisponible"
                  : galleryLoading || galleryUploading
                  ? "Synchronisation…"
                  : "Galerie synchronisée"
                : !ready
                  ? "Ouverture…"
                  : postPageSaveStatus === "saving"
                    ? "Enregistrement…"
                    : postPageSaveStatus === "error"
                      ? "Erreur d’enregistrement"
                      : "Page enregistrée"}
          </span>
          {appView === "studio" && ready && (
            <button
              className="export-button"
              type="button"
              onClick={exportPng}
              disabled={exporting}
            >
              {exporting ? "Création du PNG…" : "Exporter en PNG"}
            </button>
          )}
        </div>
      </header>

      {appView === "settings" ? (
        <StudioSettings />
      ) : appView === "calendar" ? (
        <PublicationCalendar posts={posts} postPages={postPages} folders={postFolders} galleryAssets={backgroundGalleryAssets} loading={postPagesLoading || postsLoading || postFoldersLoading} />
      ) : appView === "posts" ? (
        <PostManager
          viewStateRef={postsViewStateRef}
          posts={posts}
          postPages={postPages}
          folders={postFolders}

          galleryAssets={backgroundGalleryAssets}
          loading={
            postPagesLoading ||

            postFoldersLoading ||
            postsLoading
          }
          errorMessage={postPageError || postFolderError || postError}
          onCreatePost={handleCreatePost}
          onAddPage={handleAddPostPage}
          onCreateFolder={handleCreatePostFolder}
          onOpenPage={openPostPage}
          onEditPost={(post) => {
            const firstPageId = post.pageIds.find((pageId) =>
              postPages.some((postPage) => postPage.id === pageId),
            );
            if (firstPageId) openPostPage(firstPageId, post.id);
          }}
          onDuplicatePost={handleDuplicatePost}
          onReorderPosts={saveFolderPostOrder}
          onDuplicateFolder={(folder) => duplicatePostFolder(folder, posts)}
          onDeletePost={handleDeletePost}
          onReorderPages={handleReorderPostPages}
          onTransferPage={transferPostPage}
          onDeleteFolder={handleDeletePostFolder}
          onMovePost={handleMovePost}
          onRenameFolder={handleRenamePostFolder}
        />
      ) : appView === "gallery" ? (
        <GalleryManager
          assets={galleryAssets}
          loading={galleryLoading}
          uploading={galleryUploading}
          errorMessage={galleryError}
          onUpload={handleUploadGalleryFiles}
          onDelete={handleDeleteGalleryAsset}
          onMove={async (asset, folderId) => {
            await moveGalleryAsset(asset, folderId);
            setGalleryAssets((current) => current.map((item) =>
              item.id === asset.id ? { ...item, folderId } : item,
            ));
          }}
        />
      ) : selectedPostPage && ready ? (
        <div className="studio-workspace">
        <aside className="control-panel" aria-label="Réglages de la publicité">
          <div className="page-editor-context">
            <button type="button" onClick={() => navigateToView("posts")}>
              <Icon name="chevron_left" />
              <span>Retour</span>
            </button>
          </div>
          {(postError || postPageError) && <p className="post-system-error" role="alert">{postError || postPageError}</p>}
          {editingPost && <PostPagesPanel
            pages={editingPostPages} activeId={selectedPostPageId} language={messageLanguage}
            editorRef={messageEditorRef} assets={backgroundGalleryAssets}
            onLanguageChange={async (language) => { await messageEditorRef.current?.flush(); setMessageLanguage(language); }}
            onSelect={activateGalleryPage}
            onPreview={(translations) => setMessagePreview({id: selectedPostPageId, translations})}
            onAdd={async () => { await messageEditorRef.current?.flush(); await handleAddPostPage(editingPost); }}
            onReorder={(ids) => handleReorderPostPages(editingPost, ids)}
            onDelete={deleteGalleryEditorPage}
            onSwap={async (first, second) => { await messageEditorRef.current?.flush(); await swapPageMessages(editingPost.id, first, second); setMessagePreview(null); }}
            onError={setPostError}
          />}

          <section>
            <SectionHeading className="compact">
              <div>
                <h2>Format</h2>
              </div>
            </SectionHeading>
            <div
              className="format-options"
              role="group"
              aria-label="Format de publication"
            >
              {(Object.keys(FORMAT_CONFIG) as AdFormat[]).map(
                (formatOption) => {
                  const selected = format === formatOption;
                  return (
                    <button
                      key={formatOption}
                      className={`format-choice ${selected ? "selected" : ""}`}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setPendingFormat(formatOption === format ? null : formatOption);
                      }}
                    >
                      <span
                        className={`format-ratio format-${formatOption}`}
                        aria-hidden="true"
                      />
                      <span>
                        <strong>{FORMAT_CONFIG[formatOption].label}</strong>
                        <small>{FORMAT_CONFIG[formatOption].dimensions}</small>
                      </span>
                    </button>
                  );
                },
              )}
            </div>
            {pendingFormat && <FormatChangeDialog
              from={FORMAT_CONFIG[format].label}
              to={FORMAT_CONFIG[pendingFormat].label}
              onCancel={() => setPendingFormat(null)}
              onChoose={(anchor) => {
                setProperties((current) => changeImageFormat(current, format, pendingFormat, anchor));
                setFormat(pendingFormat);
                setPendingFormat(null);
              }}
            />}
          </section>

          <section className="instagram-guides-controls">
            <label className="field-label" htmlFor="instagram-preview-phone">Téléphone</label>
            <Dropdown id="instagram-preview-phone" value={previewPhone} onChange={(event) => setPreviewPhone(event.target.value as PreviewPhone)}>
              {Object.entries(PREVIEW_PHONES).map(([id, device]) => <option key={id} value={id}>{device.label}</option>)}
            </Dropdown>
            <label className="toggle-row">
              <strong>Afficher les repères</strong>
              <input type="checkbox" checked={showInstagramGuides} onChange={(event) => setShowInstagramGuides(event.target.checked)} />
            </label>
              <label className="toggle-row">
                <strong>Afficher le bouton</strong>
                <input type="checkbox" checked={showInstagramAdButton} onChange={(event) => setShowInstagramAdButton(event.target.checked)} />
              </label>
          </section>

          <section>
            <SectionHeading className="compact">
              <div>
                <h2>Thème</h2>
              </div>
            </SectionHeading>
            <div className="theme-groups">
              {THEME_GROUPS.map((group) => {
                const expanded = openThemeGroups.has(group.id);
                return (
                  <div
                    key={group.id}
                    className={`theme-group ${expanded ? "open" : ""}`}
                  >
                    <button
                      className="theme-group-toggle"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() =>
                        setOpenThemeGroups((current) => {
                          const next = new Set(current);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        })
                      }
                    >
                    <strong>{group.label}</strong>
                    <small>{group.themes.length} thèmes</small>
                    </button>
                    {expanded && <div className="theme-grid">
                    {group.themes.map((themeOption) => {
                      const selected = theme === themeOption.id;
                      const paletteColors = getThemePaletteColors(themeOption.id);
                      return (
                        <button
                          key={themeOption.id}
                          className={`theme-choice theme-${themeOption.id} ${selected ? "selected" : ""}`}
                          style={getThemeStyle(themeOption.id)}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => selectTheme(themeOption.id)}
                        >
                          <span className="theme-palette" aria-hidden="true">
                            {paletteColors.map((color, index) => (
                              <i
                                key={`${themeOption.id}-${index}`}
                                style={{ background: color }}
                              />
                            ))}
                          </span>
                          <strong>{themeOption.label}</strong>
                          {selected && <b>✓</b>}
                        </button>
                      );
                    })}
                    </div>}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <SectionHeading className="compact">
              <div>
                <h2>Fond</h2>
              </div>
            </SectionHeading>
            <div
              className={`background-groups theme-${theme}`}
              style={selectedThemeStyle}
            >
              <div className="background-group">
                <h3>Fonds avec thème</h3>
                <div className="background-grid">
                  {THEMEABLE_BACKGROUNDS.map((backgroundOption) => {
                    const selected =
                      !selectedBackgroundAsset &&
                      background === backgroundOption.id;
                    return (
                      <button
                        key={backgroundOption.id}
                        className={`background-choice ${selected ? "selected" : ""}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          selectThemeableBackground(backgroundOption.id)
                        }
                      >
                        <span
                          className={`background-swatch ${backgroundOption.id}`}
                          aria-hidden="true"
                        >
                          <ThemeableBackgroundArtwork
                            background={backgroundOption.id}
                          />
                        </span>
                        <strong>{backgroundOption.label}</strong>
                        {selected && <b>✓</b>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="background-group">
                <h3>Fond sans thème</h3>
                <GalleryImagePicker
                  label="Image"
                  assets={backgroundGalleryAssets}
                  selectedAsset={selectedBackgroundAsset}
                  emptyLabel="Aucun fond sélectionné"
                  loading={galleryLoading}
                  fit="cover"
                  onSelect={selectBackgroundImage}
                  onRemove={removeBackgroundImage}
                  onOpenGallery={() => navigateToView("gallery")}
                />
              </div>
            </div>
          </section>

        </aside>

        <section className="preview-zone" aria-label="Aperçu de la publicité">
          <div className="preview-toolbar">
            <div className="preview-toolbar-copy">
              <strong>Aperçu</strong>
              <span>{FORMAT_CONFIG[format].destination} · {FORMAT_CONFIG[format].dimensions}</span>
              {exportError && (
                <span className="preview-export-error" role="alert">
                  {exportError}
                </span>
              )}
            </div>
            <div
              className="preview-zoom-control"
              role="group"
              aria-label="Zoom de l’aperçu"
            >
              <button
                type="button"
                disabled={previewZoom === PREVIEW_ZOOM_MIN}
                onClick={() =>
                  setPreviewZoom((current) =>
                    clamp(
                      current - PREVIEW_ZOOM_STEP,
                      PREVIEW_ZOOM_MIN,
                      PREVIEW_ZOOM_MAX,
                    ),
                  )
                }
                aria-label="Réduire le zoom"
              >
                −
              </button>
              <output>{previewZoom}%</output>
              <button
                type="button"
                disabled={previewZoom === PREVIEW_ZOOM_MAX}
                onClick={() =>
                  setPreviewZoom((current) =>
                    clamp(
                      current + PREVIEW_ZOOM_STEP,
                      PREVIEW_ZOOM_MIN,
                      PREVIEW_ZOOM_MAX,
                    ),
                  )
                }
                aria-label="Augmenter le zoom"
              >
                +
              </button>
            </div>
          </div>

          <div
            className={`canvas-stage ${editingPost ? "gallery-editor-stage" : ""}`}
          >
            {editingPost ? (
              <>
                {editingPostPages.map(renderGalleryEditorPage)}
                <button
                  type="button"
                  className="gallery-editor-add-page"
                  disabled={addingEditorPage}
                  onClick={() => {
                    if (addingEditorPage) return;
                    setAddingEditorPage(true);
                    void handleAddPostPage(editingPost)
                      .catch(() => undefined)
                      .finally(() => setAddingEditorPage(false));
                  }}
                >
                  {addingEditorPage ? "Ajout…" : "+ Ajouter une page"}
                </button>
              </>
            ) : (
              <div className="single-editor-page">{renderActiveCanvas()}</div>
            )}
          </div>
        </section>

        <aside
          className="property-panel"
          aria-label="Propriétés de la création"
        >
          <div className="property-panel-heading">
            <h2>Propriétés</h2>
          </div>

          <section className="property-section background-color-section">
            <SectionHeading className="compact">
              <div>
                <h2>Fond</h2>
              </div>
            </SectionHeading>

            <ThemeColorControls
              colors={themePaletteColors}
              targets={backgroundColorTargets}
              activeTarget={selectedBackgroundColorTarget}
              onSelectTarget={setSelectedBackgroundColorTarget}
              onSelectColor={selectBackgroundColor}
              note={
                customBackgroundUrl
                  ? "Ces couleurs seront visibles lorsque le fond image sera retiré."
                  : undefined
              }
            />

            <label className="property-control" htmlFor="background-position-y">
              <strong>Position verticale</strong>
              <output htmlFor="background-position-y">
                {backgroundPositionY > 0 ? "+" : ""}
                {backgroundPositionY}
              </output>
              <input
                id="background-position-y"
                type="range"
                min={BACKGROUND_POSITION_Y_MIN}
                max={BACKGROUND_POSITION_Y_MAX}
                step="1"
                value={backgroundPositionY}
                disabled={!customBackgroundUrl}
                onChange={(event) =>
                  updatePostPageProperty(
                    "backgroundPositionY",
                    Number(event.target.value),
                  )
                }
              />
            </label>
          </section>

          <section className="property-section">
            <SectionHeading className="compact">
              <div>
                <h2>Texte</h2>
              </div>
            </SectionHeading>

            <ThemeColorControls
              colors={themePaletteColors}
              targets={textColorTargets}
              activeTarget={selectedTextColorTarget}
              onSelectTarget={setSelectedTextColorTarget}
              onSelectColor={selectTextColor}
              onSelectTone={selectTextTone}
            />

            <div className="text-position-control">
              <strong>Position</strong>
              <div
                className="text-position-grid"
                role="group"
                aria-label="Position du texte"
              >
                {TEXT_POSITIONS.map((positionOption) => {
                  const selected = textPosition === positionOption.id;
                  return (
                    <button
                      key={positionOption.id}
                      type="button"
                      className={selected ? "selected" : ""}
                      aria-label={positionOption.label}
                      aria-pressed={selected}
                      title={positionOption.label}
                      onClick={() =>
                        updatePostPageProperty(
                          "textPosition",
                          positionOption.id,
                        )
                      }
                    >
                      <span aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="property-control" htmlFor="text-width">
              <strong>Largeur</strong>
              <output htmlFor="text-width">{textWidth}%</output>
              <input
                id="text-width"
                type="range"
                min="30"
                max="100"
                step="1"
                value={textWidth}
                onChange={(event) =>
                  updatePostPageProperty(
                    "textWidth",
                    Number(event.target.value),
                  )
                }
              />
            </label>

            <label
              className="property-control"
              htmlFor="text-margin-horizontal"
            >
              <strong>Marge horizontale</strong>
              <output htmlFor="text-margin-horizontal">
                {textMarginHorizontal}%
              </output>
              <input
                id="text-margin-horizontal"
                type="range"
                min="0"
                max="20"
                step="1"
                value={textMarginHorizontal}
                onChange={(event) =>
                  updatePostPageProperty(
                    "textMarginHorizontal",
                    Number(event.target.value),
                  )
                }
              />
            </label>

            <label
              className="property-control"
              htmlFor="text-margin-vertical"
            >
              <strong>Marge verticale</strong>
              <output htmlFor="text-margin-vertical">
                {textMarginVertical}%
              </output>
              <input
                id="text-margin-vertical"
                type="range"
                min="0"
                max="20"
                step="1"
                value={textMarginVertical}
                onChange={(event) =>
                  updatePostPageProperty(
                    "textMarginVertical",
                    Number(event.target.value),
                  )
                }
              />
            </label>

            <label className="property-control" htmlFor="text-rotation">
              <strong>Rotation</strong>
              <output htmlFor="text-rotation">
                {textRotation > 0 ? "+" : ""}
                {textRotation}°
              </output>
              <input
                id="text-rotation"
                type="range"
                min="-20"
                max="20"
                step="1"
                value={textRotation}
                onChange={(event) =>
                  updatePostPageProperty(
                    "textRotation",
                    Number(event.target.value),
                  )
                }
              />
            </label>

            <label className="toggle-row">
              <strong>Afficher la pilule</strong>
              <input
                type="checkbox"
                checked={showAssistantLabel}
                onChange={(event) =>
                  updatePostPageProperty(
                    "showAssistantLabel",
                    event.target.checked,
                  )
                }
              />
            </label>

            <div className="text-backdrop-control">
              <label className="field-label" htmlFor="text-backdrop">
                Fond du texte
              </label>
              <Dropdown
                id="text-backdrop"
                value={textBackdrop}
                onChange={(event) =>
                  updatePostPageProperty(
                    "textBackdrop",
                    event.target.value as TextBackdrop,
                  )
                }
              >
                <option value="none">Aucun</option>
                <option value="gradient-light">Dégradé blanc</option>
                <option value="gradient-dark">Dégradé noir</option>
                <option value="band-light">Bandeau blanc</option>
                <option value="band-theme">Bandeau thème</option>
                <option value="band-dark">Bandeau noir</option>
                <option value="card">Rectangle beige arrondi</option>
                <option value="card-theme">Rectangle thème</option>
                <option value="bubble">Bubble</option>
              </Dropdown>
            </div>
            {textBackdrop === "bubble" && (
              <>
                <div className="text-backdrop-control">
                  <label className="field-label" htmlFor="text-bubble-target">Appliquer la bulle à</label>
                  <Dropdown
                    id="text-bubble-target"
                    value={properties.textBubbleTarget ?? "both"}
                    onChange={(event) => updatePostPageProperty("textBubbleTarget", event.target.value as TextBubbleTarget)}
                  >
                    <option value="both">Titre et description</option>
                    <option value="title">Titre uniquement</option>
                    <option value="description">Description uniquement</option>
                  </Dropdown>
                </div>
                <div className="text-backdrop-control">
                  <label className="field-label" htmlFor="text-bubble-tail">Pointe</label>
                  <Dropdown
                    id="text-bubble-tail"
                    value={properties.textBubbleTail ?? "none"}
                    onChange={(event) => updatePostPageProperty("textBubbleTail", event.target.value as TextBubbleTail)}
                  >
                    <option value="none">Aucune</option>
                    <option value="left">Bas gauche</option>
                    <option value="center">Bas centre</option>
                    <option value="right">Bas droite</option>
                  </Dropdown>
                </div>
              </>
            )}
          </section>

          <StoreButtonsControls value={properties.storeButtons} assets={galleryAssets} loading={galleryLoading}
            onChange={(value) => updatePostPageProperty("storeButtons", value)} />

          <section className="property-section image-property-section">
            <SectionHeading className="compact section-heading-with-action">
              <div>
                <h2>Image</h2>
              </div>
              <button
                className="section-add-button"
                type="button"
                onClick={addImage}
                aria-label="Ajouter une image"
                title="Ajouter une image"
              >
                +
              </button>
            </SectionHeading>

            {images.length === 0 ? (
              <p className="image-property-empty">
                Ajoutez une image pour composer cette création.
              </p>
            ) : (
              <div className="image-property-list">
                {images.map((image, index) => {
                  const fieldPrefix = `image-${image.id}`;

                  return (
                    <div className="image-property-card" key={image.id}>
                      <div className="image-property-card-header">
                        <strong>Image {index + 1}</strong>
                        <button
                          className="image-property-delete"
                          type="button"
                          onClick={() => removeImage(image.id)}
                          aria-label={`Supprimer l’image ${index + 1}`}
                          title="Supprimer l’image"
                        >
                          <Icon name="delete" />
                        </button>
                      </div>

                      <label className="toggle-row image-multilingual-toggle">
                        <strong>Multilingue</strong>
                        <input type="checkbox" checked={image.multilingual ?? false}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            updateImage(image.id, (current) => setImageMultilingual(current, enabled, messageLanguage));
                          }}
                        />
                      </label>
                      <div className={image.multilingual ? "image-language-slots" : "image-single-slot"}>
                        {(image.multilingual ? MESSAGE_LANGUAGES : [null]).map((language) => {
                          const assetId = language ? image.localizedAssetIds?.[language.id] : image.assetId;
                          return (
                            <div className={`image-language-slot ${language?.id === messageLanguage ? "active-language" : ""}`} key={`${selectedPostPage.id}-${image.id}-${language?.id ?? "shared"}`}>
                              <GalleryImagePicker
                                label={language?.shortLabel ?? "Visuel"}
                                assets={imageGalleryAssets}
                                selectedAsset={imageGalleryAssets.find((asset) => asset.id === assetId) ?? null}
                                emptyLabel={language ? "+" : "Aucune image sélectionnée"}
                                loading={galleryLoading}
                                fit="contain"
                                onSelect={(asset) => updateImage(image.id, (current) => language
                                  ? { ...current, localizedAssetIds: { ...current.localizedAssetIds, [language.id]: asset.id } }
                                  : { ...current, assetId: asset.id })}
                                onRemove={() => updateImage(image.id, (current) => language
                                  ? { ...current, localizedAssetIds: { ...current.localizedAssetIds, [language.id]: "" } }
                                  : { ...current, assetId: "" })}
                                onUploadFile={async (file) => {
                                  const [asset] = await uploadGalleryFiles([file]);
                                  setGalleryAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
                                  return asset;
                                }}
                                onOpenGallery={() => navigateToView("gallery")}
                              />
                            </div>
                          );
                        })}
                      </div>
                      {image.multilingual && <p className="image-language-note">Une image par langue. L’aperçu et le PNG suivent la langue sélectionnée.</p>}

                      <label className="toggle-row image-frame-toggle">
                        <strong>Frame de téléphone</strong>
                        <input
                          type="checkbox"
                          checked={image.frame}
                          onChange={(event) =>
                            updateImage(image.id, (current) => ({
                              ...current,
                              frame: event.target.checked,
                            }))
                          }
                        />
                      </label>

                      <label className="toggle-row image-layer-toggle">
                        <strong>Mettre au premier plan</strong>
                        <input
                          type="checkbox"
                          checked={image.aboveText}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            updatePageLayout((current) => ({
                              ...current,
                              images: setImageForeground(current.images, image.id, enabled),
                            }));
                          }}
                        />
                      </label>

                      <label
                        className="property-control"
                        htmlFor={`${fieldPrefix}-x`}
                      >
                        <strong>Position X</strong>
                        <output htmlFor={`${fieldPrefix}-x`}>
                          {image.x > 0 ? "+" : ""}
                          {image.x}%
                        </output>
                        <input
                          id={`${fieldPrefix}-x`}
                          type="range"
                          min="-150"
                          max="150"
                          step="1"
                          value={image.x}
                          onChange={(event) =>
                            updateImage(image.id, (current) => ({
                              ...current,
                              x: Number(event.target.value),
                            }))
                          }
                        />
                      </label>

                      <label
                        className="property-control"
                        htmlFor={`${fieldPrefix}-y`}
                      >
                        <strong>Position Y</strong>
                        <output htmlFor={`${fieldPrefix}-y`}>
                          {image.y > 0 ? "+" : ""}
                          {Math.round(image.y * 100) / 100}%
                        </output>
                        <input
                          id={`${fieldPrefix}-y`}
                          type="range"
                          min="-150"
                          max="150"
                          step="1"
                          value={image.y}
                          onChange={(event) =>
                            updateImage(image.id, (current) => ({
                              ...current,
                              y: Number(event.target.value),
                            }))
                          }
                        />
                      </label>

                      <label
                        className="property-control"
                        htmlFor={`${fieldPrefix}-scale`}
                      >
                        <strong>Taille</strong>
                        <output htmlFor={`${fieldPrefix}-scale`}>
                          {image.scale}%
                        </output>
                        <input
                          id={`${fieldPrefix}-scale`}
                          type="range"
                          min="25"
                          max="250"
                          step="1"
                          value={image.scale}
                          onChange={(event) =>
                            updateImage(image.id, (current) => ({
                              ...current,
                              scale: Number(event.target.value),
                            }))
                          }
                        />
                      </label>

                      <label
                        className="property-control"
                        htmlFor={`${fieldPrefix}-rotation`}
                      >
                        <strong>Rotation</strong>
                        <output htmlFor={`${fieldPrefix}-rotation`}>
                          {image.rotation > 0 ? "+" : ""}
                          {image.rotation}°
                        </output>
                        <input
                          id={`${fieldPrefix}-rotation`}
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={image.rotation}
                          onChange={(event) =>
                            updateImage(image.id, (current) => ({
                              ...current,
                              rotation: Number(event.target.value),
                            }))
                          }
                        />
                      </label>

                      <label
                        className="property-control"
                        htmlFor={`${fieldPrefix}-shadow-strength`}
                      >
                        <strong>Intensité de l’ombre</strong>
                        <output htmlFor={`${fieldPrefix}-shadow-strength`}>
                          {image.shadowStrength}%
                        </output>
                        <input
                          id={`${fieldPrefix}-shadow-strength`}
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={image.shadowStrength}
                          onChange={(event) =>
                            updateImage(image.id, (current) => ({
                              ...current,
                              shadowStrength: Number(event.target.value),
                            }))
                          }
                        />
                      </label>

                      <label
                        className="property-control"
                        htmlFor={`${fieldPrefix}-shadow-distance`}
                      >
                        <strong>Élévation de l’ombre</strong>
                        <output htmlFor={`${fieldPrefix}-shadow-distance`}>
                          {image.shadowDistance}px
                        </output>
                        <input
                          id={`${fieldPrefix}-shadow-distance`}
                          type="range"
                          min="0"
                          max="80"
                          step="1"
                          value={image.shadowDistance}
                          onChange={(event) =>
                            updateImage(image.id, (current) => ({
                              ...current,
                              shadowDistance: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
        </div>
      ) : (
        <div className="post-empty-state post-opening-state">
          Ouverture de la création…
        </div>
      )}
    </main>
  );
}
