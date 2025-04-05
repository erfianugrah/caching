import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { assetTypeApi } from "../../lib/api-client";
import type { AssetTypeData } from "../../lib/api-types";

// Define our schema with Zod
export const assetTypeSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  pattern: z.string().min(3, {
    message: "Pattern must be at least 3 characters.",
  }),
  useQueryInCacheKey: z.boolean().default(true),
  minification: z.boolean().optional(),
  optimization: z.boolean().optional(),
  ttl: z.object({
    ok: z.number().int().min(0),
    redirects: z.number().int().min(0),
    clientError: z.number().int().min(0),
    serverError: z.number().int().min(0),
  }),
  queryParams: z.object({
    include: z.boolean().default(true),
    excluded: z.array(z.string()).optional(),
    sortParams: z.boolean().optional(),
    normalizeValues: z.boolean().optional(),
  }).optional(),
  cacheDirectives: z.object({
    private: z.boolean().optional(),
    staleWhileRevalidate: z.number().int().min(0).optional(),
    staleIfError: z.number().int().min(0).optional(),
    mustRevalidate: z.boolean().optional(),
    noCache: z.boolean().optional(),
    noStore: z.boolean().optional(),
    immutable: z.boolean().optional(),
  }).optional(),
});

export type AssetTypeFormData = z.infer<typeof assetTypeSchema>;

interface AssetTypeFormProps {
  id?: string;
  defaultValues?: AssetTypeData;
  isNew?: boolean;
}

export default function AssetTypeForm({ 
  id, 
  defaultValues,
  isNew = true
}: AssetTypeFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const form = useForm<AssetTypeFormData>({
    resolver: zodResolver(assetTypeSchema),
    defaultValues: defaultValues || {
      name: "",
      pattern: "",
      useQueryInCacheKey: true,
      ttl: {
        ok: 3600,
        redirects: 30,
        clientError: 10,
        serverError: 0,
      },
      queryParams: {
        include: true,
        sortParams: false,
        normalizeValues: false,
      },
    },
  });
  
  const onSubmit = async (data: AssetTypeFormData) => {
    setLoading(true);
    setError(null);
    
    try {
      let response;
      
      if (isNew) {
        response = await assetTypeApi.create(data as any);
      } else if (id) {
        response = await assetTypeApi.update(id, data as any);
      } else {
        throw new Error("Missing ID for update operation");
      }
      
      if (response.success) {
        // Redirect to list page
        window.location.href = "/asset-types";
      } else {
        setError(response.error || "An error occurred while saving");
      }
    } catch (err) {
      console.error("Error saving asset type:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const onCancel = () => {
    window.location.href = "/asset-types";
  };

  // Function to format time units more readable
  const formatTimeUnit = (seconds: number): string => {
    if (seconds === 0) return "0 (No caching)";
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${seconds / 60} minutes`;
    if (seconds < 86400) return `${seconds / 3600} hours`;
    if (seconds < 31536000) return `${seconds / 86400} days`;
    return `${seconds / 31536000} years`;
  };

  // Demo pattern tester
  const [testUrl, setTestUrl] = React.useState("");
  const [patternMatch, setPatternMatch] = React.useState<boolean | null>(null);

  const testPattern = () => {
    try {
      const pattern = form.getValues("pattern");
      if (!pattern || !testUrl) {
        setPatternMatch(null);
        return;
      }

      // Convert string to RegExp
      const regex = new RegExp(pattern);
      setPatternMatch(regex.test(testUrl));
    } catch (error) {
      setPatternMatch(null);
      console.error("Invalid regex pattern", error);
    }
  };

  return (
    <Form {...form}>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="caching">Caching</TabsTrigger>
            <TabsTrigger value="queryParams">Query Parameters</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          
          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Type Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., image" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this asset type.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="pattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Pattern (Regex)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., .*\.(jpg|jpeg|png)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Regular expression to match URL patterns.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Pattern Tester</CardTitle>
                <CardDescription>Test your pattern against sample URLs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="test-url">Test URL</Label>
                    <Input 
                      id="test-url" 
                      placeholder="https://example.com/images/photo.jpg" 
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="button"
                    onClick={testPattern}
                    disabled={!testUrl || !form.getValues("pattern")}
                  >
                    Test Pattern
                  </Button>
                </div>
                
                {patternMatch !== null && (
                  <div className={`mt-4 p-3 rounded-md ${patternMatch ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {patternMatch 
                      ? "✓ URL matches this pattern!" 
                      : "✗ URL does not match this pattern"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Caching Tab */}
          <TabsContent value="caching" className="space-y-6 mt-4">
            <div>
              <h3 className="text-lg font-medium mb-4">Time To Live (TTL) Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="ttl.ok"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TTL for Success (200-299)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        {formatTimeUnit(field.value)} for successful responses.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="ttl.redirects"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TTL for Redirects (300-399)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        {formatTimeUnit(field.value)} for redirect responses.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="ttl.clientError"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TTL for Client Errors (400-499)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        {formatTimeUnit(field.value)} for client error responses.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="ttl.serverError"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TTL for Server Errors (500-599)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        {formatTimeUnit(field.value)} for server error responses.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="minifyCss"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Minify CSS</FormLabel>
                      <FormDescription>
                        Minify CSS files to reduce size.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="imageOptimization"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Image Optimization</FormLabel>
                      <FormDescription>
                        Enable Cloudflare Polish for images.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>
          
          {/* Query Parameters Tab */}
          <TabsContent value="queryParams" className="space-y-6 mt-4">
            <FormField
              control={form.control}
              name="useQueryInCacheKey"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Include Query Parameters in Cache Key</FormLabel>
                    <FormDescription>
                      Use query parameters when generating cache keys.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            {form.watch("useQueryInCacheKey") && (
              <>
                <FormField
                  control={form.control}
                  name="queryParams.include"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Include Query Parameters</FormLabel>
                        <FormDescription>
                          Include query parameters in cache key (if disabled, all params are excluded).
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                {form.watch("queryParams.include") && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="queryParams.sortParams"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Sort Parameters</FormLabel>
                              <FormDescription>
                                Sort query parameters alphabetically.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="queryParams.normalizeValues"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Normalize Values</FormLabel>
                              <FormDescription>
                                Normalize query parameter values (e.g., lowercase).
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="queryParams.includeParams"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Include Specific Parameters</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="One parameter per line, e.g:
width
height
quality"
                              className="min-h-[100px]"
                              value={field.value?.join('\n') || ''}
                              onChange={(e) => {
                                const params = e.target.value.split('\n').filter(p => p.trim() !== '');
                                field.onChange(params.length > 0 ? params : undefined);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            List specific query parameters to include (leave empty to include all).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="queryParams.excludeParams"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exclude Specific Parameters</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="One parameter per line, e.g:
token
timestamp
auth"
                              className="min-h-[100px]"
                              value={field.value?.join('\n') || ''}
                              onChange={(e) => {
                                const params = e.target.value.split('\n').filter(p => p.trim() !== '');
                                field.onChange(params.length > 0 ? params : undefined);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            List specific query parameters to exclude.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </>
            )}
          </TabsContent>
          
          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6 mt-4">
            <h3 className="text-lg font-medium mb-4">Cache Directives</h3>
            
            <FormField
              control={form.control}
              name="cacheDirectives.private"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Private Cache</FormLabel>
                    <FormDescription>
                      Mark content as private (not cacheable by shared caches).
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="cacheDirectives.staleWhileRevalidate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stale-While-Revalidate</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        {...field} 
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Seconds to serve stale content while revalidating.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="cacheDirectives.staleIfError"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stale-If-Error</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        {...field} 
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Seconds to serve stale content on errors.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="cacheDirectives.mustRevalidate"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Must-Revalidate</FormLabel>
                      <FormDescription>
                        Cache must revalidate stale entries before use.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="cacheDirectives.immutable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Immutable</FormLabel>
                      <FormDescription>
                        Asset will not change during its TTL period.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="cacheDirectives.noCache"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">No-Cache</FormLabel>
                      <FormDescription>
                        Force revalidation before using cached content.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="cacheDirectives.noStore"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">No-Store</FormLabel>
                      <FormDescription>
                        Response should not be stored in any cache.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end space-x-4">
          <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>Save Asset Type</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}