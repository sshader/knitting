import { useEffect, useState } from "react";

const QUERY = "(max-width: 720px)";

/** Whether the window is phone-sized: then the workspace shows one panel at a time. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => matchMedia(QUERY).matches);
  useEffect(() => {
    const media = matchMedia(QUERY);
    const update = () => setPhone(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return phone;
}
