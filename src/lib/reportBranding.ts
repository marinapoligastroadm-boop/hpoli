const HPOLI_LOGO_PATH = "/hpoli-logo.png";

let cachedLogo: Promise<string | null> | null = null;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export function loadHpoliReportLogo() {
  if (!cachedLogo) {
    cachedLogo = fetch(HPOLI_LOGO_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar a logo HPOLI.");
        }
        return response.blob();
      })
      .then(blobToDataUrl)
      .catch(() => null);
  }

  return cachedLogo;
}
