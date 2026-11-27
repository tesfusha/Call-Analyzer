export function FlaticonIcon({
  name,
  className = '',
}: {
  name: string;
  className?: string;
}) {
  return (
    <i
      aria-hidden="true"
      className={`fi ${name} inline-flex items-center justify-center leading-none not-italic ${className}`}
    />
  );
}
