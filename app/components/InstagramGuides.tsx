import { Icon } from "./Icon";

// Decorative interface mockup, not actual controls or exact device coordinates.
// The 390-wide reference scales as a whole with the editor preview.
const interfacePaths = [
  "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  "M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.3-5a9 9 0 1 1 16.7-4.5Z",
  "M4 8h15l-4-4m5 12H5l4 4M4 8v5m16 3v-5",
  "m22 2-7 20-4-9L2 9 22 2ZM11 13 22 2",
  "M5 3h14v19l-7-5-7 5V3Z",
];

/** Sibling of the canvas export root: cannot enter image exports. */
export function InstagramGuides({ showAdButton }: { showAdButton: boolean }) {
  return <div aria-hidden="true" className="instagram-guides-overlay">
    <div className="instagram-guide-actions">
      {interfacePaths.map((path, index) => <svg key={index} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>)}
    </div>
    <div className="instagram-guide-footer">
      {showAdButton && <div className="instagram-guide-ad-button"><span>Voir le profil Instagram</span><Icon name="chevron_right" /></div>}
      <div className="instagram-guide-identity">
        <span className="instagram-guide-avatar" />
        <strong>nom_du_compte</strong>
        <span className="instagram-guide-follow">Suivre</span>
      </div>
      <div className="instagram-guide-description"><span /><span /><span /></div>
      <span className="instagram-guide-sponsored">Sponsorisé</span>
    </div>
  </div>;
}
