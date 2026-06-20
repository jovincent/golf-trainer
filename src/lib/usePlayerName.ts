import { useEffect, useState } from "react";
import { useStore } from "../store";
import { api } from "./api";

/** Resolves the active profile's display name (for share cards). */
export function usePlayerName(): string {
  const profileId = useStore((s) => s.profileId);
  const [name, setName] = useState("Joueur");
  useEffect(() => {
    api.listProfiles()
      .then((ps) => { const p = ps.find((x) => x.id === profileId) ?? ps[0]; if (p) setName(p.name); })
      .catch(() => {});
  }, [profileId]);
  return name;
}
