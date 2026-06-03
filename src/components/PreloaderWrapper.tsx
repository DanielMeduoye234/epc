'use client';

import { useState } from 'react';
import Preloader from './Preloader';

export default function PreloaderWrapper() {
  const [showPreloader, setShowPreloader] = useState(true);

  if (!showPreloader) return null;

  return (
    <Preloader
      onFinish={() => {
        setShowPreloader(false);
      }}
    />
  );
}
