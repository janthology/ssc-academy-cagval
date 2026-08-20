'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  BookOpen,
  Award,
  TrendingUp,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserPlus,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats } from '@/components/admin/admin-stats-provider';

interface Activity {
  type: string;
  message: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface ActivityResponse {
  type: string;
  message: string;
  time: string;
}

export function AdminDashboard() {
  const stats = useAdminStats();
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadLogs = async () => {
      setLogsLoading(true);
      try {
        const logsResponse = await fetch('/api/admin/logs');
        if (!logsResponse.ok) {
          if (!cancelled) setRecentActivity([]);
          return;
        }
        const { activity } = (await logsResponse.json()) as { activity: ActivityResponse[] };
        if (cancelled) return;
        setRecentActivity(
          activity.map((entry) => {
            let icon = CheckCircle;
            let color = 'text-green-600';
            switch (entry.type) {
              case 'user_updated':
                icon = UserPlus;
                color = 'text-blue-600';
                break;
              case 'course_created':
                icon = BookOpen;
                color = 'text-green-600';
                break;
              case 'certificate_revoked':
                icon = Award;
                color = 'text-purple-600';
                break;
              default:
                icon = AlertTriangle;
                color = 'text-orange-600';
            }
            return { ...entry, icon, color };
          }),
        );
      } catch {
        if (!cancelled) setRecentActivity([]);
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    };
    loadLogs();
    return () => {
      cancelled = true;
    };
  }, []);

  const completionRate = stats.totalEnrollmentCount
    ? Math.round((stats.completedEnrollmentCount / stats.totalEnrollmentCount) * 100)
    : 0;

  const statCards = useMemo(
    () => [
      {
        title: 'Total Users',
        value: stats.userCount,
        description: `+${stats.newUsersThisMonth} this month`,
        icon: Users,
        color: 'text-blue-600',
        trend: `+${Math.round((stats.newUsersThisMonth / (stats.userCount || 1)) * 100)}%`,
      },
      {
        title: 'Active Courses',
        value: stats.activeCourseCount,
        description: 'Pending approval fetched below',
        icon: BookOpen,
        color: 'text-green-600',
        trend: '+8%',
      },
      {
        title: 'Certificates Issued',
        value: stats.certificateCount,
        description: `+${stats.newCertificatesThisMonth} this month`,
        icon: Award,
        color: 'text-purple-600',
        trend: `+${Math.round((stats.newCertificatesThisMonth / (stats.certificateCount || 1)) * 100)}%`,
      },
      {
        title: 'Completion Rate',
        value: `${completionRate}%`,
        description: '+5% from last month',
        icon: TrendingUp,
        color: 'text-orange-600',
        trend: '+5%',
      },
    ],
    [stats, completionRate],
  );

  const pendingActions = useMemo(
    () => [
      {
        title: 'Inactive Courses',
        count: stats.inactiveCourses,
        description: 'Courses marked inactive in the catalog',
        action: 'Manage',
        href: '/admin/courses',
      },
      {
        title: 'User Verifications',
        count: stats.pendingUsers,
        description: 'Accounts awaiting approval',
        action: 'Verify',
        href: '/admin/users',
      },
      {
        title: 'Content Review',
        count: stats.pendingModules,
        description: 'Modules submitted for admin review',
        action: 'Review',
        href: '/admin/review',
      },
    ],
    [stats],
  );

  if (stats.loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 rounded-lg border p-6 lg:col-span-2">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
          <div className="space-y-4 rounded-lg border p-6">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (stats.error) {
    return <div className="text-center p-6 text-red-600">{stats.error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-serif">Admin Dashboard</h1>
          <p className="text-muted-foreground">Cagayan Valley Smart City Academy Platform Overview</p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <MapPin className="w-4 h-4" />
          Region 2 - Cagayan Valley
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
              <div className="flex items-center mt-2">
                <Badge variant="outline" className="text-xs">
                  {stat.trend}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest platform events and updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {logsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity</p>
              ) : (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <activity.icon className={`w-5 h-5 mt-0.5 ${activity.color}`} />
                    <div className="flex-1">
                      <p className="text-sm">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" className="w-full bg-transparent" asChild>
                <Link href="/admin/logs" prefetch={false}>View All Activity</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Regional Statistics
              </CardTitle>
              <CardDescription>User distribution by province</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.regionalStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No regional data yet</p>
              ) : (
                stats.regionalStats.map((region) => (
                  <div key={region.province} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{region.province}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{region.users} users</span>
                      </div>
                    </div>
                    <Progress value={(region.users / (stats.userCount || 1)) * 100} className="h-2" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Actions
              </CardTitle>
              <CardDescription>Items requiring admin attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingActions.map((action) => (
                <div key={action.title} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium text-sm">{action.title}</h4>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="mb-2">
                      {action.count}
                    </Badge>
                    <Button size="sm" variant="outline" className="block bg-transparent" asChild>
                      <Link href={action.href} prefetch={false}>{action.action}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" asChild>
                <Link href="/admin/courses" prefetch={false}>
                  <BookOpen className="w-4 h-4" />
                  Create New Course
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" asChild>
                <Link href="/admin/users" prefetch={false}>
                  <Users className="w-4 h-4" />
                  Manage Users
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" asChild>
                <Link href="/admin/analytics" prefetch={false}>
                  <BarChart3 className="w-4 h-4" />
                  View Analytics
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Platform Status</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Healthy
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Certificate Service</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Backup Status</span>
                <Badge variant="secondary">Last: 2 hours ago</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
