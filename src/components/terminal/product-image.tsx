import Image from "next/image";

/** Warm placeholder gradients used until real product photos are uploaded via Admin. */
const GRADIENTS = [
  "from-amber-200 to-orange-300",
  "from-orange-200 to-rose-300",
  "from-yellow-200 to-amber-300",
  "from-rose-200 to-amber-200",
  "from-lime-200 to-emerald-300",
  "from-sky-200 to-indigo-200",
];

function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % GRADIENTS.length;
  return GRADIENTS[hash];
}

/** Product visual: the uploaded image, or a warm gradient placeholder with the initial. */
export function ProductImage({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        fill
        sizes="200px"
        className={`object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(name)} ${className ?? ""}`}
    >
      <span className="text-4xl font-semibold text-black/40">{name.charAt(0)}</span>
    </div>
  );
}
