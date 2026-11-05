import Image from "next/image";

export default function BrandLogo({ className = "", priority = false }) {
  return (
    <Image
      className={`brand-logo ${className}`.trim()}
      src="/vector-flow-logo.jpeg"
      alt="Vector Flow"
      width={256}
      height={256}
      priority={priority}
    />
  );
}
