"use client";

import { useEffect, useRef, useState } from "react";

export default function Brand() {
  const [logoMissing, setLogoMissing] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // A missing image may finish loading before React attaches onError.
    const logo = logoRef.current;
    if (logo?.complete && logo.naturalWidth === 0) setLogoMissing(true);
  }, []);

  return (
    <a className="brand" href="/" aria-label="LOUDR Media home">
      {logoMissing ? <span>LOUDR<span className="accent-text"> MEDIA</span></span> : (
        // Original logo published on loudrmedia.com.
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={logoRef} className="brand-logo" src="https://assets.cdn.filesafe.space/gktSV83MhR3ONlsXR8E1/media/67060f728b8ca46542809d05.png" alt="LOUDR Media" width="160" height="88" onError={() => setLogoMissing(true)} />
      )}
    </a>
  );
}
