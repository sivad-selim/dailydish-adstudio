import { useId } from "react";
import type { AdBackground } from "../firebase/creations";

export function ThemeableBackgroundArtwork({
  background,
}: {
  background: AdBackground;
}) {
  const gradientId = `background-gradient-${useId().replace(/:/g, "")}`;
  const artwork = (() => {
    switch (background) {
      case "solid":
        return <></>;
      case "gradient":
        return (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--theme-bg-1)" />
                <stop offset="100%" stopColor="var(--theme-bg-2)" />
              </linearGradient>
            </defs>
            <rect width="1000" height="1600" fill={`url(#${gradientId})`} />
          </>
        );
      case "pop-waves":
        return (
          <>
            <rect width="1000" height="1600" fill="var(--theme-bg-1)" />
            <path d="M0 390C250 520 750 260 1000 420V1600H0Z" fill="var(--theme-bg-2)" />
            <path d="M0 790C250 920 750 660 1000 820V1600H0Z" fill="var(--theme-bg-3)" />
            <path d="M0 1190C250 1320 750 1060 1000 1220V1600H0Z" fill="var(--theme-bg-4)" />
          </>
        );
      case "soft-panels":
        return (
          <>
            <rect x="-110" y="-80" width="760" height="680" rx="150" fill="var(--theme-bg-1)" />
            <rect x="745" y="115" width="300" height="330" rx="92" fill="var(--theme-bg-2)" />
            <rect x="55" y="780" width="470" height="535" rx="125" fill="var(--theme-bg-3)" />
            <rect x="590" y="645" width="545" height="1035" rx="165" fill="var(--theme-bg-4)" />
          </>
        );
      case "corner-fan":
        return (
          <>
            <path d="M0 1600V0H245Z" fill="var(--theme-bg-1)" />
            <path d="M0 1600L245 0H530Z" fill="var(--theme-bg-2)" />
            <path d="M0 1600L530 0H790Z" fill="var(--theme-bg-3)" />
            <path d="M0 1600L790 0H1000V230Z" fill="var(--theme-bg-4)" />
          </>
        );
      case "zigzag":
        return (
          <>
            <path d="M0 0H1000V300L500 590L0 300Z" fill="var(--theme-bg-1)" />
            <path d="M0 300L500 590L1000 300V670L500 960L0 670Z" fill="var(--theme-bg-2)" />
            <path d="M0 670L500 960L1000 670V1040L500 1330L0 1040Z" fill="var(--theme-bg-3)" />
            <path d="M0 1040L500 1330L1000 1040V1600H0Z" fill="var(--theme-bg-4)" />
          </>
        );
      case "sunset-bands":
        return (
          <>
            <rect width="1000" height="520" fill="var(--theme-bg-1)" />
            <rect y="520" width="1000" height="500" fill="var(--theme-bg-2)" />
            <rect y="1020" width="1000" height="580" fill="var(--theme-bg-3)" />
            <circle cx="500" cy="990" r="330" fill="var(--theme-bg-4)" />
          </>
        );
      case "offset-discs":
        return (
          <>
            <circle cx="100" cy="240" r="390" fill="var(--theme-bg-1)" />
            <circle cx="690" cy="520" r="310" fill="var(--theme-bg-2)" />
            <circle cx="220" cy="1000" r="230" fill="var(--theme-bg-3)" />
            <circle cx="790" cy="1360" r="390" fill="var(--theme-bg-4)" />
          </>
        );
      case "folds":
        return (
          <>
            <path d="M0 0H1000L500 800Z" fill="var(--theme-bg-1)" />
            <path d="M1000 0V1600L500 800Z" fill="var(--theme-bg-2)" />
            <path d="M1000 1600H0L500 800Z" fill="var(--theme-bg-3)" />
            <path d="M0 1600V0L500 800Z" fill="var(--theme-bg-4)" />
          </>
        );
      case "halos":
        return (
          <>
            <circle cx="-40" cy="820" r="980" fill="var(--theme-bg-1)" />
            <circle cx="-40" cy="820" r="760" fill="var(--theme-bg-2)" />
            <circle cx="-40" cy="820" r="535" fill="var(--theme-bg-3)" />
            <circle cx="-40" cy="820" r="300" fill="var(--theme-bg-4)" />
          </>
        );
      case "flow-columns":
        return (
          <>
            <path d="M0 0H285C430 250 135 510 285 805C430 1090 150 1320 300 1600H0Z" fill="var(--theme-bg-1)" />
            <path d="M245 0H535C680 285 390 515 535 805C680 1085 395 1340 550 1600H275C125 1320 405 1090 260 805C110 510 400 250 245 0Z" fill="var(--theme-bg-2)" />
            <path d="M500 0H790C935 250 650 520 790 805C930 1090 650 1325 805 1600H525C370 1340 655 1085 510 805C365 515 655 285 500 0Z" fill="var(--theme-bg-3)" />
            <path d="M755 0H1000V1600H780C625 1325 905 1090 765 805C625 520 910 250 755 0Z" fill="var(--theme-bg-4)" />
          </>
        );
      case "cream":
        return (
          <>
            <path d="M690-80C855-38 1017 70 1065 235C1114 405 1032 535 884 510C742 486 669 377 694 249C715 140 736 52 690-80Z" fill="var(--theme-bg-1)" />
            <path d="M-102 1100C42 1017 197 1031 285 1148C383 1278 321 1465 164 1657H-102Z" fill="var(--theme-bg-2)" />
            <path d="M790 1272C914 1208 1057 1271 1092 1414V1675H742C693 1516 704 1317 790 1272Z" fill="var(--theme-bg-3)" />
          </>
        );
      case "sage":
        return (
          <>
            <rect x="80" y="82" width="172" height="172" rx="38" fill="var(--theme-bg-1)" transform="rotate(-12 166 168)" />
            <rect x="402" y="164" width="104" height="104" rx="28" fill="var(--theme-bg-3)" transform="rotate(9 454 216)" />
            <rect x="716" y="58" width="226" height="226" rx="52" fill="none" stroke="var(--theme-bg-2)" strokeWidth="24" transform="rotate(13 829 171)" />
            <rect x="778" y="468" width="130" height="130" rx="34" fill="var(--theme-bg-4)" transform="rotate(-16 843 533)" />
            <rect x="112" y="512" width="238" height="238" rx="58" fill="var(--theme-bg-2)" transform="rotate(8 231 631)" />
            <rect x="500" y="684" width="148" height="148" rx="40" fill="none" stroke="var(--theme-bg-1)" strokeWidth="22" transform="rotate(-11 574 758)" />
            <rect x="760" y="868" width="210" height="210" rx="54" fill="var(--theme-bg-3)" transform="rotate(7 865 973)" />
            <rect x="70" y="982" width="122" height="122" rx="32" fill="var(--theme-bg-4)" transform="rotate(-8 131 1043)" />
            <rect x="326" y="1118" width="192" height="192" rx="48" fill="var(--theme-bg-1)" transform="rotate(15 422 1214)" />
            <rect x="666" y="1302" width="116" height="116" rx="30" fill="var(--theme-bg-2)" transform="rotate(-13 724 1360)" />
            <rect x="842" y="1436" width="218" height="218" rx="56" fill="none" stroke="var(--theme-bg-4)" strokeWidth="26" transform="rotate(10 951 1545)" />
          </>
        );
      case "rays":
        return (
          <>
            <path d="M500 1660L-210-90H70Z" fill="var(--theme-bg-1)" />
            <path d="M500 1660L70-90H332Z" fill="var(--theme-bg-2)" />
            <path d="M500 1660L332-90H597Z" fill="var(--theme-bg-3)" />
            <path d="M500 1660L597-90H852Z" fill="var(--theme-bg-4)" />
            <path d="M500 1660L852-90H1210Z" fill="var(--theme-bg-1)" />
          </>
        );
      case "ribbons":
        return (
          <>
            <rect x="-250" y="205" width="790" height="158" rx="79" fill="var(--theme-bg-1)" transform="rotate(-13 145 284)" />
            <rect x="552" y="642" width="810" height="148" rx="74" fill="var(--theme-bg-2)" transform="rotate(17 957 716)" />
            <rect x="-216" y="1250" width="760" height="142" rx="71" fill="var(--theme-bg-3)" transform="rotate(8 164 1321)" />
            <rect x="341" y="970" width="510" height="94" rx="47" fill="var(--theme-bg-4)" transform="rotate(-22 596 1017)" />
          </>
        );
      case "bubbles":
        return (
          <>
            <circle cx="122" cy="145" r="118" fill="var(--theme-bg-1)" />
            <circle cx="822" cy="245" r="172" fill="var(--theme-bg-2)" />
            <circle cx="315" cy="625" r="86" fill="var(--theme-bg-3)" />
            <circle cx="930" cy="828" r="112" fill="var(--theme-bg-4)" />
            <circle cx="168" cy="1122" r="147" fill="var(--theme-bg-2)" />
            <circle cx="660" cy="1415" r="194" fill="var(--theme-bg-1)" />
            <circle cx="905" cy="1535" r="74" fill="var(--theme-bg-3)" />
          </>
        );
      case "mosaic":
        return (
          <>
            <rect x="86" y="115" width="350" height="250" rx="42" fill="var(--theme-bg-1)" transform="rotate(-7 261 240)" />
            <rect x="590" y="330" width="300" height="410" rx="48" fill="var(--theme-bg-2)" transform="rotate(9 740 535)" />
            <rect x="120" y="895" width="420" height="300" rx="52" fill="var(--theme-bg-3)" transform="rotate(6 330 1045)" />
            <rect x="650" y="1260" width="278" height="220" rx="42" fill="var(--theme-bg-4)" transform="rotate(-11 789 1370)" />
          </>
        );
      case "capsules":
        return (
          <>
            <rect x="-92" y="190" width="560" height="132" rx="66" fill="var(--theme-bg-1)" transform="rotate(-18 188 256)" />
            <rect x="560" y="470" width="520" height="110" rx="55" fill="var(--theme-bg-2)" transform="rotate(13 820 525)" />
            <rect x="42" y="870" width="640" height="150" rx="75" fill="var(--theme-bg-3)" transform="rotate(9 362 945)" />
            <rect x="490" y="1280" width="600" height="126" rx="63" fill="var(--theme-bg-4)" transform="rotate(-15 790 1343)" />
          </>
        );
      case "orbit":
        return (
          <g transform="translate(500 800)">
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-1)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-2)" transform="rotate(22.5)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-1)" transform="rotate(45)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-2)" transform="rotate(67.5)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-1)" transform="rotate(90)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-2)" transform="rotate(112.5)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-1)" transform="rotate(135)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-2)" transform="rotate(157.5)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-1)" transform="rotate(180)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-2)" transform="rotate(202.5)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-1)" transform="rotate(225)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-2)" transform="rotate(247.5)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-1)" transform="rotate(270)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-2)" transform="rotate(292.5)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-1)" transform="rotate(315)" />
            <path d="M 0 0 L -150 -1400 L 150 -1400 Z" fill="var(--theme-bg-2)" transform="rotate(337.5)" />
          </g>
        );
      case "petals":
        return (
          <>
            <path d="M-90 260C152 78 380 109 392 357C405 622 143 715-90 633Z" fill="var(--theme-bg-1)" />
            <path d="M694-70C959 70 1055 304 884 484C694 683 523 465 581 257C616 132 651 33 694-70Z" fill="var(--theme-bg-2)" />
            <path d="M734 1036C1016 994 1121 1216 1002 1459C916 1635 690 1653 562 1545C407 1414 492 1072 734 1036Z" fill="var(--theme-bg-3)" />
            <path d="M-72 1298C117 1142 321 1198 356 1386C378 1503 304 1588 208 1648H-72Z" fill="var(--theme-bg-4)" />
          </>
        );
      default:
        return null;
    }
  })();

  if (!artwork) return null;

  return (
    <svg
      className="background-vector"
      viewBox="0 0 1000 1600"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      <rect width="1000" height="1600" fill="var(--theme-base)" />
      {artwork}
    </svg>
  );
}
