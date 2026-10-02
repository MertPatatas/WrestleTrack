import './news.css';

export function NewsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card">
          <div className="skeleton-line skeleton-line--badge" />
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--short" />
        </div>
      ))}
    </div>
  );
}
