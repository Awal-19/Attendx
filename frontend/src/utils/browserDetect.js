export const isInAppBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  return /FBAN|FBAV|Instagram|WhatsApp|BytedanceWebview|TikTok|musical_ly|Line\/|Snapchat/i.test(
    ua
  );
};

export const getOrCreateDeviceId = () => {
  const key = 'attendx_device_id';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `dev-ephemeral-${Date.now()}`;
  }
};

