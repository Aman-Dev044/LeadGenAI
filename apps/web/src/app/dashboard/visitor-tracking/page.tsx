'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Users, Eye } from 'lucide-react';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Loading } from '@/components/shared/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { formatDate } from '@/lib/utils';

export default function VisitorTrackingPage() {
  const [days, setDays] = useState('30');

  const { data: topPages, isLoading } = useQuery({
    queryKey: ['visitor-tracking', 'top-pages', days],
    queryFn: () => api.get<any>('/visitor-tracking/top-pages', { days }),
  });

  const { data: visitorCount } = useQuery({
    queryKey: ['visitor-tracking', 'count', days],
    queryFn: () => api.get<any>('/visitor-tracking/visitor-count', { days }),
  });

  if (isLoading) return <Loading />;

  const pages = (topPages as any)?.data || [];

  // Backend returns { uniqueVisitors: N } (not "count")
  const countRaw = (visitorCount as any)?.data || {};
  const uniqueVisitorCount = countRaw.uniqueVisitors ?? countRaw.count ?? 0;

  // Backend returns "views" (not "totalViews")
  const getViews = (p: any) => p.views ?? p.totalViews ?? 0;
  const getUniqueVisitors = (p: any) => p.uniqueVisitors ?? 0;
  const totalViews = pages.reduce((sum: number, p: any) => sum + getViews(p), 0);
  const maxViews = pages.length > 0 ? Math.max(...pages.map((p: any) => getViews(p))) : 1;

  return (
    <div>
      <PageHeader
        title="Visitor Tracking"
        description="Monitor website visitor activity"
        actions={
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Unique Visitors" value={uniqueVisitorCount} icon={Users} />
        <StatCard title="Total Pages Tracked" value={pages.length} icon={Globe} />
        <StatCard title="Total Page Views" value={totalViews} icon={Eye} />
      </div>

      <Card>
        <CardHeader><CardTitle>Top Pages</CardTitle></CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No page views recorded yet. Install the widget on your website to start tracking.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Unique Visitors</TableHead>
                  <TableHead className="w-[200px]">Distribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page: any) => (
                  <TableRow key={page._id}>
                    <TableCell className="font-mono text-sm max-w-xs truncate">{page._id || page.url}</TableCell>
                    <TableCell>{getViews(page)}</TableCell>
                    <TableCell>{getUniqueVisitors(page)}</TableCell>
                    <TableCell>
                      <Progress value={(getViews(page) / maxViews) * 100} className="h-2" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
