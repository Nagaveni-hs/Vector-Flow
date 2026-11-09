// Shared loading placeholder. One implementation for every page:
// a grey shimmering block, card, or row, in the site palette.
// No new dependency, plain CSS classes (see app/globals.css).
//
// Props:
//   variant: "text" (default) | "card" | "row" | "avatar"
//     - "text": a single shimmering line.
//     - "card": a media block plus two text lines, shaped like an
//       event / gallery / team card.
//     - "row": an avatar circle plus two text lines, shaped like a
//       list or table row.
//     - "avatar": a shimmering circle on its own.
//   count: how many copies of the variant to render (default 1).
//   className: extra class on the wrapper, e.g. to size a line.
export default function Skeleton({ variant = "text", count = 1, className = "" }) {
  const items = Array.from({ length: Math.max(1, count) }, (_, index) => index);

  return (
    <div className={`skeleton-wrap${className ? ` ${className}` : ""}`} aria-hidden="true">
      {items.map((index) => {
        if (variant === "card") {
          return (
            <div className="skeleton skeleton-card" key={index}>
              <span className="skeleton skeleton-card__media" />
              <span className="skeleton skeleton-text skeleton-card__title" />
              <span className="skeleton skeleton-text" />
            </div>
          );
        }
        if (variant === "row") {
          return (
            <div className="skeleton skeleton-row" key={index}>
              <span className="skeleton skeleton-avatar" />
              <span className="skeleton-row__lines">
                <span className="skeleton skeleton-text" />
                <span className="skeleton skeleton-text skeleton-text--short" />
              </span>
            </div>
          );
        }
        if (variant === "avatar") {
          return <span className="skeleton skeleton-avatar" key={index} />;
        }
        return <span className="skeleton skeleton-text" key={index} />;
      })}
    </div>
  );
}
