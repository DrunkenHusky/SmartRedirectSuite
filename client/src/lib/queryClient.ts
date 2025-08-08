import { QueryClient, QueryFunction } from "@tanstack/react-query";

const isDev = import.meta.env.DEV;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle authentication errors globally, but NOT for login endpoint
    if ((res.status === 401 || res.status === 403) && !res.url.includes('/api/admin/login')) {
      if (isDev) {
        console.warn("Authentication failed, triggering page reload");
        window.location.reload();
        return;
      }
    }
    
    try {
      // Clone the response to avoid consuming the body twice
      const responseClone = res.clone();
      const errorData = await responseClone.json();
      if (isDev) {
        console.log('Parsed error response:', errorData);
      }
      
      if (errorData && typeof errorData === 'object' && errorData.error) {
        // Create a proper Error object with the message
        const error = new Error(errorData.error);
        // Add additional properties to the error for easy access
        (error as any).error = errorData.error;
        (error as any).serverError = errorData;
        (error as any).status = res.status;
        throw error;
      } else {
        // Fallback to text if no error field
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
    } catch (parseError) {
      // If this is already our custom error, re-throw it
      if (parseError instanceof Error && (parseError as any).error) {
        throw parseError;
      }
      
      if (isDev) {
        console.log('JSON parsing failed, falling back to text:', parseError);
      }
      // If JSON parsing fails, fallback to text
      try {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      } catch (textError) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const config: RequestInit = {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    credentials: "include",
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const res = await fetch(url, config);

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && (res.status === 401 || res.status === 403)) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
