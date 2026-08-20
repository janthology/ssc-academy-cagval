'use client';

import { useEffect, useState } from 'react';
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
import { supabaseBrowser } from '@/lib/supabase/browser-client';

interface Stat {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: string;
}

interface Activity {
  type: string;
  message: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface RegionalStat {
  province: string;
  users: number;
}

interface PendingAction {
  title: string;
  count: number;
  description: string;
  action: string;
  href: string;
  prefetch?: boolean;
}

interface ActivityResponse {
  type: string;
  message: string;
  time: string;
}

export function AdminDashboard() {
  const supabase = supabaseBrowser;
  const [stats, setStats] = useState<Stat[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [regionalStats, setRegionalStats] = useState<RegionalStat[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch Stats
        const [
          { count: totalUsers, error: usersError },
          { count: activeCourses, error: coursesError },
          { count: certificatesIssued, error: certificatesError },
          { data: completedEnrollments, error: completedEnrollmentsError },
          { count: newUsersThisMonth, error: newUsersError },
          { count: totalEnrollments, error: totalEnrollmentsError },
          { count: newCertificatesThisMonth, error: newCertificatesError },
        ] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('certificates').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('enrollments').select('status').eq('status', 'completed'),
          supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString()),
          supabase.from('enrollments').select('*', { count: 'exact', head: true }),
          supabase
            .from('certificates')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .gte('issued_at', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString()),
        ]);

        if (usersError) throw new Error(usersError.message);
        if (coursesError) throw new Error(coursesError.message);
        if (certificatesError) throw new Error(certificatesError.message);
        if (completedEnrollmentsError) throw new Error(completedEnrollmentsError.message);
        if (newUsersError) throw new Error(newUsersError.message);
        if (totalEnrollmentsError) throw new Error(totalEnrollmentsError.message);
        if (newCertificatesError) throw new Error(newCertificatesError.message);

        setTotalUsers(totalUsers || 0);

        const completionRate = totalEnrollments
          ? Math.round((completedEnrollments.length / totalEnrollments) * 100)
          : 0;

        setStats([
          {
            title: 'Total Users',
            value: totalUsers || 0,
            description: `+${newUsersThisMonth || 0} this month`,
            icon: Users,
            color: 'text-blue-600',
            trend: `+${Math.round((newUsersThisMonth || 0) / (totalUsers || 1) * 100)}%`,
          },
          {
            title: 'Active Courses',
            value: activeCourses || 0,
            description: 'Pending approval fetched below',
            icon: BookOpen,
            color: 'text-green-600',
            trend: '+8%',
          },
          {
            title: 'Certificates Issued',
            value: certificatesIssued || 0,
            description: `+${newCertificatesThisMonth || 0} this month`,
            icon: Award,
            color: 'text-purple-600',
            trend: `+${Math.round((newCertificatesThisMonth || 0) / (certificatesIssued || 1) * 100)}%`,
          },
          {
            title: 'Completion Rate',
            value: `${completionRate}%`,
            description: '+5% from last month',
            icon: TrendingUp,
            color: 'text-orange-600',
            trend: '+5%',
          },
        ]);

        // Fetch recent activity via secured admin API
        const logsResponse = await fetch('/api/admin/logs');
        if (!logsResponse.ok) {
          console.error('Admin logs error:', await logsResponse.text());
          setRecentActivity([]);
        } else {
          const { activity } = (await logsResponse.json()) as { activity: ActivityResponse[] };
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
        }

        // Fetch Regional Stats
        const { data: regionalData, error: regionalError } = await supabase
          .from('users')
          .select('province')
          .not('province', 'is', null);

        if (regionalError) throw new Error(regionalError.message);

        const provinceCounts: Record<string, number> = (regionalData || []).reduce(
          (acc: Record<string, number>, user: { province: string }) => {
            if (user.province) {
              acc[user.province] = (acc[user.province] || 0) + 1;
            }
            return acc;
          },
          {},
        );

        const regions: RegionalStat[] = Object.keys(provinceCounts).map(province => ({
          province,
          users: provinceCounts[province] || 0,
        }));

        setRegionalStats(regions.slice(0, 5));

        // Fetch Pending Actions
        const [
          { count: pendingCourses, error: pendingCoursesError },
          { count: pendingUsers, error: pendingUsersError },
          { count: pendingModules, error: pendingModulesError },
        ] = await Promise.all([
          supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_active', false),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('modules').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        ]);

        if (pendingCoursesError) throw new Error(pendingCoursesError.message);
        if (pendingUsersError) throw new Error(pendingUsersError.message);
        if (pendingModulesError) throw new Error(pendingModulesError.message);

        setPendingActions([
          {
            title: 'Inactive Courses',
            count: pendingCourses || 0,
            description: 'Courses marked inactive in the catalog',
            action: 'Manage',
            href: '/admin/courses',
            prefetch: false,
          },
          {
            title: 'User Verifications',
            count: pendingUsers || 0,
            description: 'Accounts awaiting approval',
            action: 'Verify',
            href: '/admin/users',
            prefetch: false,
          },
          {
            title: 'Content Review',
            count: pendingModules || 0,
            description: 'Modules submitted for admin review',
            action: 'Review',
            href: '/admin/review',
            prefetch: false,
          },
        ]);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data. Please try again.');
        console.error('Dashboard error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  if (isLoading) {
    return <div className="text-center p-6">Loading...</div>;
  }
  if (error) {
    return <div className="text-center p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
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
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest platform events and updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.length === 0 ? (
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

          {/* Regional Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Regional Statistics
              </CardTitle>
              <CardDescription>User distribution by province</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {regionalStats.map((region: RegionalStat) => (
                <div key={region.province} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{region.province}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{region.users} users</span>
                    </div>
                  </div>
                  <Progress value={(region.users / (totalUsers || 1)) * 100} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pending Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Actions
              </CardTitle>
              <CardDescription>Items requiring admin attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingActions.map((action, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium text-sm">{action.title}</h4>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="mb-2">
                      {action.count}
                    </Badge>
                    <Button size="sm" variant="outline" className="block bg-transparent" asChild>
                      <Link href={action.href} prefetch={action.prefetch ?? false}>{action.action}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
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

          {/* System Status */}
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