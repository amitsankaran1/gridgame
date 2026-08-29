"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "This week" },
  { href: "/archive", label: "Archive" },
  { href: "/ideas", label: "Submit" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="nav">
      <Link className="wordmark" href="/">
        gridgame
      </Link>
      <nav aria-label="Sections">
        <ul className="nav-links">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={pathname === link.href ? "nav-link is-current" : "nav-link"}
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
