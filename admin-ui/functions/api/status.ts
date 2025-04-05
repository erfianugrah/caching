export interface Env {
  ENVIRONMENT: string;
  CACHE_CONFIG: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env } = context;
  
  return new Response(JSON.stringify({
    success: true,
    data: {
      status: "operational",
      environment: env.ENVIRONMENT || "unknown",
      timestamp: new Date().toISOString()
    }
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache"
    }
  });
};