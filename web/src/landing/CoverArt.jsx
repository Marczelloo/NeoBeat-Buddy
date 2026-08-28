/**
 * Real cover art for the example session. Files live in public/covers and are
 * album artwork used to illustrate the player, the way any music client shows
 * it — see web/public/covers/README.md for provenance.
 *
 * `art` keys that have no file fall back to a drawn placeholder, so the page
 * never renders a broken image.
 */

const COVERS = {
  loser: { src: "/covers/loser.jpg", label: "Tame Impala — Loser" },
  borderline: { src: "/covers/borderline.jpg", label: "Tame Impala — The Slow Rush" },
  dieforyou: { src: "/covers/dieforyou.jpg", label: "The Weeknd — Starboy" },
  rosemary: { src: "/covers/rosemary.jpg", label: "Deftones — Koi No Yokan" },
  avengers: { src: "/covers/avengers.jpg", label: "Quebonafide & Eripe — Eklektyka" },
};

export default function CoverArt({ art, title }) {
  const cover = COVERS[art];

  if (!cover) {
    return (
      <svg className="qart" viewBox="0 0 48 48" role="img" aria-label={`${title} — placeholder artwork`}>
        <rect width="48" height="48" fill="#0e1116" />
        <path d="M18 32V16l14-3v16" fill="none" stroke="#5c6675" strokeWidth="1.6" />
        <circle cx="16" cy="32" r="3" fill="#5c6675" />
        <circle cx="30" cy="29" r="3" fill="#5c6675" />
      </svg>
    );
  }

  return <img className="qart" src={cover.src} alt={`${title} — ${cover.label}`} loading="lazy" decoding="async" />;
}
