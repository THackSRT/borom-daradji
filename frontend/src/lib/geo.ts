/** Position du téléphone, si l'utilisateur l'autorise (sinon null : la saisie part sans coordonnées). */
export function currentPosition(timeout = 5000): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: Number(p.coords.latitude.toFixed(7)), longitude: Number(p.coords.longitude.toFixed(7)) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60_000 },
    );
  });
}
