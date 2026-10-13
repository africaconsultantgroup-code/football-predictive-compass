// Independent services must not hold a healthy fixture inventory behind a slow
// or unavailable sibling. Empty/failed sources do not win the race.
export async function firstAvailableInventory<P,F>(premium:Promise<{predictions:readonly P[]}>,free:Promise<{predictions:readonly F[]}>) {
  try {
    return await Promise.any([
      premium.then(result=>{if(!result.predictions.length)throw new Error("empty");return {source:"premium" as const,predictions:result.predictions};}),
      free.then(result=>{if(!result.predictions.length)throw new Error("empty");return {source:"free" as const,predictions:result.predictions};}),
    ]);
  } catch { return null; }
}
