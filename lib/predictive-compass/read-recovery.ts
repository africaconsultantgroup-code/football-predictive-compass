// Only GET callers use this helper. Parsing and authorization remain outside it.
export async function recoverRead(operation: () => Promise<Response>) {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try { response = await operation(); }
    catch (error) {
      last = error;
      if (attempt === 0 && error instanceof Error && ["TypeError", "AbortError", "TimeoutError"].includes(error.name)) continue;
      throw error;
    }
    if (response.status >= 500 && attempt === 0) {await response.body?.cancel(); continue;}
    return response;
  }
  throw last;
}

export function logReadFailure(category: string, matchId?: string, lifecycle?: string) {
  console.warn("[customer-read]", {timestamp: new Date().toISOString(), category, ...(matchId ? {match_id: matchId} : {}), ...(lifecycle ? {lifecycle} : {})});
}

export async function boundedReadMap<T,R>(items:T[],read:(item:T)=>Promise<R>,concurrency=4):Promise<R[]> {
  const results=new Array<R>(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(next<items.length){const index=next++;results[index]=await read(items[index]);}}));
  return results;
}
