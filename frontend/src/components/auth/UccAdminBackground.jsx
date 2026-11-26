import React, { useEffect } from 'react';

const UccAdminBackground = ({
  overlayGradient = 'linear-gradient(135deg, rgba(127, 29, 29, 0.56) 0%, rgba(15, 23, 42, 0.58) 52%, rgba(30, 58, 138, 0.52) 100%)',
}) => {
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = isMobile ? '/images/ucc-admin-bg-mobile.webp' : '/images/ucc-admin-bg.webp';
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet="/images/ucc-admin-bg-mobile.webp"
          type="image/webp"
        />
        <source
          media="(max-width: 767px)"
          srcSet="/images/ucc-admin-bg-mobile.jpg"
          type="image/jpeg"
        />
        <source srcSet="/images/ucc-admin-bg.webp" type="image/webp" />
        <img
          src="/images/ucc-admin-bg.jpg"
          alt=""
          className="w-full h-full object-cover object-center"
          decoding="async"
          fetchPriority="high"
        />
      </picture>
      <div className="absolute inset-0" style={{ background: overlayGradient }} />
    </div>
  );
};

export default UccAdminBackground;

