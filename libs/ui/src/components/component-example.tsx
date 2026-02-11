import {
  ActivityIcon,
  ServerIcon,
  LayoutIcon,
  SettingsIcon,
  LogOutIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CopyIcon,
  RefreshCwIcon,
  MicIcon,
  VideoIcon,
} from "lucide-react"

import {
  ExampleWrapper,
} from "./example"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card"
import { Input } from "./ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

// --- Helper Components for the Mockup ---

interface StatCardProps {
  title: string
  value: string
  trend: "up" | "down" | "flat"
  trendLabel: string
  positive: boolean
  icon?: React.ElementType
}

function StatCard({ title, value, trend, trendLabel, positive, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs flex items-center mt-1">
          {trend === "up" ? (
            <TrendingUpIcon className={`mr-1 h-3 w-3 ${positive ? 'text-emerald-500' : 'text-red-500'}`} />
          ) : (
            <TrendingDownIcon className="mr-1 h-3 w-3 text-muted-foreground" />
          )}
          <span className={positive ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
            {trendLabel}
          </span>
        </p>
      </CardContent>
    </Card>
  )
}

function StatusDot({ status }: { status: "active" | "warn" | "offline" }) {
  const colors = {
    active: "bg-emerald-500",
    warn: "bg-amber-500",
    offline: "bg-slate-300",
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${colors[status]}`} />
      <span className={`text-xs font-medium capitalize ${status === 'active' ? 'text-emerald-700' : 'text-muted-foreground'}`}>
        {status}
      </span>
    </div>
  )
}

function MockSwitch({ label, checked }: { label: string, checked?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium">{label}</span>
      <div className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${checked ? 'bg-primary' : 'bg-input'}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-background rounded-full shadow transition-all ${checked ? 'left-4.5' : 'left-0.5'}`} />
      </div>
    </div>
  )
}

export function ComponentExample() {
  return (
    <ExampleWrapper className="bg-secondary/30 min-h-screen p-0 block">
      {/* Top Navigation Bar */}
      <div className="bg-background border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="h-6 w-6 bg-primary rounded-md flex items-center justify-center">
              <ActivityIcon className="h-4 w-4 text-primary-foreground" />
            </div>
            PulseBeam
          </div>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <div className="flex items-center text-sm text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer">us-east-1</span>
            <span className="mx-2">/</span>
            <Badge variant="secondary" className="font-mono font-normal rounded-sm">prod-sfu-04</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon">
            <SettingsIcon className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm">Deploy Changes</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deploy to Production?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will roll out the current configuration to the SFU cluster. Active sessions may experience a momentary detailed reconnection.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Confirm Deploy</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-16 bg-background border-r min-h-[calc(100vh-57px)] flex flex-col items-center py-4 gap-6">
          <Button variant="ghost" size="icon" className="text-primary bg-primary/10">
            <LayoutIcon className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ServerIcon className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ActivityIcon className="h-5 w-5" />
          </Button>
          <div className="mt-auto">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
              <LogOutIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6 space-y-6">

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Active Connections"
              value="4,812"
              trend="up"
              trendLabel="+12%"
              positive={true}
              icon={ActivityIcon}
            />
            <StatCard
              title="Egress Bandwidth"
              value="8.2 GB/s"
              trend="flat"
              trendLabel="Stable"
              positive={true}
              icon={ServerIcon}
            />
            <StatCard
              title="Cluster Health"
              value="99.9%"
              trend="up"
              trendLabel="Optimal"
              positive={true}
              icon={ActivityIcon}
            />
            <StatCard
              title="Latency P95"
              value="24ms"
              trend="up"
              trendLabel="Global"
              positive={true}
              icon={TrendingUpIcon}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Live Sessions Table */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold">Live Sessions</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8">Filter</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><RefreshCwIcon className="h-3.5 w-3.5" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-xs font-medium text-muted-foreground border-b bg-muted/40 grid grid-cols-12 gap-4 px-6 py-3">
                  <div className="col-span-2">SESSION ID</div>
                  <div className="col-span-3">USER</div>
                  <div className="col-span-2">TRANSPORT</div>
                  <div className="col-span-3">BITRATE</div>
                  <div className="col-span-2">STATUS</div>
                </div>
                <div className="divide-y">
                  {[
                    { id: "s_8829", user: "Alice_Dev", transport: "UDP", bitrate: "2.4 Mbps", status: "active" },
                    { id: "s_1102", user: "Bob_Ops", transport: "TCP", bitrate: "1.1 Mbps", status: "active" },
                    { id: "s_5521", user: "Charlie_QA", transport: "UDP", bitrate: "800 Kbps", status: "warn" },
                    { id: "s_3391", user: "Load_Test", transport: "UDP", bitrate: "4.2 Mbps", status: "active" },
                  ].map((row) => (
                    <div key={row.id} className="grid grid-cols-12 gap-4 px-6 py-3.5 text-sm items-center hover:bg-muted/20 transition-colors">
                      <div className="col-span-2 font-mono text-xs text-muted-foreground">{row.id}</div>
                      <div className="col-span-3 font-medium">{row.user}</div>
                      <div className="col-span-2"><Badge variant="outline" className="text-xs font-normal bg-background">{row.transport}</Badge></div>
                      <div className="col-span-3 font-mono text-xs">{row.bitrate}</div>
                      <div className="col-span-2"><StatusDot status={row.status as any} /></div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="border-t py-3 bg-muted/10">
                <div className="text-xs text-muted-foreground w-full text-center">
                  Showing 4 of 1,209 active sessions
                </div>
              </CardFooter>
            </Card>

            {/* Node Config Panel */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Node Config</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Public Key</label>
                    <div className="relative">
                      <Input value="pk_live_8921_x90a..." readOnly className="pr-8 font-mono text-xs" />
                      <CopyIcon className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                    </div>
                  </div>

                  <div className="border-t pt-2 mt-2">
                    <MockSwitch label="Maintenance Mode" checked={false} />
                    <MockSwitch label="Simulcast Enabled" checked={true} />
                    <MockSwitch label="Debug Logging" checked={false} />
                  </div>

                  <Button variant="outline" className="w-full">View Raw Config</Button>
                </CardContent>
              </Card>

              {/* Audio/Video Check Placeholder */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Check Audio & Video</CardTitle>
                    <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="aspect-video bg-black rounded-md flex flex-col items-center justify-center relative overflow-hidden group">
                    <p className="text-muted-foreground text-xs z-10">Camera Preview</p>
                    <div className="absolute bottom-2 left-2 flex gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                      <span className="text-[10px] text-white font-mono">REC</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Camera</label>
                      <Select defaultValue="integrated">
                        <SelectTrigger>
                          <SelectValue placeholder="Select Camera" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="integrated">Integrated_Webcam_HD</SelectItem>
                          <SelectItem value="obs">OBS Virtual Camera</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Microphone</label>
                      <Select defaultValue="default">
                        <SelectTrigger>
                          <SelectValue placeholder="Select Mic" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default - MacBook Pro Mic</SelectItem>
                          <SelectItem value="external">External USB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom Grid: Participants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="overflow-hidden border-0 shadow-none bg-transparent">
              <CardContent className="p-0 aspect-video bg-black rounded-lg relative ring-1 ring-border/50">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-muted-foreground/50 text-sm">Active Speaker Video</span>
                </div>
                <div className="absolute bottom-4 left-4 text-white text-sm font-medium drop-shadow-md">Lukas (You)</div>
                <div className="absolute top-4 right-4 bg-destructive text-destructive-foreground p-1.5 rounded-full">
                  <MicIcon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Participants (3)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map((p) => (
                  <div key={p} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground border">P{p}</div>
                      <span className="text-sm font-medium">Participant {p}</span>
                    </div>
                    <div className="flex gap-2 text-muted-foreground">
                      <MicIcon className="h-4 w-4" />
                      <VideoIcon className="h-4 w-4" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </ExampleWrapper>
  )
}
